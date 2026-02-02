import { supabaseAdmin } from '../config/supabase';

export async function getStudentCourse(courseId: string) {
  const { data, error } = await supabaseAdmin
    .from('courses')
    .select('id, name, code')
    .eq('id', courseId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listSubjectsByCourse(courseId: string) {
  const { data, error } = await supabaseAdmin
    .from('subjects')
    .select('id, name, order_index')
    .eq('course_id', courseId)
    .order('order_index');
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

/**
 * Verifies that the subject belongs to the given course.
 */
export async function subjectBelongsToCourse(
  subjectId: string,
  courseId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('subjects')
    .select('id')
    .eq('id', subjectId)
    .eq('course_id', courseId)
    .single();
  return !error && !!data;
}
