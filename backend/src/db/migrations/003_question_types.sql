-- Question types: multiple_choice (default) or open_text
ALTER TABLE questions ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'multiple_choice';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS correct_answer_text TEXT;

-- For open_text questions we store the student's text answer
ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS text_answer TEXT;

-- option_id can be null for open_text questions
-- (existing constraint may require option_id; if so, we rely on ON DELETE SET NULL)
