-- Cohorts (promociones) - e.g. "Tipo B - Carro 200"
CREATE TABLE IF NOT EXISTS cohorts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cohorts_course ON cohorts(course_id);

-- Add cohort_id to user_profiles (students can be in a specific cohort)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_cohort ON user_profiles(cohort_id);
