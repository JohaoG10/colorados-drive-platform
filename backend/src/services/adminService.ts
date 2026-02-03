import { supabaseAdmin } from '../config/supabase';
import { deleteUser as deleteAuthUser } from '../services/authService';

export async function createSubject(courseId: string, name: string, orderIndex = 0) {
  const { data, error } = await supabaseAdmin
    .from('subjects')
    .insert({ course_id: courseId, name, order_index: orderIndex })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSubject(id: string) {
  const { error } = await supabaseAdmin.from('subjects').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteContent(id: string) {
  const { error } = await supabaseAdmin.from('contents').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function createContent(
  subjectId: string,
  params: { title: string; body?: string; externalLink?: string; fileUrl?: string; orderIndex?: number }
) {
  const { data, error } = await supabaseAdmin
    .from('contents')
    .insert({
      subject_id: subjectId,
      title: params.title,
      body: params.body || null,
      external_link: params.externalLink || null,
      file_url: params.fileUrl || null,
      order_index: params.orderIndex ?? 0,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listUsers(filters?: { courseId?: string; cohortId?: string; role?: string; search?: string }) {
  let query = supabaseAdmin
    .from('user_profiles')
    .select('id, email, full_name, role, course_id, cohort_id, cedula, created_at, courses(name, code), cohorts(id, name, code, course_id)');

  if (filters?.cohortId) {
    query = query.eq('cohort_id', filters.cohortId);
  } else if (filters?.courseId) {
    const { data: cohortIds } = await supabaseAdmin.from('cohorts').select('id').eq('course_id', filters.courseId);
    const ids = (cohortIds || []).map((c) => c.id);
    if (ids.length > 0) {
      query = query.or(`course_id.eq.${filters.courseId},cohort_id.in.(${ids.join(',')})`);
    } else {
      query = query.eq('course_id', filters.courseId);
    }
  }
  if (filters?.role) {
    query = query.eq('role', filters.role);
  }
  if (filters?.search && filters.search.trim()) {
    const term = filters.search.trim();
    const pattern = `%${term}%`;
    query = query.or(`cedula.ilike.${pattern},full_name.ilike.${pattern},email.ilike.${pattern}`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function createCourse(name: string, code: string) {
  const { data, error } = await supabaseAdmin
    .from('courses')
    .insert({ name, code })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteCourse(id: string) {
  const { error } = await supabaseAdmin.from('courses').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listCourses() {
  const { data, error } = await supabaseAdmin.from('courses').select('*').order('name');
  if (error) throw new Error(error.message);
  return data;
}

export async function listSubjects(courseId?: string) {
  let query = supabaseAdmin
    .from('subjects')
    .select('id, name, order_index, course_id, courses(name, code)')
    .order('order_index');

  if (courseId) {
    query = query.eq('course_id', courseId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function listContentsBySubject(subjectId: string) {
  const { data, error } = await supabaseAdmin
    .from('contents')
    .select('id, title, body, external_link, file_url, order_index')
    .eq('subject_id', subjectId)
    .order('order_index');
  if (error) throw new Error(error.message);
  return data;
}

// Cohorts (Curso Tipo A/B + Número, ej: Curso Tipo B Nro 200)
export async function getOrCreateCohort(courseId: string, number: string) {
  const code = String(number).trim();
  if (!code) throw new Error('Número de curso requerido');
  const { data: existing } = await supabaseAdmin
    .from('cohorts')
    .select('id, name, code, course_id')
    .eq('course_id', courseId)
    .eq('code', code)
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabaseAdmin
    .from('cohorts')
    .insert({ course_id: courseId, name: code, code })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createCohort(courseId: string, name: string, code: string) {
  const { data, error } = await supabaseAdmin
    .from('cohorts')
    .insert({ course_id: courseId, name, code })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listCohorts(courseId?: string) {
  let query = supabaseAdmin
    .from('cohorts')
    .select('id, name, code, course_id, created_at, courses(name, code)')
    .order('created_at', { ascending: false });

  if (courseId) {
    query = query.eq('course_id', courseId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteCohort(id: string) {
  const { error } = await supabaseAdmin.from('cohorts').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Elimina el cohort y todos los usuarios (estudiantes) asignados a ese curso.
 * Libera espacio: borra usuarios en Auth (y en cascada sus intentos, respuestas, actividad).
 * El admin debe haber descargado el CSV antes.
 */
export async function deleteCohortWithUsers(cohortId: string): Promise<{ deletedUsers: number }> {
  const { data: profiles, error: fetchError } = await supabaseAdmin
    .from('user_profiles')
    .select('id, role')
    .eq('cohort_id', cohortId);

  if (fetchError) throw new Error(fetchError.message);

  const studentIds = (profiles || []).filter((p) => p.role === 'student').map((p) => p.id);

  for (const userId of studentIds) {
    await deleteAuthUser(userId);
  }

  await deleteCohort(cohortId);
  return { deletedUsers: studentIds.length };
}
