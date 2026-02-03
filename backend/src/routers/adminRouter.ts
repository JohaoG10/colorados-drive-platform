import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin } from '../middleware/rbac';
import { uploadSingle } from '../middleware/upload';
import { createUser, deleteUser, updateUserProfile } from '../services/authService';
import * as adminService from '../services/adminService';
import * as examService from '../services/examService';
import { uploadFile } from '../services/uploadService';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authMiddleware, requireAdmin);

router.post(
  '/users',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('fullName').trim().notEmpty(),
    body('role').isIn(['admin', 'student']),
    body('cohortId').optional().isUUID(),
    body('cedula').optional().trim().isString(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password, fullName, role, cohortId, cedula } = req.body;

    if (role === 'student' && !cohortId) {
      res.status(400).json({ error: 'Para estudiante selecciona un curso (Curso Tipo A/B Nro X). Créalo antes en Reportes por curso.' });
      return;
    }

    const result = await createUser({
      email,
      password,
      fullName,
      role,
      courseId: null,
      cohortId: role === 'student' ? cohortId : null,
      cedula: cedula?.trim() || null,
      mustChangePassword: true,
    });

    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.status(201).json({ userId: result.userId, message: 'User created successfully' });
  }
);

router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  const courseId = req.query.courseId as string | undefined;
  const cohortId = req.query.cohortId as string | undefined;
  const role = req.query.role as string | undefined;
  const search = req.query.search as string | undefined; // busca por cédula, nombre o email

  try {
    const users = await adminService.listUsers({ courseId, cohortId, role, search });
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/users/:id/activity', [param('id').isUUID()], async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  try {
    const { getActivity } = await import('../services/activityService');
    const activity = await getActivity(req.params.id);
    res.json(activity || { last_active_at: null, total_time_seconds: 0, contents_viewed: [] });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.delete('/users/:id', [param('id').isUUID()], async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  const result = await deleteUser(req.params.id);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ message: 'User deleted' });
});

router.patch(
  '/users/:id',
  [
    param('id').isUUID(),
    body('fullName').optional().trim().notEmpty(),
    body('role').optional().isIn(['admin', 'student']),
    body('cohortId').optional().isUUID(),
    body('cedula').optional().trim().isString(),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const { fullName, role, cohortId, cedula, password } = req.body;
    if (role === 'student' && !cohortId) {
      res.status(400).json({ error: 'Para estudiante selecciona un curso (Curso Tipo A/B Nro X)' });
      return;
    }
    const result = await updateUserProfile(req.params.id, {
      fullName,
      role,
      courseId: null,
      cohortId: cohortId ?? null,
      cedula: cedula !== undefined ? (cedula?.trim() || null) : undefined,
      password,
    });
    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ message: 'User updated' });
  }
);

router.get('/courses', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const courses = await adminService.listCourses();
    res.json(courses);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post(
  '/courses',
  [body('name').trim().notEmpty(), body('code').trim().notEmpty().isLength({ max: 20 })],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    try {
      const course = await adminService.createCourse(req.body.name, req.body.code);
      res.status(201).json(course);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }
);

router.delete('/courses/:id', [param('id').isUUID()], async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  try {
    await adminService.deleteCourse(req.params.id);
    res.json({ message: 'Course deleted' });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/cohorts', async (req: AuthenticatedRequest, res: Response) => {
  const courseId = req.query.courseId as string | undefined;
  try {
    const cohorts = await adminService.listCohorts(courseId);
    res.json(cohorts);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post(
  '/cohorts',
  [body('courseId').isUUID(), body('name').trim().notEmpty(), body('code').trim().notEmpty()],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    try {
      const cohort = await adminService.createCohort(req.body.courseId, req.body.name, req.body.code);
      res.status(201).json(cohort);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }
);

router.delete('/cohorts/:id', [param('id').isUUID()], async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  const deleteUsers = req.query.deleteUsers === 'true';
  try {
    if (deleteUsers) {
      const result = await adminService.deleteCohortWithUsers(req.params.id);
      res.json({ message: 'Cohort and all its users deleted', deletedUsers: result.deletedUsers });
    } else {
      await adminService.deleteCohort(req.params.id);
      res.json({ message: 'Cohort deleted (users unassigned)' });
    }
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/cohorts/:id/report', [param('id').isUUID()], async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  try {
    const { getCohortReport } = await import('../services/reportService');
    const report = await getCohortReport(req.params.id);
    res.json(report);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/upload', (req: AuthenticatedRequest, res: Response) => {
  uploadSingle(req, res, async (err: unknown) => {
    if (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
      return;
    }
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const folder = (req.query.folder as string) || 'contents';
    if (folder !== 'contents' && folder !== 'questions') {
      res.status(400).json({ error: 'Invalid folder. Use contents or questions.' });
      return;
    }
    try {
      const url = await uploadFile(file, folder);
      res.json({ url });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });
});

router.post(
  '/subjects',
  [body('courseId').isUUID(), body('name').trim().notEmpty(), body('orderIndex').optional().isInt()],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const subject = await adminService.createSubject(
        req.body.courseId,
        req.body.name,
        req.body.orderIndex ?? 0
      );
      res.status(201).json(subject);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }
);

router.get('/subjects', async (req: AuthenticatedRequest, res: Response) => {
  const courseId = req.query.courseId as string | undefined;
  try {
    const subjects = await adminService.listSubjects(courseId);
    res.json(subjects);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.delete('/subjects/:id', [param('id').isUUID()], async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  try {
    await adminService.deleteSubject(req.params.id);
    res.json({ message: 'Subject deleted' });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.delete('/contents/:id', [param('id').isUUID()], async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  try {
    await adminService.deleteContent(req.params.id);
    res.json({ message: 'Content deleted' });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/subjects/:subjectId/contents', [param('subjectId').isUUID()], async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  try {
    const contents = await adminService.listContentsBySubject(req.params.subjectId);
    res.json(contents);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post(
  '/contents',
  [
    body('subjectId').isUUID(),
    body('title').trim().notEmpty(),
    body('body').optional().isString(),
    body('externalLink').optional().isURL(),
    body('fileUrl').optional().isURL(),
    body('orderIndex').optional().isInt(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const content = await adminService.createContent(req.body.subjectId, {
        title: req.body.title,
        body: req.body.body,
        externalLink: req.body.externalLink,
        fileUrl: req.body.fileUrl,
        orderIndex: req.body.orderIndex,
      });
      res.status(201).json(content);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }
);

// --- Exams ---
router.post(
  '/exams',
  [
    body('title').trim().notEmpty(),
    body('subjectId').optional().isUUID(),
    body('courseId').optional().isUUID(),
    body('description').optional().isString(),
    body('questionCount').isInt({ min: 1 }),
    body('passingScore').optional().isFloat({ min: 0, max: 100 }),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const { subjectId, courseId } = req.body;
    if ((!subjectId && !courseId) || (subjectId && courseId)) {
      res.status(400).json({ error: 'Provide either subjectId or courseId' });
      return;
    }
    try {
      const exam = await examService.createExam({
        subjectId,
        courseId,
        title: req.body.title,
        description: req.body.description,
        questionCount: req.body.questionCount,
        passingScore: req.body.passingScore,
      });
      res.status(201).json(exam);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }
);

router.get('/exams/:id/questions', [param('id').isUUID()], async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  try {
    const exam = await examService.getExamWithQuestions(req.params.id);
    res.json(exam);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.delete('/questions/:id', [param('id').isUUID()], async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  try {
    await examService.deleteQuestion(req.params.id);
    res.json({ message: 'Question deleted' });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post(
  '/exams/:id/questions',
  [
    param('id').isUUID(),
    body('questionText').trim().notEmpty(),
    body('imageUrl').optional().isURL(),
    body('type').optional().isIn(['multiple_choice', 'open_text']),
    body('correctAnswerText').optional().isString(),
    body('correctAnswerParts').optional().isArray(),
    body('options').optional().isArray(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const type = req.body.type || 'multiple_choice';
    const opts = (req.body.options || []) as { text: string; isCorrect: boolean }[];
    if (type === 'multiple_choice') {
      if (opts.length < 2 || opts.length > 6) {
        res.status(400).json({ error: 'Opción múltiple requiere entre 2 y 6 opciones' });
        return;
      }
      const correctCount = opts.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        res.status(400).json({ error: 'Marca exactamente una opción correcta' });
        return;
      }
    }
    try {
      const correctAnswerParts = type === 'open_text' && Array.isArray(req.body.correctAnswerParts)
        ? req.body.correctAnswerParts.map((p: unknown) => String(p ?? '').trim()).filter(Boolean)
        : undefined;
      const question = await examService.addQuestion(req.params.id, {
        questionText: req.body.questionText,
        imageUrl: req.body.imageUrl,
        type,
        correctAnswerText: req.body.correctAnswerText,
        correctAnswerParts: correctAnswerParts?.length ? correctAnswerParts : undefined,
        options: type === 'open_text' ? [] : opts,
      });
      res.status(201).json(question);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }
);

router.get('/exams', async (req: AuthenticatedRequest, res: Response) => {
  const courseId = req.query.courseId as string | undefined;
  try {
    const { supabaseAdmin } = await import('../config/supabase');
    const { data, error } = await supabaseAdmin
      .from('exams')
      .select('id, title, subject_id, course_id, question_count, passing_score, created_at')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    let exams = data || [];
    if (courseId) {
      const byCourse = exams.filter((e) => e.course_id === courseId);
      const bySubject = exams.filter((e) => e.subject_id && !e.course_id);
      if (bySubject.length) {
        const { data: subjects } = await supabaseAdmin
          .from('subjects')
          .select('id')
          .eq('course_id', courseId)
          .in('id', bySubject.map((e) => e.subject_id).filter(Boolean) as string[]);
        const subjectIds = new Set((subjects || []).map((s) => s.id));
        exams = [...byCourse, ...bySubject.filter((e) => e.subject_id && subjectIds.has(e.subject_id))];
      } else {
        exams = byCourse;
      }
    }
    res.json(exams);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.delete('/exams/:id', [param('id').isUUID()], async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  try {
    await examService.deleteExam(req.params.id);
    res.json({ message: 'Exam deleted' });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/exams/:id/results', [param('id').isUUID()], async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  try {
    const results = await examService.getAdminExamResults(req.params.id);
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/attempts/:attemptId/detail', [param('attemptId').isUUID()], async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  try {
    const detail = await examService.getAttemptDetailForAdmin(req.params.attemptId);
    res.json(detail);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/users/:id/exam-results', [param('id').isUUID()], async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  try {
    const results = await examService.getUserExamResults(req.params.id);
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
