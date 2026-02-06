-- Timer (duración en minutos) y cantidad de intentos por examen.
-- Se permite múltiples intentos por usuario; reportes y nota usan el mejor intento.

-- Campos en exámenes
ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS duration_minutes INT,
  ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 1;

-- Quitar restricción UNIQUE(exam_id, user_id) para permitir varios intentos por usuario
-- (el nombre puede variar; se busca y se elimina)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'exam_attempts' AND c.contype = 'u'
  ) LOOP
    EXECUTE format('ALTER TABLE exam_attempts DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- Índice para contar intentos por usuario y examen
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_user ON exam_attempts(exam_id, user_id);

COMMENT ON COLUMN exams.duration_minutes IS 'Tiempo límite en minutos para rendir el examen; NULL = sin límite';
COMMENT ON COLUMN exams.max_attempts IS 'Número máximo de intentos permitidos por usuario';
