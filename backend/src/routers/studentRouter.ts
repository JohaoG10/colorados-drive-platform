import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { requireStudent } from '../middleware/rbac';
import * as studentService from '../services/studentService';
import * as examService from '../services/examService';
import * as notificationService from '../services/notificationService';
import * as attendanceService from '../services/attendanceService';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authMiddleware, requireStudent);

router.get('/course', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.courseId) {
    res.status(400).json({ error: 'No course assigned to this user' });
    return;
  }

  try {
    const course = await studentService.getStudentCourse(req.user.courseId);
    res.json(course);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/subjects', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.courseId) {
    res.status(400).json({ error: 'No course assigned to this user' });
    return;
  }

  try {
    const subjects = await studentService.listSubjectsByCourse(req.user.courseId);
    res.json(subjects);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get(
  '/subjects/:id/contents',
  [param('id').isUUID()],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    if (!req.user?.courseId) {
      res.status(400).json({ error: 'No course assigned' });
      return;
    }

    const subjectId = req.params.id;
    const belongs = await studentService.subjectBelongsToCourse(subjectId, req.user.courseId);
    if (!belongs) {
      res.status(403).json({ error: 'Subject does not belong to your course' });
      return;
    }

    try {
      const contents = await studentService.listContentsBySubject(subjectId);
      res.json(contents);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }
);

router.post('/activity', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  try {
    const { upsertActivity } = await import('../services/activityService');
    await upsertActivity(req.user.id, {
      totalTimeSeconds: req.body.totalTimeSeconds ?? 0,
      contentId: req.body.contentId,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// --- Exams ---
router.get('/exams', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.courseId) {
    res.status(400).json({ error: 'No course assigned' });
    return;
  }
  try {
    const exams = await examService.listExamsForCourse(req.user.courseId);
    const examIds = exams.map((e) => e.id);
    if (examIds.length === 0) {
      res.json([]);
      return;
    }
    const cohortId = req.user.cohortId ?? null;
    const enabledDefinitiveIds = cohortId ? await examService.getEnabledDefinitiveExamIdsForCohort(cohortId) : new Set<string>();

    const { data: attempts } = await supabaseAdmin
      .from('exam_attempts')
      .select('exam_id, id, score, finished_at, is_definitive')
      .eq('user_id', req.user.id)
      .in('exam_id', examIds);

    const byExam = new Map<string, { bestAttemptId: string; bestScore: number; practiceFinished: number; definitiveFinished: number }>();
    for (const e of examIds) {
      byExam.set(e, { bestAttemptId: '', bestScore: 0, practiceFinished: 0, definitiveFinished: 0 });
    }
    for (const a of attempts || []) {
      const cur = byExam.get(a.exam_id)!;
      const isDef = (a as { is_definitive?: boolean }).is_definitive === true;
      if (a.finished_at) {
        if (isDef) cur.definitiveFinished++;
        else cur.practiceFinished++;
      }
      const score = a.score ?? 0;
      if (score > cur.bestScore) {
        cur.bestAttemptId = a.id;
        cur.bestScore = score;
      }
      byExam.set(a.exam_id, cur);
    }

    const maxAttemptsByExam = new Map(exams.map((e) => [e.id, (e as { max_attempts?: number }).max_attempts ?? 1]));
    const extraCounts = await Promise.all(
      exams.map(async (e) => {
        const n = await examService.getExtraAttemptsCount(e.id, req.user!.id);
        return { examId: e.id, extra: n };
      })
    );
    const extraByExam = new Map(extraCounts.map((x) => [x.examId, x.extra]));

    res.json(
      exams.map((e) => {
        const summary = byExam.get(e.id)!;
        const practiceMax = maxAttemptsByExam.get(e.id) ?? 1;
        const definitiveMax = 1;
        const extra = extraByExam.get(e.id) ?? 0;
        const enabledForDefinitive = enabledDefinitiveIds.has(e.id);
        const canPractice = summary.practiceFinished < practiceMax;
        const canTakeDefinitive = enabledForDefinitive && summary.definitiveFinished < definitiveMax + extra;
        const canRetry = canPractice || canTakeDefinitive;
        return {
          ...e,
          attemptId: summary.bestAttemptId,
          attempted: summary.practiceFinished > 0 || summary.definitiveFinished > 0,
          completed: summary.definitiveFinished > 0,
          bestScore: summary.bestScore,
          practiceAttemptsUsed: summary.practiceFinished,
          practiceMaxAttempts: practiceMax,
          definitiveAttemptsUsed: summary.definitiveFinished,
          definitiveMaxAttempts: definitiveMax + extra,
          enabledForDefinitive,
          canPractice,
          canTakeDefinitive,
          canRetry,
        };
      })
    );
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post(
  '/exams/:id/start',
  [param('id').isUUID(), body('definitive').optional().isBoolean()],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user?.courseId || !req.user?.id) {
      res.status(400).json({ error: 'No course assigned' });
      return;
    }
    const examId = req.params.id;
    const definitive = req.body.definitive === true;
    const exams = await examService.listExamsForCourse(req.user.courseId);
    const exam = exams.find((e) => e.id === examId);
    if (!exam) {
      res.status(403).json({ error: 'Exam not available for your course' });
      return;
    }
    const practiceMaxAttempts = (exam as { max_attempts?: number }).max_attempts ?? 1;
    const extraAttempts = await examService.getExtraAttemptsCount(examId, req.user.id);

    try {
      const unfinished = await examService.getUnfinishedAttempt(examId, req.user.id);
      if (unfinished) {
        const examData = await examService.getExamForStudent(examId);
        res.status(200).json({ attemptId: unfinished.id, ...examData, isDefinitive: definitive });
        return;
      }

      if (definitive) {
        const cohortId = req.user.cohortId;
        if (!cohortId) {
          res.status(400).json({ error: 'No cohort assigned' });
          return;
        }
        const enabledIds = await examService.getEnabledDefinitiveExamIdsForCohort(cohortId);
        if (!enabledIds.has(examId)) {
          res.status(403).json({ error: 'Examen definitivo no habilitado para tu curso en este momento.' });
          return;
        }
        const definitiveCount = await examService.countFinishedAttemptsByType(examId, req.user.id, true);
        if (definitiveCount >= 1 + extraAttempts) {
          res.status(400).json({ error: 'no_more_attempts', message: 'Ya usaste todos los intentos del examen definitivo.' });
          return;
        }
        const attempt = await examService.createAttempt(examId, req.user.id, true);
        const examData = await examService.getExamForStudent(examId);
        res.status(201).json({ attemptId: attempt.id, ...examData, isDefinitive: true });
      } else {
        const practiceCount = await examService.countFinishedAttemptsByType(examId, req.user.id, false);
        if (practiceCount >= practiceMaxAttempts) {
          res.status(400).json({ error: 'no_more_attempts', message: 'Ya usaste todos los intentos de práctica. Habilitarán el examen definitivo cuando corresponda.' });
          return;
        }
        const attempt = await examService.createAttempt(examId, req.user.id, false);
        const examData = await examService.getExamForStudent(examId);
        res.status(201).json({ attemptId: attempt.id, ...examData, isDefinitive: false });
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }
);

router.post(
  '/attempts/:attemptId/submit',
  [
    param('attemptId').isUUID(),
    body('answers').isArray(),
    body('answers.*.questionId').isUUID(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { attemptId } = req.params;
    const answers = req.body.answers as { questionId: string; optionId?: string; textAnswer?: string }[];
    try {
      const result = await examService.submitAttempt(attemptId, req.user.id, answers);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }
);

router.get('/exams/:id/my-attempt', [param('id').isUUID()], async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty() || !req.user?.id) {
    res.status(400).json({ error: 'Invalid request' });
    return;
  }
  try {
    const attemptId = await examService.getBestAttemptIdForUserExam(req.params.id, req.user.id);
    if (!attemptId) {
      res.status(404).json({ error: 'No attempt found' });
      return;
    }
    res.json({ attemptId });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get(
  '/attempts/:attemptId/result',
  [param('attemptId').isUUID()],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    try {
      const result = await examService.getAttemptResult(req.params.attemptId, req.user.id);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }
);

router.get(
  '/attempts/:attemptId/detail',
  [param('attemptId').isUUID()],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    try {
      const detail = await examService.getAttemptDetailForStudent(req.params.attemptId, req.user.id);
      res.json(detail);
    } catch (e) {
      res.status(404).json({ error: (e as Error).message });
    }
  }
);

router.get('/results', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  try {
    const results = await examService.getUserExamResults(req.user.id);
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/progress', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.courseId || !req.user?.id) {
    res.status(400).json({ error: 'No course assigned' });
    return;
  }
  try {
    const [subjects, examResults] = await Promise.all([
      studentService.listSubjectsByCourse(req.user.courseId),
      examService.getUserExamResults(req.user.id),
    ]);
    const completedExams = examResults.filter((r) => r.passed).length;
    res.json({
      subjectsTotal: subjects.length,
      examsCompleted: completedExams,
      examResultsTotal: examResults.length,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// --- Asistencia: registro automático al entrar a la plataforma ---
router.post('/attendance/check-in', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  try {
    await attendanceService.recordCheckIn(req.user.id);
    res.json({ ok: true, message: 'Asistencia registrada' });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// --- Notifications (avisos) ---
router.get('/notifications', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  try {
    const list = await notificationService.listNotificationsForStudent(req.user.id, req.user.cohortId ?? null);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/notifications/unread-count', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  try {
    const count = await notificationService.getUnreadCount(req.user.id, req.user.cohortId ?? null);
    res.json({ count });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/notifications/:id/read', [param('id').isUUID()], async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty() || !req.user?.id) {
    res.status(400).json({ error: 'Invalid request' });
    return;
  }
  try {
    await notificationService.markAsRead(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
