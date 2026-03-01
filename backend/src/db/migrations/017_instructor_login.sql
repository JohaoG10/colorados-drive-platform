-- Rol 'instructor' en user_profiles y vínculo con tabla instructors para acceso con correo y contraseña.
-- Ejecutar en Supabase SQL Editor.

-- 1) Columna instructor_id en user_profiles (nullable; solo se usa cuando role = 'instructor')
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES public.instructors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_instructor ON public.user_profiles(instructor_id);

-- 2) Permitir rol 'instructor' en el CHECK de role
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'student', 'instructor'));

COMMENT ON COLUMN public.user_profiles.instructor_id IS 'Cuando role=instructor, vincula este perfil con la fila en instructors para acceso al cuadro semanal.';
