import { Request } from 'express';

export type UserRole = 'admin' | 'student';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  courseId: string | null;
  cohortId: string | null;
  fullName: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
