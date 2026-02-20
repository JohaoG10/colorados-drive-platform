import { supabaseAdmin } from '../config/supabase';

export interface CohortReportStudent {
  userId: string;
  email: string;
  fullName: string;
  cedula: string | null;
  citizenship: string | null;
  bloodType: string | null;
  birthDate: string | null;
  address: string | null;
  phone: string | null;
  startDate: string | null;
  endDate: string | null;
  modality: string | null;
  examResults: { examId: string; attemptId: string; examTitle: string; score: number; passed: boolean; finishedAt: string }[];
  totalTimeSeconds: number;
  lastActiveAt: string | null;
}

export async function getCohortReport(cohortId: string) {
  const { data: cohort, error: cohortErr } = await supabaseAdmin
    .from('cohorts')
    .select('id, name, code, course_id, courses(id, name, code, price)')
    .eq('id', cohortId)
    .single();

  if (cohortErr || !cohort) throw new Error('Cohort not found');

  const courseRow = cohort.courses as { id?: string; name?: string; code?: string; price?: number } | null;

  let studentsData: { id: string; email: string; full_name: string | null; cedula?: string | null; citizenship?: string | null; blood_type?: string | null; birth_date?: string | null; address?: string | null; phone?: string | null; start_date?: string | null; end_date?: string | null; modality?: string | null }[] | null = null;
  const fullSelect = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, full_name, cedula, citizenship, blood_type, birth_date, address, phone, start_date, end_date, modality')
    .eq('cohort_id', cohortId)
    .eq('role', 'student');
  if (fullSelect.error && /birth_date|address|phone|start_date|end_date|modality|schema|does not exist/i.test(fullSelect.error.message)) {
    const fallback = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, full_name, cedula, citizenship, blood_type')
      .eq('cohort_id', cohortId)
      .eq('role', 'student');
    if (fallback.error) throw new Error(fallback.error.message);
    studentsData = (fallback.data || []).map((s) => ({ ...s, birth_date: null, address: null, phone: null, start_date: null, end_date: null, modality: null }));
  } else {
    if (fullSelect.error) throw new Error(fullSelect.error.message);
    studentsData = fullSelect.data;
  }
  const students = studentsData;

  const report: CohortReportStudent[] = [];

  for (const s of students || []) {
    const { data: activity } = await supabaseAdmin
      .from('user_activity')
      .select('last_active_at, total_time_seconds')
      .eq('user_id', s.id)
      .single();

    const { data: attempts } = await supabaseAdmin
      .from('exam_attempts')
      .select('id, exam_id, score, passed, finished_at, exams(title)')
      .eq('user_id', s.id)
      .not('finished_at', 'is', null);

    const byExam = new Map<string, { id: string; exam_id: string; score: number; passed: boolean; finished_at: string; examTitle: string }>();
    for (const a of attempts || []) {
      const score = a.score ?? 0;
      const existing = byExam.get(a.exam_id);
      if (!existing || existing.score < score) {
        byExam.set(a.exam_id, {
          id: a.id,
          exam_id: a.exam_id,
          score,
          passed: a.passed ?? false,
          finished_at: a.finished_at || '',
          examTitle: (a.exams as { title?: string })?.title || 'Examen',
        });
      }
    }

    report.push({
      userId: s.id,
      email: s.email,
      fullName: s.full_name || '',
      cedula: s.cedula ?? null,
      citizenship: s.citizenship ?? null,
      bloodType: s.blood_type ?? null,
      birthDate: s.birth_date ?? null,
      address: s.address ?? null,
      phone: s.phone ?? null,
      startDate: s.start_date ?? null,
      endDate: s.end_date ?? null,
      modality: s.modality ?? null,
      examResults: [...byExam.values()].map((a) => ({
        examId: a.exam_id,
        attemptId: a.id,
        examTitle: a.examTitle,
        score: a.score,
        passed: a.passed,
        finishedAt: a.finished_at,
      })),
      totalTimeSeconds: activity?.total_time_seconds ?? 0,
      lastActiveAt: activity?.last_active_at ?? null,
    });
  }

  return {
    cohort: {
      id: cohort.id,
      name: cohort.name,
      code: cohort.code,
      courseId: courseRow?.id,
      courseName: courseRow?.name,
      courseCode: courseRow?.code,
      coursePrice: courseRow?.price != null ? Number(courseRow.price) : null,
    },
    students: report,
  };
}
