-- Respuesta abierta con varias partes (a, b, c, d...)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS open_text_parts INT NOT NULL DEFAULT 1;
