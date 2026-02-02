import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';

/**
 * Restricts route to admin only.
 */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

/**
 * Restricts route to students only.
 */
export function requireStudent(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'student') {
    res.status(403).json({ error: 'Student access required' });
    return;
  }
  next();
}
