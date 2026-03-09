-- Horas de práctica por día: 1, 2, 3 o 4 horas consecutivas por día para cada estudiante.
-- Permite asignar bloques reales (ej. 16:00-18:00) y calcular disponibilidad correctamente.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS practice_hours_per_day SMALLINT NOT NULL DEFAULT 1
  CHECK (practice_hours_per_day >= 1 AND practice_hours_per_day <= 4);

COMMENT ON COLUMN public.user_profiles.practice_hours_per_day IS 'Horas consecutivas de práctica por día (1-4). Por defecto 1.';
