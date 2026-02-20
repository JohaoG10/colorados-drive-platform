-- Campos adicionales para inscripción de estudiantes y reportes
-- Ejecutar en Supabase SQL Editor después de 010.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS modality VARCHAR(30);

COMMENT ON COLUMN public.user_profiles.modality IS 'intensivo, regular, fin de semana';
