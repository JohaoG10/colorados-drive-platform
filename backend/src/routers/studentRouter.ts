import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { requireStudent } from '../middleware/rbac';
import * as studentService from '../services/studentService';
import * as examService from '../services/examService';
import * as notificationService from '../services/notificationService';
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
    const { data: attempts } = await supabaseAdmin
      .from('exam_attempts')
      .select('exam_id, id, score, finished_at')
      .eq('user_id', req.user.id)
      .in('exam_id', examIds);

    const byExam = new Map<string, { bestAttemptId: string; bestScore: number; finishedCount: number }>();
    for (const a of attempts || []) {
      const cur = byExam.get(a.exam_id) || { bestAttemptId: a.id, bestScore: a.score ?? 0, finishedCount: 0 };
      if (a.finished_at) cur.finishedCount++;
      if ((a.score ?? 0) > cur.bestScore) {
        cur.bestAttemptId = a.id;
        cur.bestScore = a.score ?? 0;
      }
      byExam.set(a.exam_id, cur);
    }

    const maxAttemptsByExam = new Map(exams.map((e) => [e.id, (e as { max_attempts?: number }).max_attempts ?? 1]));
    res.json(
      exams.map((e) => {
        const summary = byExam.get(e.id);
        const maxAttempts = maxAttemptsByExam.get(e.id) ?? 1;
        const finishedCount = summary?.finishedCount ?? 0;
        const canRetry = finishedCount < maxAttempts;
        return {
          ...e,
          attemptId: summary?.bestAttemptId,
          attempted: (summary?.finishedCount ?? 0) > 0,
          completed: (summary?.finishedCount ?? 0) > 0,
          bestScore: summary?.bestScore,
          attemptsUsed: finishedCount,
          maxAttempts,
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
  [param('id').isUUID()],
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
    const exams = await examService.listExamsForCourse(req.user.courseId);
    const exam = exams.find((e) => e.id === examId);
    if (!exam) {
      res.status(403).json({ error: 'Exam not available for your course' });
      return;
    }
    const maxAttempts = (exam as { max_attempts?: number }).max_attempts ?? 1;
    try {
      const unfinished = await examService.getUnfinishedAttempt(examId, req.user.id);
      if (unfinished) {
        const examData = await examService.getExamForStudent(examId);
        res.status(200).json({ attemptId: unfinished.id, ...examData });
        return;
      }
      const finishedCount = await examService.countFinishedAttempts(examId, req.user.id);
      if (finishedCount >= maxAttempts) {
        res.status(400).json({ error: 'no_more_attempts', message: 'Ya usaste todos los intentos permitidos para este examen.' });
        return;
      }
      const attempt = await examService.createAttempt(examId, req.user.id);
      const examData = await examService.getExamForStudent(examId);
      res.status(201).json({ attemptId: attempt.id, ...examData });
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
