import { Response, NextFunction } from 'express';
import { supabaseAdmin, supabaseAnon } from '../config/supabase';
import { AuthUser, AuthenticatedRequest } from '../types';

/**
 * Verifies JWT via Supabase Auth API (no JWT_SECRET needed).
 * Loads user profile from user_profiles.
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  try {
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authUser) {
      res.status(401).json({
        error: authError?.message?.toLowerCase().includes('expired')
          ? 'Sesión expirada. Cierra sesión e inicia de nuevo.'
          : 'Token inválido. Cierra sesión e inicia de nuevo.',
      });
      return;
    }

    const userId = authUser.id;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, full_name, role, course_id, cohort_id, cohorts(course_id)')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      res.status(401).json({ error: 'Perfil de usuario no encontrado. Contacta al administrador.' });
      return;
    }

    const courseId = profile.course_id
      ?? (profile.cohorts as { course_id?: string } | null)?.course_id
      ?? null;
    const cohortId = profile.cohort_id ?? null;

    req.user = {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name || '',
      role: profile.role as AuthUser['role'],
      courseId,
      cohortId,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Error de autenticación. Cierra sesión e inicia de nuevo.' });
  }
}
