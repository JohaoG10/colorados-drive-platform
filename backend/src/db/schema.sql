-- Colorados Drive - Database Schema for Supabase
-- Run this in Supabase SQL Editor to create tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Courses (price = precio del tipo de curso, ej. Tipo A, Tipo B)
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subjects (materias)
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contents
CREATE TABLE IF NOT EXISTS contents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  external_link VARCHAR(500),
  file_url VARCHAR(500),
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- User profiles (links to auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(150),
  cedula VARCHAR(20),
  role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL,
  must_change_password BOOLEAN DEFAULT false,
  total_amount DECIMAL(10,2),
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  birth_date DATE,
  address TEXT,
  phone VARCHAR(50),
  start_date DATE,
  end_date DATE,
  modality VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_cedula ON user_profiles(cedula);

-- Exams
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  question_count INT NOT NULL DEFAULT 10,
  passing_score DECIMAL(5,2) DEFAULT 70.00,
  duration_minutes INT,
  max_attempts INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT exam_scope CHECK (
    (subject_id IS NOT NULL AND course_id IS NULL) OR
    (subject_id IS NULL AND course_id IS NOT NULL)
  )
);

-- Questions (banco por materia: subject_id; exámenes por curso: exam_id)
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  image_url VARCHAR(500),
  order_index INT DEFAULT 0,
  type VARCHAR(20) NOT NULL DEFAULT 'multiple_choice',
  correct_answer_text TEXT,
  open_text_parts INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject_id);

-- Options (4 per question, 1 correct)
CREATE TABLE IF NOT EXISTS options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  order_index INT DEFAULT 0
);

-- Exam attempts (múltiples por usuario y examen; reportes usan el mejor intento)
CREATE TABLE IF NOT EXISTS exam_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score DECIMAL(5,2),
  passed BOOLEAN,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- Attempt answers (option_id for multiple_choice, text_answer for open_text)
CREATE TABLE IF NOT EXISTS attempt_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_id UUID REFERENCES options(id) ON DELETE SET NULL,
  text_answer TEXT,
  is_correct BOOLEAN
);

-- User activity
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  total_time_seconds INT DEFAULT 0,
  contents_viewed JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Content views (for tracking what user has seen)
CREATE TABLE IF NOT EXISTS content_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_id)
);

-- Indexes
CREATE INDEX idx_subjects_course ON subjects(course_id);
CREATE INDEX idx_contents_subject ON contents(subject_id);
CREATE INDEX idx_exams_subject ON exams(subject_id);
CREATE INDEX idx_exams_course ON exams(course_id);
CREATE INDEX idx_questions_exam ON questions(exam_id);
CREATE INDEX idx_options_question ON options(question_id);
CREATE INDEX idx_exam_attempts_user ON exam_attempts(user_id);
CREATE INDEX idx_exam_attempts_exam ON exam_attempts(exam_id);
CREATE INDEX idx_exam_attempts_exam_user ON exam_attempts(exam_id, user_id);
CREATE INDEX idx_user_profiles_course ON user_profiles(course_id);
CREATE INDEX idx_cohorts_course ON cohorts(course_id);
CREATE INDEX idx_user_profiles_cohort ON user_profiles(cohort_id);

-- Notifications (avisos por cohorte)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL,
  body TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(notification_id, user_id)
);

CREATE INDEX idx_notifications_cohort ON notifications(cohort_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notification_reads_user ON notification_reads(user_id);
CREATE INDEX idx_notification_reads_notification ON notification_reads(notification_id);

-- Instructors (todos disponibles 6am - 11pm)
CREATE TABLE IF NOT EXISTS instructors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(30),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Course schedules: un registro = un slot ocupado (cohort + instructor + día + hora entera 6-23). instructor_id puede ser NULL si se eliminó el instructor.
CREATE TABLE IF NOT EXISTS course_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES instructors(id) ON DELETE SET NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  start_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT course_schedule_hour_only CHECK (
    start_time >= '06:00' AND start_time <= '23:00'
    AND EXTRACT(MINUTE FROM start_time) = 0 AND EXTRACT(SECOND FROM start_time) = 0
  ),
  UNIQUE(cohort_id, instructor_id, day_of_week, start_time)
);

CREATE INDEX idx_course_schedules_cohort ON course_schedules(cohort_id);
CREATE INDEX idx_course_schedules_instructor ON course_schedules(instructor_id);

-- Schedule groups: horario semanal (Lunes a Viernes o Fines de semana) por cohort + instructor + hora
CREATE TABLE IF NOT EXISTS schedule_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('weekdays', 'weekends')),
  start_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cohort_id, instructor_id, type, start_time)
);
CREATE INDEX IF NOT EXISTS idx_schedule_groups_cohort ON schedule_groups(cohort_id);
CREATE INDEX IF NOT EXISTS idx_schedule_groups_instructor ON schedule_groups(instructor_id);

ALTER TABLE course_schedules ADD COLUMN IF NOT EXISTS schedule_group_id UUID REFERENCES schedule_groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_course_schedules_group ON course_schedules(schedule_group_id);

-- User profile extensions
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS citizenship VARCHAR(100),
  ADD COLUMN IF NOT EXISTS blood_type VARCHAR(10),
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES course_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS practice_weeks SMALLINT CHECK (practice_weeks IS NULL OR practice_weeks IN (1, 2, 3)),
  ADD COLUMN IF NOT EXISTS practice_start_date DATE,
  ADD COLUMN IF NOT EXISTS practice_end_date DATE;

CREATE INDEX IF NOT EXISTS idx_user_profiles_schedule ON user_profiles(schedule_id);

-- Override de horario un día (cambio solo ese día de la semana)
CREATE TABLE IF NOT EXISTS user_schedule_day_override (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  course_schedule_id UUID NOT NULL REFERENCES course_schedules(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, day_of_week)
);
CREATE INDEX IF NOT EXISTS idx_user_schedule_override_user ON user_schedule_day_override(user_id);
CREATE INDEX IF NOT EXISTS idx_user_schedule_override_schedule ON user_schedule_day_override(course_schedule_id);

-- Payments (abonos por alumno)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at DESC);

-- Attendance (asistencia por estudiante y día)
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'excused')),
  source VARCHAR(20) NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'manual')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);