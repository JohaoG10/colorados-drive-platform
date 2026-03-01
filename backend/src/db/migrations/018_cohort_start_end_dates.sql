-- Fechas de inicio y término del curso a nivel de número de curso (cohort).
-- Al inscribir un estudiante en un cohort, estas fechas se asocian al usuario.
ALTER TABLE cohorts
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;

COMMENT ON COLUMN cohorts.start_date IS 'Fecha de inicio del curso para este número de curso';
COMMENT ON COLUMN cohorts.end_date IS 'Fecha de término del curso para este número de curso';
