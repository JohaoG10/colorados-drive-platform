-- Add file_url to contents and image_url to questions
-- Run in Supabase SQL Editor if you already have the base schema

ALTER TABLE contents ADD COLUMN IF NOT EXISTS file_url VARCHAR(500);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
