import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';

/**
 * Requiere que el usuario autenticado sea instructor.
 * Debe usarse después de authMiddleware.
 */
export function requireInstructor(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }
  if (req.user.role !== 'instructor' || !req.user.instructorId) {
    res.status(403).json({ error: 'Acceso solo para instructores' });
    return;
  }
  next();
}
