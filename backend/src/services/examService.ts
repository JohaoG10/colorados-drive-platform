import { supabaseAdmin } from '../config/supabase';

export interface CreateExamParams {
  subjectId?: string;
  courseId?: string;
  title: string;
  description?: string;
  questionCount: number;
  passingScore?: number;
  /** Tiempo límite en minutos; null = sin límite */
  durationMinutes?: number | null;
  /** Número máximo de intentos por usuario (default 1) */
  maxAttempts?: number;
}

export type QuestionType = 'multiple_choice' | 'open_text';

export interface CreateQuestionParams {
  questionText: string;
  imageUrl?: string;
  type?: QuestionType;
  correctAnswerText?: string;
  /** Para respuesta abierta con varias partes (a, b, c, d): respuestas modelo por parte, cada string puede tener varias líneas (alternativas). */
  correctAnswerParts?: string[];
  options: { text: string; isCorrect: boolean }[];
}

export async function createExam(params: CreateExamParams) {
  if ((!params.subjectId && !params.courseId) || (params.subjectId && params.courseId)) {
    throw new Error('Exam must have either subjectId or courseId, not both');
  }

  const { data, error } = await supabaseAdmin
    .from('exams')
    .insert({
      subject_id: params.subjectId || null,
      course_id: params.courseId || null,
      title: params.title,
      description: params.description || null,
      question_count: params.questionCount,
      passing_score: params.passingScore ?? 70,
      duration_minutes: params.durationMinutes ?? null,
      max_attempts: params.maxAttempts ?? 1,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteExam(id: string) {
  const { error } = await supabaseAdmin.from('exams').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteQuestion(questionId: string) {
  const { error } = await supabaseAdmin.from('questions').delete().eq('id', questionId);
  if (error) throw new Error(error.message);
}

async function getQuestionInsertContext(examId: string): Promise<{ subjectId: string | null; examId: string | null }> {
  const { data: exam, error } = await supabaseAdmin
    .from('exams')
    .select('subject_id, course_id')
    .eq('id', examId)
    .single();
  if (error || !exam) throw new Error('Exam not found');
  if (exam.subject_id) return { subjectId: exam.subject_id, examId: null };
  return { subjectId: null, examId };
}

async function getNextOrderIndex(subjectId: string | null, examId: string | null): Promise<number> {
  const col = subjectId ? 'subject_id' : 'exam_id';
  const val = subjectId || examId;
  const { data: questions } = await supabaseAdmin
    .from('questions')
    .select('order_index')
    .eq(col, val)
    .order('order_index', { ascending: false })
    .limit(1);
  return questions?.length ? (questions[0].order_index ?? 0) + 1 : 0;
}

export async function addQuestion(examId: string, params: CreateQuestionParams) {
  const { subjectId, examId: targetExamId } = await getQuestionInsertContext(examId);
  const nextOrder = await getNextOrderIndex(subjectId, targetExamId ?? null);

  const type = params.type || 'multiple_choice';
  const insertRow: Record<string, unknown> = {
    subject_id: subjectId || null,
    exam_id: targetExamId || null,
    question_text: params.questionText,
    image_url: params.imageUrl || null,
    order_index: nextOrder,
  };

  if (type === 'open_text') {
    const parts = params.correctAnswerParts && params.correctAnswerParts.length > 0
      ? params.correctAnswerParts.map((p) => (p || '').trim()).filter(Boolean)
      : (params.correctAnswerText ? [params.correctAnswerText.trim()] : []);
    const openTextParts = Math.max(1, parts.length);
    const correctAnswerText = parts.join('|||');
    const { data: question, error: qErr } = await supabaseAdmin
      .from('questions')
      .insert({ ...insertRow, type: 'open_text', correct_answer_text: correctAnswerText || null, open_text_parts: openTextParts })
      .select()
      .single();
    if (qErr || !question) throw new Error(qErr?.message || 'Failed to create question');
    return { ...question, options: [] };
  }

  const { data: question, error: qErr } = await supabaseAdmin
    .from('questions')
    .insert({ ...insertRow, type: 'multiple_choice' })
    .select()
    .single();

  if (qErr || !question) throw new Error(qErr?.message || 'Failed to create question');

  const optionsToInsert = params.options.map((opt, i) => ({
    question_id: question.id,
    option_text: opt.text,
    is_correct: opt.isCorrect,
    order_index: i,
  }));

  const { error: oErr } = await supabaseAdmin.from('options').insert(optionsToInsert);
  if (oErr) throw new Error(oErr.message);

  return { ...question, options: optionsToInsert };
}

async function loadQuestionsForExam(exam: { id: string; subject_id: string | null; course_id: string | null }) {
  let query = supabaseAdmin
    .from('questions')
    .select('id, question_text, image_url, order_index, type, correct_answer_text, open_text_parts');
  if (exam.subject_id) {
    query = query.eq('subject_id', exam.subject_id);
  } else {
    query = query.eq('exam_id', exam.id);
  }
  const { data: questions, error: qErr } = await query.order('order_index');
  if (qErr) throw new Error(qErr.message);
  return questions || [];
}

export async function getExamWithQuestions(examId: string) {
  const { data: exam, error: examErr } = await supabaseAdmin
    .from('exams')
    .select('*')
    .eq('id', examId)
    .single();

  if (examErr || !exam) throw new Error(examErr?.message || 'Exam not found');

  const questions = await loadQuestionsForExam(exam);

  const questionsWithOptions = await Promise.all(
    questions.map(async (q: { id: string; type?: string }) => {
      const qType = (q as { type?: string }).type || 'multiple_choice';
      if (qType === 'open_text') return { ...q, options: [] };
      const { data: opts } = await supabaseAdmin
        .from('options')
        .select('id, option_text, order_index')
        .eq('question_id', q.id)
        .order('order_index');
      return { ...q, options: opts || [] };
    })
  );

  return { ...exam, questions: questionsWithOptions };
}

export async function getExamForStudent(examId: string) {
  const { data: exam, error: examErr } = await supabaseAdmin
    .from('exams')
    .select('id, title, question_count, subject_id, course_id, duration_minutes')
    .eq('id', examId)
    .single();
  if (examErr || !exam) throw new Error('Exam not found');

  const rawQuestions = await loadQuestionsForExam(exam);
  const count = Math.min(exam.question_count, rawQuestions.length);
  if (count === 0) {
    throw new Error('No hay preguntas en el banco para este examen. Contacta al administrador.');
  }

  const shuffled = [...rawQuestions].sort(() => Math.random() - 0.5).slice(0, count);

  const questionsWithOptions = await Promise.all(
    shuffled.map(async (q: { id: string; question_text: string; image_url?: string; type?: string; open_text_parts?: number }) => {
      const qType = q.type || 'multiple_choice';
      if (qType === 'open_text') return { ...q, options: [] };
      const { data: opts } = await supabaseAdmin
        .from('options')
        .select('id, option_text, order_index')
        .eq('question_id', q.id)
        .order('order_index');
      return { ...q, options: opts || [] };
    })
  );

  type Q = { id: string; question_text: string; image_url?: string; type?: string; options: { id: string; option_text: string }[] };
  type QWithParts = Q & { open_text_parts?: number };
  const questions = (questionsWithOptions as QWithParts[]).map((q) => {
    const type = q.type || 'multiple_choice';
    return {
      id: q.id,
      questionText: q.question_text,
      imageUrl: q.image_url,
      type,
      openTextParts: type === 'open_text' ? Math.max(1, q.open_text_parts ?? 1) : undefined,
      options: type === 'multiple_choice'
        ? (q.options || []).sort(() => Math.random() - 0.5).map((o) => ({ id: o.id, text: o.option_text }))
        : [],
    };
  });

  return {
    id: exam.id,
    title: exam.title,
    questions,
    durationMinutes: exam.duration_minutes ?? undefined,
  };
}

/** Cuenta cuántos intentos finalizados tiene el usuario en este examen */
export async function countFinishedAttempts(examId: string, userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('exam_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('exam_id', examId)
    .eq('user_id', userId)
    .not('finished_at', 'is', null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Devuelve el intento sin finalizar (en curso) si existe */
export async function getUnfinishedAttempt(examId: string, userId: string): Promise<{ id: string; finished_at: string | null } | null> {
  const { data, error } = await supabaseAdmin
    .from('exam_attempts')
    .select('id, finished_at')
    .eq('exam_id', examId)
    .eq('user_id', userId)
    .is('finished_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

/** Obtiene el intento existente: si hay uno sin finalizar lo devuelve; si no, null (el router decidirá si puede crear otro) */
export async function getExistingAttempt(examId: string, userId: string): Promise<{ id: string; finished_at: string | null } | null> {
  return getUnfinishedAttempt(examId, userId);
}

export async function createAttempt(examId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('exam_attempts')
    .insert({ exam_id: examId, user_id: userId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function submitAttempt(
  attemptId: string,
  userId: string,
  answers: { questionId: string; optionId?: string; textAnswer?: string; textAnswers?: string[] }[]
) {
  const { data: attempt, error: attErr } = await supabaseAdmin
    .from('exam_attempts')
    .select('id, exam_id')
    .eq('id', attemptId)
    .eq('user_id', userId)
    .single();

  if (attErr || !attempt) throw new Error('Attempt not found');

  const mcAnswers = answers.filter((a) => a.optionId);
  const questionIds = answers.map((a) => a.questionId);
  const { data: questions } = await supabaseAdmin
    .from('questions')
    .select('id, type, correct_answer_text, open_text_parts')
    .in('id', questionIds);
  const questionTypes = new Map((questions || []).map((q) => [q.id, (q as { type?: string }).type || 'multiple_choice']));
  const questionModelAnswers = new Map(
    (questions || []).filter((q) => (q as { type?: string }).type === 'open_text').map((q) => [q.id, (q as { correct_answer_text?: string }).correct_answer_text || ''])
  );
  const questionPartsCount = new Map(
    (questions || []).filter((q) => (q as { type?: string }).type === 'open_text').map((q) => [q.id, Math.max(1, (q as { open_text_parts?: number }).open_text_parts ?? 1)])
  );

  function normalizeForCompare(t: string): string {
    return t
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  const { data: correctMap } = mcAnswers.length
    ? await supabaseAdmin.from('options').select('id, question_id, is_correct').in('question_id', mcAnswers.map((a) => a.questionId))
    : { data: [] as { id: string; question_id: string; is_correct: boolean }[] };

  const correctById = new Map((correctMap || []).map((o) => [o.id, o]));
  const correctByQuestion = new Map((correctMap || []).filter((o) => o.is_correct).map((o) => [o.question_id, o.id]));

  const attemptAnswers: { attempt_id: string; question_id: string; option_id: string | null; text_answer: string | null; is_correct: boolean | null }[] = answers.map((a) => {
    const qType = questionTypes.get(a.questionId) || 'multiple_choice';
    if (qType === 'open_text') {
      const partsCount = questionPartsCount.get(a.questionId) ?? 1;
      const modelText = questionModelAnswers.get(a.questionId) || '';
      const modelParts = modelText.split('|||').map((p) => p.split(/\r?\n/).map((l) => normalizeForCompare(l)).filter(Boolean));

      let studentTexts: string[];
      if (partsCount > 1 && Array.isArray((a as { textAnswers?: string[] }).textAnswers)) {
        studentTexts = (a as { textAnswers: string[] }).textAnswers.map((t) => (t ?? '').trim());
        while (studentTexts.length < partsCount) studentTexts.push('');
      } else {
        const single = (a as { textAnswer?: string }).textAnswer?.trim() || '';
        studentTexts = [single];
      }

      let allCorrect = true;
      for (let i = 0; i < partsCount; i++) {
        const models = modelParts[i] || [];
        const studentNorm = normalizeForCompare(studentTexts[i] || '');
        if (models.length > 0 && !models.some((m) => m === studentNorm)) allCorrect = false;
      }
      const textToStore = partsCount > 1 ? JSON.stringify(studentTexts) : (studentTexts[0] || null);
      return {
        attempt_id: attemptId,
        question_id: a.questionId,
        option_id: null,
        text_answer: textToStore,
        is_correct: allCorrect,
      };
    }
    const correctOpt = correctByQuestion.get(a.questionId);
    const isCorrect = a.optionId && correctOpt ? a.optionId === correctOpt : false;
    return {
      attempt_id: attemptId,
      question_id: a.questionId,
      option_id: a.optionId || null,
      text_answer: null,
      is_correct: isCorrect,
    };
  });

  await supabaseAdmin.from('attempt_answers').insert(attemptAnswers);

  const correctCount = attemptAnswers.filter((a) => a.is_correct === true).length;
  const total = attemptAnswers.length;
  const score = total > 0 ? (correctCount / total) * 100 : 0;

  const { data: exam } = await supabaseAdmin.from('exams').select('passing_score').eq('id', attempt.exam_id).single();
  const passingScore = exam?.passing_score ?? 70;
  const passed = score >= passingScore;

  await supabaseAdmin
    .from('exam_attempts')
    .update({ score, passed, finished_at: new Date().toISOString() })
    .eq('id', attemptId);

  return {
    score,
    passed,
    correctCount,
    total,
  };
}

export async function getAttemptResult(attemptId: string, userId: string) {
  const { data: attempt, error: attErr } = await supabaseAdmin
    .from('exam_attempts')
    .select('*')
    .eq('id', attemptId)
    .eq('user_id', userId)
    .single();

  if (attErr || !attempt) throw new Error('Attempt not found');
  if (!attempt.finished_at) throw new Error('Attempt not yet finished');

  const { data: answers } = await supabaseAdmin
    .from('attempt_answers')
    .select('question_id, option_id, is_correct')
    .eq('attempt_id', attemptId);

  const correctCount = (answers || []).filter((a) => a.is_correct).length;
  const total = (answers || []).length;

  return {
    score: attempt.score,
    passed: attempt.passed,
    correctCount,
    total,
    startedAt: attempt.started_at,
    finishedAt: attempt.finished_at,
    answers: answers || [],
  };
}

export async function listExamsForCourse(courseId: string) {
  const { data: bySubject } = await supabaseAdmin
    .from('exams')
    .select('id, title, subject_id, course_id, question_count, passing_score, duration_minutes, max_attempts')
    .is('course_id', null);

  const subjectIds = [...new Set((bySubject || []).map((e) => e.subject_id).filter(Boolean))];
  const { data: subjects } = await supabaseAdmin
    .from('subjects')
    .select('id, course_id')
    .in('id', subjectIds)
    .eq('course_id', courseId);

  const validSubjectIds = new Set((subjects || []).map((s) => s.id));
  const examsBySubject = (bySubject || []).filter((e) => e.subject_id && validSubjectIds.has(e.subject_id));

  const { data: examsByCourse } = await supabaseAdmin
    .from('exams')
    .select('id, title, subject_id, course_id, question_count, passing_score, duration_minutes, max_attempts')
    .eq('course_id', courseId);

  const all = [...(examsByCourse || []), ...examsBySubject];
  return all;
}

/** Resultados del examen: un registro por usuario con su mejor intento (mayor calificación) */
export async function getAdminExamResults(examId: string) {
  const { data: attempts, error } = await supabaseAdmin
    .from('exam_attempts')
    .select('id, user_id, score, passed, started_at, finished_at')
    .eq('exam_id', examId)
    .not('finished_at', 'is', null);

  if (error) throw new Error(error.message);
  if (!attempts?.length) return [];

  const byUser = new Map<string, { id: string; user_id: string; score: number; passed: boolean; started_at: string; finished_at: string }>();
  for (const a of attempts) {
    const score = a.score ?? 0;
    const existing = byUser.get(a.user_id);
    if (!existing || (existing.score ?? 0) < score) {
      byUser.set(a.user_id, { id: a.id, user_id: a.user_id, score, passed: a.passed ?? false, started_at: a.started_at, finished_at: a.finished_at ?? '' });
    }
  }

  const userIds = [...byUser.keys()];
  const { data: profiles } = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, full_name')
    .in('id', userIds);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
  return [...byUser.values()].map((a) => ({
    ...a,
    email: profileMap.get(a.user_id)?.email,
    fullName: profileMap.get(a.user_id)?.full_name,
  }));
}

/** Resultados del usuario: un registro por examen con su mejor intento */
export async function getUserExamResults(userId: string) {
  const { data: attempts, error } = await supabaseAdmin
    .from('exam_attempts')
    .select('id, exam_id, score, passed, started_at, finished_at')
    .eq('user_id', userId)
    .not('finished_at', 'is', null);

  if (error) throw new Error(error.message);
  if (!attempts?.length) return [];

  const byExam = new Map<string, { id: string; exam_id: string; score: number; passed: boolean; started_at: string; finished_at: string }>();
  for (const a of attempts) {
    const score = a.score ?? 0;
    const existing = byExam.get(a.exam_id);
    if (!existing || (existing.score ?? 0) < score) {
      byExam.set(a.exam_id, { id: a.id, exam_id: a.exam_id, score, passed: a.passed ?? false, started_at: a.started_at, finished_at: a.finished_at ?? '' });
    }
  }

  const examIds = [...byExam.keys()];
  const { data: exams } = await supabaseAdmin.from('exams').select('id, title').in('id', examIds);
  const examMap = new Map((exams || []).map((e) => [e.id, e]));
  return [...byExam.values()].map((a) => ({ ...a, examTitle: examMap.get(a.exam_id)?.title }));
}

/** Id del intento con mejor calificación para este usuario en este examen (para mostrar resultado) */
export async function getBestAttemptIdForUserExam(examId: string, userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('exam_attempts')
    .select('id, score')
    .eq('exam_id', examId)
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .order('score', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.id;
}

export interface AttemptDetailAnswer {
  questionText: string;
  isCorrect: boolean;
  studentAnswer: string;
  correctAnswer: string;
}

export async function getAttemptDetailForAdmin(attemptId: string) {
  const { data: attempt, error: attErr } = await supabaseAdmin
    .from('exam_attempts')
    .select('id, exam_id, user_id, score, passed, started_at, finished_at')
    .eq('id', attemptId)
    .single();

  if (attErr || !attempt) throw new Error('Attempt not found');

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('email, full_name')
    .eq('id', attempt.user_id)
    .single();

  const { data: answers, error: ansErr } = await supabaseAdmin
    .from('attempt_answers')
    .select('question_id, option_id, text_answer, is_correct')
    .eq('attempt_id', attemptId)
    .order('question_id');

  if (ansErr) throw new Error(ansErr.message);

  const questionIds = [...new Set((answers || []).map((a) => a.question_id))];
  const { data: questions } = await supabaseAdmin
    .from('questions')
    .select('id, question_text, type, correct_answer_text')
    .in('id', questionIds);

  const questionMap = new Map((questions || []).map((q) => [q.id, q]));

  const optionIds = (answers || []).map((a) => a.option_id).filter(Boolean) as string[];
  const { data: options } = optionIds.length
    ? await supabaseAdmin.from('options').select('id, question_id, option_text, is_correct').in('id', optionIds)
    : { data: [] as { id: string; question_id: string; option_text: string; is_correct: boolean }[] };

  const allQuestionIdsForCorrect = [...new Set((options || []).map((o) => o.question_id))];
  const { data: correctOptions } = allQuestionIdsForCorrect.length
    ? await supabaseAdmin.from('options').select('id, question_id, option_text').eq('is_correct', true).in('question_id', allQuestionIdsForCorrect)
    : { data: [] as { question_id: string; option_text: string }[] };
  const correctByQuestion = new Map((correctOptions || []).map((o) => [o.question_id, o.option_text]));
  const optionTextById = new Map((options || []).map((o) => [o.id, o.option_text]));

  const detailAnswers: AttemptDetailAnswer[] = (answers || []).map((a) => {
    const q = questionMap.get(a.question_id) as { question_text: string; type?: string; correct_answer_text?: string } | undefined;
    const questionText = q?.question_text ?? 'Pregunta';
    const isCorrect = a.is_correct === true;
    let studentAnswer = '';
    let correctAnswer = '';

    if (a.option_id) {
      studentAnswer = optionTextById.get(a.option_id) ?? '(opción seleccionada)';
      correctAnswer = correctByQuestion.get(a.question_id) ?? '(respuesta correcta)';
    } else {
      try {
        const raw = a.text_answer;
        if (raw && raw.startsWith('[')) {
          const arr = JSON.parse(raw) as string[];
          studentAnswer = Array.isArray(arr) ? arr.join(' | ') : raw;
        } else {
          studentAnswer = raw ?? '';
        }
      } catch {
        studentAnswer = a.text_answer ?? '';
      }
      const modelText = q?.correct_answer_text ?? '';
      const parts = modelText.split('|||').map((p) => p.split(/\r?\n/)[0]?.trim()).filter(Boolean);
      correctAnswer = parts.length > 1 ? parts.map((p, i) => `${String.fromCharCode(97 + i)}) ${p}`).join('; ') : (parts[0] ?? '(respuesta abierta)');
    }

    return { questionText, isCorrect, studentAnswer, correctAnswer };
  });

  return {
    attempt: { id: attempt.id, score: attempt.score, passed: attempt.passed, finished_at: attempt.finished_at },
    user: { email: profile?.email ?? '', fullName: profile?.full_name ?? '' },
    answers: detailAnswers,
  };
}

/** Detalle del intento para el propio estudiante (ver en qué se equivocó) */
export async function getAttemptDetailForStudent(attemptId: string, userId: string) {
  const { data: attempt, error: attErr } = await supabaseAdmin
    .from('exam_attempts')
    .select('id, exam_id, user_id, score, passed, started_at, finished_at')
    .eq('id', attemptId)
    .eq('user_id', userId)
    .single();

  if (attErr || !attempt) throw new Error('Attempt not found');
  if (!attempt.finished_at) throw new Error('Attempt not yet finished');

  const { data: answers, error: ansErr } = await supabaseAdmin
    .from('attempt_answers')
    .select('question_id, option_id, text_answer, is_correct')
    .eq('attempt_id', attemptId)
    .order('question_id');

  if (ansErr) throw new Error(ansErr.message);

  const questionIds = [...new Set((answers || []).map((a) => a.question_id))];
  const { data: questions } = await supabaseAdmin
    .from('questions')
    .select('id, question_text, type, correct_answer_text')
    .in('id', questionIds);

  const questionMap = new Map((questions || []).map((q) => [q.id, q]));

  const optionIds = (answers || []).map((a) => a.option_id).filter(Boolean) as string[];
  const { data: options } = optionIds.length
    ? await supabaseAdmin.from('options').select('id, question_id, option_text, is_correct').in('id', optionIds)
    : { data: [] as { id: string; question_id: string; option_text: string; is_correct: boolean }[] };

  const allQuestionIdsForCorrect = [...new Set((options || []).map((o) => o.question_id))];
  const { data: correctOptions } = allQuestionIdsForCorrect.length
    ? await supabaseAdmin.from('options').select('id, question_id, option_text').eq('is_correct', true).in('question_id', allQuestionIdsForCorrect)
    : { data: [] as { question_id: string; option_text: string }[] };
  const correctByQuestion = new Map((correctOptions || []).map((o) => [o.question_id, o.option_text]));
  const optionTextById = new Map((options || []).map((o) => [o.id, o.option_text]));

  const detailAnswers: AttemptDetailAnswer[] = (answers || []).map((a) => {
    const q = questionMap.get(a.question_id) as { question_text: string; type?: string; correct_answer_text?: string } | undefined;
    const questionText = q?.question_text ?? 'Pregunta';
    const isCorrect = a.is_correct === true;
    let studentAnswer = '';
    let correctAnswer = '';

    if (a.option_id) {
      studentAnswer = optionTextById.get(a.option_id) ?? '(opción seleccionada)';
      correctAnswer = correctByQuestion.get(a.question_id) ?? '(respuesta correcta)';
    } else {
      try {
        const raw = a.text_answer;
        if (raw && raw.startsWith('[')) {
          const arr = JSON.parse(raw) as string[];
          studentAnswer = Array.isArray(arr) ? arr.join(' | ') : raw;
        } else {
          studentAnswer = raw ?? '';
        }
      } catch {
        studentAnswer = a.text_answer ?? '';
      }
      const modelText = q?.correct_answer_text ?? '';
      const parts = modelText.split('|||').map((p) => p.split(/\r?\n/)[0]?.trim()).filter(Boolean);
      correctAnswer = parts.length > 1 ? parts.map((p, i) => `${String.fromCharCode(97 + i)}) ${p}`).join('; ') : (parts[0] ?? '(respuesta abierta)');
    }

    return { questionText, isCorrect, studentAnswer, correctAnswer };
  });

  return {
    attempt: { id: attempt.id, score: attempt.score, passed: attempt.passed, finished_at: attempt.finished_at },
    answers: detailAnswers,
  };
}
