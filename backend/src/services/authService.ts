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
  cedula?: string | null;
  scheduleId?: string | null;
  instructorId?: string | null;
  dayOfWeek?: number | null;
  startTime?: string | null;
  citizenship?: string | null;
  bloodType?: string | null;
  birthDate?: string | null;
  address?: string | null;
  phone?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  modality?: string | null;
  initialPaymentAmount?: number | null;
  createdBy?: string | null;
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

  let scheduleId: string | null = params.role === 'student' ? (params.scheduleId || null) : null;
  if (params.role === 'student' && cohortId && !scheduleId && params.instructorId && params.dayOfWeek != null && params.startTime) {
    const { createCourseSchedule } = await import('./scheduleService');
    const schedule = await createCourseSchedule({
      cohortId,
      instructorId: params.instructorId,
      dayOfWeek: params.dayOfWeek,
      startTime: params.startTime,
    });
    scheduleId = schedule.id;
  }

  let totalAmount: number | null = null;
  let amountPaid = 0;
  if (params.role === 'student' && courseId) {
    const { data: course, error: courseErr } = await supabaseAdmin.from('courses').select('price').eq('id', courseId).single();
    const price = !courseErr && course?.price != null ? Number(course.price) : 0;
    totalAmount = price;
    const initial = params.initialPaymentAmount != null ? Number(params.initialPaymentAmount) : 0;
    if (initial > 0 && totalAmount > 0) {
      amountPaid = Math.min(initial, totalAmount);
    }
  }

  const { error: profileError } = await supabaseAdmin.from('user_profiles').insert({
    id: authData.user.id,
    email: params.email,
    full_name: params.fullName,
    role: params.role,
    course_id: courseId,
    cohort_id: cohortId,
    cedula: params.cedula?.trim() || null,
    schedule_id: scheduleId,
    citizenship: params.citizenship?.trim() || null,
    blood_type: params.bloodType?.trim() || null,
    birth_date: params.birthDate?.trim() || null,
    address: params.address?.trim() || null,
    phone: params.phone?.trim() || null,
    start_date: params.startDate?.trim() || null,
    end_date: params.endDate?.trim() || null,
    modality: params.modality?.trim() || null,
    total_amount: totalAmount,
    amount_paid: amountPaid,
    must_change_password: params.mustChangePassword ?? true,
  });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return { userId: '', error: profileError.message };
  }

  if (params.role === 'student' && amountPaid > 0) {
    await supabaseAdmin.from('payments').insert({
      user_id: authData.user.id,
      amount: amountPaid,
      note: 'Pago inicial al inscribir',
      created_by: params.createdBy ?? null,
    });
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
    cedula?: string | null;
    scheduleId?: string | null;
    instructorId?: string | null;
    dayOfWeek?: number | null;
    startTime?: string | null;
    citizenship?: string | null;
    bloodType?: string | null;
    birthDate?: string | null;
    address?: string | null;
    phone?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    modality?: string | null;
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
      update.schedule_id = null;
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
  }
  if (params.cedula !== undefined) {
    update.cedula = params.cedula?.trim() || null;
  }
  if (params.scheduleId !== undefined) {
    update.schedule_id = params.scheduleId ?? null;
  }
  if (params.instructorId != null && params.dayOfWeek != null && params.startTime && params.cohortId) {
    const { getOrCreateCourseSchedule, getAvailableSlots } = await import('./scheduleService');
    const cohortId = params.cohortId;
    const startTime = typeof params.startTime === 'string' && params.startTime.length >= 5 ? params.startTime.slice(0, 5) : params.startTime;
    const { data: currentProfile } = await supabaseAdmin.from('user_profiles').select('schedule_id').eq('id', userId).single();
    const currentScheduleId = (currentProfile as { schedule_id?: string | null } | null)?.schedule_id ?? null;
    const available = await getAvailableSlots(cohortId, params.instructorId, currentScheduleId);
    const slotKey = `${params.dayOfWeek}-${startTime}`;
    const isAvailable = available.some((s) => {
      const t = typeof s.start_time === 'string' ? s.start_time.slice(0, 5) : s.start_time;
      return `${s.day_of_week}-${t}` === slotKey;
    });
    if (!isAvailable) return { error: 'Ese horario no está disponible. Elige otro día, hora o instructor.' };
    const schedule = await getOrCreateCourseSchedule({
      cohortId,
      instructorId: params.instructorId,
      dayOfWeek: params.dayOfWeek,
      startTime,
    });
    update.schedule_id = schedule.id;
    update._oldScheduleIdForCleanup = currentScheduleId;
  }
  if (params.citizenship !== undefined) {
    update.citizenship = params.citizenship?.trim() || null;
  }
  if (params.bloodType !== undefined) {
    update.blood_type = params.bloodType?.trim() || null;
  }
  if (params.birthDate !== undefined) update.birth_date = params.birthDate?.trim() || null;
  if (params.address !== undefined) update.address = params.address?.trim() || null;
  if (params.phone !== undefined) update.phone = params.phone?.trim() || null;
  if (params.startDate !== undefined) update.start_date = params.startDate?.trim() || null;
  if (params.endDate !== undefined) update.end_date = params.endDate?.trim() || null;
  if (params.modality !== undefined) update.modality = params.modality?.trim() || null;
  if (params.courseId !== undefined || params.cohortId !== undefined || params.courseNumber !== undefined) {
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

  const oldScheduleIdForCleanup = update._oldScheduleIdForCleanup as string | null | undefined;
  delete update._oldScheduleIdForCleanup;

  if (Object.keys(update).length > 0) {
    const { error } = await supabaseAdmin.from('user_profiles').update(update).eq('id', userId);
    if (error) return { error: error.message };
  }

  if (oldScheduleIdForCleanup) {
    const { data: remaining } = await supabaseAdmin.from('user_profiles').select('id').eq('schedule_id', oldScheduleIdForCleanup).limit(1);
    if (!remaining?.length) {
      await supabaseAdmin.from('course_schedules').delete().eq('id', oldScheduleIdForCleanup);
    }
  }
  return {};
}
