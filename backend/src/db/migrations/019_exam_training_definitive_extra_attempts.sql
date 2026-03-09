-- Tipo de examen: entrenamiento (siempre visible para practicar) o definitivo (habilitado por cohort)
ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS exam_kind VARCHAR(20) NOT NULL DEFAULT 'training'
    CHECK (exam_kind IN ('training', 'definitive'));

COMMENT ON COLUMN exams.exam_kind IS 'training = práctica siempre disponible; definitive = habilitado por cohort para rendir';

-- Habilitación del examen definitivo por número de curso (cohort)
CREATE TABLE IF NOT EXISTS exam_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(exam_id, cohort_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_availability_exam ON exam_availability(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_availability_cohort ON exam_availability(cohort_id);

COMMENT ON TABLE exam_availability IS 'Exámenes definitivos habilitados por cohort; solo esos estudiantes pueden rendir';

-- Intentos extra concedidos por el admin (ej. supletorio)
CREATE TABLE IF NOT EXISTS exam_extra_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_exam_extra_attempts_exam_user ON exam_extra_attempts(exam_id, user_id);

COMMENT ON TABLE exam_extra_attempts IS 'Intentos adicionales concedidos por administrador (supletorio, etc.)';
