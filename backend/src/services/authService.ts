import { supabaseAdmin, supabaseAnon } from '../config/supabase';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface LoginResult {
  accessToken: string;
  refreshToken?: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    courseId: string | null;
  };
}

/**
 * Login with email and password using Supabase Auth.
 * Returns JWT and user profile.
 */
export async function login(email: string, password: string): Promise<LoginResult | null> {
  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

  if (error || !data.session || !data.user) {
    return null;
  }

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, full_name, role, course_id, cohort_id, cohorts(course_id)')
    .eq('id', data.user.id)
    .single();

  if (!profile) {
    return null;
  }

  const courseId = profile.course_id
    ?? (profile.cohorts as { course_id?: string } | null)?.course_id
    ?? null;

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    user: {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name || '',
      role: profile.role,
      courseId,
    },
  };
}

/**
 * Create user via Supabase Admin API and insert profile.
 */
export async function createUser(params: {
  email: string;
  password: string;
  fullName: string;
  role: 'admin' | 'student';
  courseId?: string | null;
  cohortId?: string | null;
  courseNumber?: string | null;
  mustChangePassword?: boolean;
}): Promise<{ userId: string; error?: string }> {
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
    user_metadata: {
      full_name: params.fullName,
    },
  });

  if (authError || !authData.user) {
    return { userId: '', error: authError?.message || 'Failed to create user' };
  }

  let courseId: string | null = null;
  let cohortId: string | null = null;
  if (params.role === 'student') {
    if (params.cohortId) {
      cohortId = params.cohortId;
      const { data: cohort } = await supabaseAdmin.from('cohorts').select('course_id').eq('id', params.cohortId).single();
      courseId = cohort?.course_id ?? null;
    } else if (params.courseId && params.courseNumber) {
      const { getOrCreateCohort } = await import('./adminService');
      const cohort = await getOrCreateCohort(params.courseId, params.courseNumber);
      cohortId = cohort.id;
      courseId = cohort.course_id;
    } else {
      courseId = params.courseId ?? null;
    }
  }

  const { error: profileError } = await supabaseAdmin.from('user_profiles').insert({
    id: authData.user.id,
    email: params.email,
    full_name: params.fullName,
    role: params.role,
    course_id: courseId,
    cohort_id: cohortId,
    must_change_password: params.mustChangePassword ?? true,
  });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return { userId: '', error: profileError.message };
  }

  return { userId: authData.user.id };
}

/**
 * Delete user (auth + profile cascade).
 */
export async function deleteUser(userId: string): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  return {};
}

/**
 * Update user profile and optionally password.
 */
export async function updateUserProfile(
  userId: string,
  params: {
    fullName?: string;
    role?: 'admin' | 'student';
    courseId?: string | null;
    cohortId?: string | null;
    courseNumber?: string | null;
    password?: string;
  }
): Promise<{ error?: string }> {
  if (params.password !== undefined) {
    const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: params.password,
      ...(params.fullName !== undefined && { user_metadata: { full_name: params.fullName } }),
    });
    if (pwError) return { error: pwError.message };
  } else if (params.fullName !== undefined) {
    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { full_name: params.fullName },
    });
    if (metaError) return { error: metaError.message };
  }

  const update: Record<string, unknown> = {};
  if (params.fullName !== undefined) update.full_name = params.fullName;
  if (params.role !== undefined) {
    update.role = params.role;
    if (params.role === 'admin') {
      update.course_id = null;
      update.cohort_id = null;
    } else if (params.role === 'student' && (params.courseId !== undefined || params.cohortId !== undefined)) {
      if (params.cohortId) {
        const { data: cohort } = await supabaseAdmin.from('cohorts').select('course_id').eq('id', params.cohortId).single();
        update.course_id = cohort?.course_id ?? null;
        update.cohort_id = params.cohortId;
      } else {
        update.course_id = params.courseId ?? null;
        update.cohort_id = null;
      }
    }
  } else if (params.courseId !== undefined || params.cohortId !== undefined || params.courseNumber !== undefined) {
    if (params.cohortId) {
      const { data: cohort } = await supabaseAdmin.from('cohorts').select('course_id').eq('id', params.cohortId).single();
      update.course_id = cohort?.course_id ?? null;
      update.cohort_id = params.cohortId;
    } else if (params.courseId && params.courseNumber && String(params.courseNumber).trim()) {
      const { getOrCreateCohort } = await import('./adminService');
      const cohort = await getOrCreateCohort(params.courseId, String(params.courseNumber).trim());
      update.course_id = cohort.course_id;
      update.cohort_id = cohort.id;
    } else {
      update.course_id = params.courseId ?? null;
      update.cohort_id = null;
    }
  }

  if (Object.keys(update).length > 0) {
    const { error } = await supabaseAdmin.from('user_profiles').update(update).eq('id', userId);
    if (error) return { error: error.message };
  }
  return {};
}
