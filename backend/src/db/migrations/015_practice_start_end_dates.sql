-- Fechas de inicio y término de prácticas para saber en qué semana está cada alumno (semana 1, 2 o 3).
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS practice_start_date DATE,
  ADD COLUMN IF NOT EXISTS practice_end_date DATE;

COMMENT ON COLUMN public.user_profiles.practice_start_date IS 'Fecha de inicio de las prácticas de conducción';
COMMENT ON COLUMN public.user_profiles.practice_end_date IS 'Fecha de término de las prácticas de conducción';
