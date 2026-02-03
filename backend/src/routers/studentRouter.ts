import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { requireStudent } from '../middleware/rbac';
import * as studentService from '../services/studentService';
import * as examService from '../services/examService';
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
    const attemptMap = new Map<string, { id: string; finished: boolean }>();
    const { data: attempts } = await supabaseAdmin
      .from('exam_attempts')
      .select('exam_id, id, finished_at')
      .eq('user_id', req.user.id);
    (attempts || []).forEach((a) => {
      attemptMap.set(a.exam_id, { id: a.id, finished: !!a.finished_at });
    });
    res.json(
      exams.map((e) => ({
        ...e,
        attemptId: attemptMap.get(e.id)?.id,
        attempted: !!attemptMap.get(e.id),
        completed: attemptMap.get(e.id)?.finished ?? false,
      }))
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
    if (!exams.some((e) => e.id === examId)) {
      res.status(403).json({ error: 'Exam not available for your course' });
      return;
    }
    try {
      const existing = await examService.getExistingAttempt(examId, req.user.id);
      if (existing) {
        if (existing.finished_at) {
          res.status(400).json({ error: 'already attempted' });
          return;
        }
        const examData = await examService.getExamForStudent(examId);
        res.status(200).json({ attemptId: existing.id, ...examData });
        return;
      }
      const attempt = await examService.createAttempt(examId, req.user.id);
      const examData = await examService.getExamForStudent(examId);
      res.status(201).json({ attemptId: attempt.id, ...examData });
    } catch (e) {
      const msg = (e as Error).message;
      const isDuplicate = /duplicate key|unique constraint.*exam_attempts_exam_id_user_id/i.test(msg);
      if (isDuplicate) {
        try {
          const existing = await examService.getExistingAttempt(examId, req.user.id);
          if (existing) {
            if (existing.finished_at) {
              res.status(400).json({ error: 'already attempted' });
              return;
            }
            const examData = await examService.getExamForStudent(examId);
            res.status(200).json({ attemptId: existing.id, ...examData });
            return;
          }
        } catch {
          // fallback
        }
      }
      res.status(500).json({ error: msg.includes('duplicate') || msg.includes('unique constraint') ? 'already attempted' : msg });
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
    const { data } = await supabaseAdmin
      .from('exam_attempts')
      .select('id')
      .eq('exam_id', req.params.id)
      .eq('user_id', req.user.id)
      .not('finished_at', 'is', null)
      .maybeSingle();
    if (!data) {
      res.status(404).json({ error: 'No attempt found' });
      return;
    }
    res.json({ attemptId: data.id });
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

export default router;
