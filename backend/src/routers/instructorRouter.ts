import { Router, Response } from 'express';
import { param } from 'express-validator';
import { validationResult } from 'express-validator';
import * as scheduleService from '../services/scheduleService';
import { authMiddleware } from '../middleware/auth';
import { requireInstructor } from '../middleware/requireInstructor';
import { AuthenticatedRequest } from '../types';

const router = Router();

router.use(authMiddleware, requireInstructor);

/**
 * GET /api/instructor/availability?weekStart=YYYY-MM-DD&weekEnd=YYYY-MM-DD
 * Disponibilidad del instructor logueado para el calendario semanal (misma forma que admin).
 */
router.get('/availability', async (req: AuthenticatedRequest, res: Response) => {
  const instructorId = req.user?.instructorId;
  if (!instructorId) {
    res.status(403).json({ error: 'Instructor no identificado' });
    return;
  }
  const weekStart = req.query.weekStart as string | undefined;
  const weekEnd = req.query.weekEnd as string | undefined;
  if (!weekStart || !weekEnd) {
    res.status(400).json({ error: 'weekStart y weekEnd son requeridos (YYYY-MM-DD)' });
    return;
  }
  try {
    const availability = await scheduleService.getInstructorAvailabilityForWeek(instructorId, weekStart, weekEnd);
    res.json(availability);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/instructor/schedule
 * Cuadro semanal del instructor: solo sus horarios (solo lectura).
 */
router.get('/schedule', async (req: AuthenticatedRequest, res: Response) => {
  const instructorId = req.user?.instructorId;
  if (!instructorId) {
    res.status(403).json({ error: 'Instructor no identificado' });
    return;
  }
  try {
    const list = await scheduleService.listCourseSchedules(undefined, instructorId);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/instructor/schedule/:scheduleId/students
 * Alumnos asignados a un slot. Solo si el slot pertenece al instructor.
 */
router.get(
  '/schedule/:scheduleId/students',
  [param('scheduleId').isUUID()],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const instructorId = req.user?.instructorId;
    if (!instructorId) {
      res.status(403).json({ error: 'Instructor no identificado' });
      return;
    }
    try {
      const detail = await scheduleService.getScheduleWithStudents(req.params.scheduleId);
      const schedule = detail as { instructor_id?: string };
      if (schedule.instructor_id !== instructorId) {
        res.status(404).json({ error: 'Horario no encontrado' });
        return;
      }
      res.json(detail);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }
);

export default router;
