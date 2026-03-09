-- Mismo examen para práctica y definitivo: cada intento se marca como práctica o definitivo.
-- Los estudiantes practican con el mismo banco; el día del examen se habilita el definitivo para su cohort.
ALTER TABLE exam_attempts
  ADD COLUMN IF NOT EXISTS is_definitive BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_exam_attempts_definitive ON exam_attempts(exam_id, user_id, is_definitive);

COMMENT ON COLUMN exam_attempts.is_definitive IS 'true = intento definitivo (día del examen); false = práctica';
