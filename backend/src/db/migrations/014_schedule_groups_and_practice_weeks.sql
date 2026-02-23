-- Horarios semanales (Lunes a Viernes o Fines de semana) + duración de práctica (1, 2 o 3 semanas) + cambios por día o resto del curso.
-- Ejecutar en Supabase SQL Editor.

-- 1) Grupos de horario semanal: un grupo = "Lunes a Viernes 06:00" o "Fines de semana 08:00" (cohort + instructor)
CREATE TABLE IF NOT EXISTS public.schedule_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cohort_id UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('weekdays', 'weekends')),
  start_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cohort_id, instructor_id, type, start_time)
);

CREATE INDEX IF NOT EXISTS idx_schedule_groups_cohort ON public.schedule_groups(cohort_id);
CREATE INDEX IF NOT EXISTS idx_schedule_groups_instructor ON public.schedule_groups(instructor_id);

-- 2) Vincular cada slot (course_schedules) a un grupo opcional
ALTER TABLE public.course_schedules
  ADD COLUMN IF NOT EXISTS schedule_group_id UUID REFERENCES public.schedule_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_course_schedules_group ON public.course_schedules(schedule_group_id);

-- 3) Duración de práctica en semanas (1, 2 o 3) por alumno
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS practice_weeks SMALLINT CHECK (practice_weeks IS NULL OR practice_weeks IN (1, 2, 3));

-- 4) Override de horario por día: para un alumno, un día de la semana puede tener otro slot (cambio "solo un día")
CREATE TABLE IF NOT EXISTS public.user_schedule_day_override (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  course_schedule_id UUID NOT NULL REFERENCES public.course_schedules(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_user_schedule_override_user ON public.user_schedule_day_override(user_id);
CREATE INDEX IF NOT EXISTS idx_user_schedule_override_schedule ON public.user_schedule_day_override(course_schedule_id);

COMMENT ON TABLE public.schedule_groups IS 'Horario semanal: weekdays = Lunes a Viernes, weekends = Sábado y Domingo; cada grupo tiene N slots en course_schedules';
COMMENT ON COLUMN public.user_profiles.practice_weeks IS 'Duración de la práctica en semanas: 1, 2 o 3';
COMMENT ON TABLE public.user_schedule_day_override IS 'Cambio de horario solo un día: para ese día de la semana el alumno usa otro slot';
