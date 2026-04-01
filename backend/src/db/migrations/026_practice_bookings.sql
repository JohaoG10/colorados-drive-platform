-- Inscripciones de práctica para personas externas o alumnos.
-- Esta migración es compatible con instalaciones nuevas y con tablas antiguas.

CREATE TABLE IF NOT EXISTS public.practice_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID REFERENCES public.instructors(id) ON DELETE CASCADE,
  start_time TIME,
  participant_name VARCHAR(150) NOT NULL,
  participant_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  practice_start_date DATE NOT NULL,
  practice_end_date DATE NOT NULL,
  practice_hours_per_day SMALLINT NOT NULL DEFAULT 1 CHECK (practice_hours_per_day >= 1 AND practice_hours_per_day <= 4),
  schedule_type VARCHAR(20) NOT NULL CHECK (schedule_type IN ('weekdays', 'weekends')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (practice_end_date >= practice_start_date)
);

-- Si viene de una versión vieja (con schedule_id), agregar columnas nuevas.
ALTER TABLE public.practice_bookings
  ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES public.instructors(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS start_time TIME;

-- Backfill desde course_schedules cuando exista schedule_id.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'practice_bookings'
      AND column_name = 'schedule_id'
  ) THEN
    UPDATE public.practice_bookings pb
    SET
      instructor_id = cs.instructor_id,
      start_time = cs.start_time
    FROM public.course_schedules cs
    WHERE pb.schedule_id = cs.id
      AND (pb.instructor_id IS NULL OR pb.start_time IS NULL);
  END IF;
END $$;

-- Endurecer restricciones cuando ya hay datos migrados.
ALTER TABLE public.practice_bookings
  ALTER COLUMN instructor_id SET NOT NULL,
  ALTER COLUMN start_time SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_practice_bookings_instructor ON public.practice_bookings(instructor_id);
CREATE INDEX IF NOT EXISTS idx_practice_bookings_dates ON public.practice_bookings(practice_start_date, practice_end_date);
