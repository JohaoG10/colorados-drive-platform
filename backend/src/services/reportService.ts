import { supabaseAdmin } from '../config/supabase';

export interface CohortReportStudent {
  userId: string;
  email: string;
  fullName: string;
  examResults: { examId: string; attemptId: string; examTitle: string; score: number; passed: boolean; finishedAt: string }[];
  totalTimeSeconds: number;
  lastActiveAt: string | null;
}

export async function getCohortReport(cohortId: string) {
  const { data: cohort, error: cohortErr } = await supabaseAdmin
    .from('cohorts')
    .select('id, name, code, course_id, courses(name, code)')
    .eq('id', cohortId)
    .single();

  if (cohortErr || !cohort) throw new Error('Cohort not found');

  const { data: students, error: studentsErr } = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, full_name')
    .eq('cohort_id', cohortId)
    .eq('role', 'student');

  if (studentsErr) throw new Error(studentsErr.message);

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
      courseName: (cohort.courses as { name?: string })?.name,
    },
    students: report,
  };
}
