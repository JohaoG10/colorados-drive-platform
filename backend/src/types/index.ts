import { Request } from 'express';

export type UserRole = 'admin' | 'student' | 'instructor';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  courseId: string | null;
  cohortId: string | null;
  fullName: string;
  instructorId?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
