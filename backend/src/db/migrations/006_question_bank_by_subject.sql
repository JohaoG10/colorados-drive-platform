-- Banco de preguntas por materia: preguntas se vinculan a subject_id
-- Las preguntas del banco tienen subject_id; exámenes por curso mantienen exam_id

ALTER TABLE questions ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE;

-- IMPORTANTE: Hacer exam_id nullable ANTES de asignar NULL
ALTER TABLE questions ALTER COLUMN exam_id DROP NOT NULL;

-- Migrar preguntas existentes: si el examen tiene subject_id, mover al banco de la materia
UPDATE questions q
SET subject_id = e.subject_id, exam_id = NULL
FROM exams e
WHERE q.exam_id = e.id
  AND e.subject_id IS NOT NULL;

-- Restricción: cada pregunta tiene subject_id (banco) O exam_id (examen por curso)
-- No añadimos CHECK para permitir migración gradual

CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject_id);
