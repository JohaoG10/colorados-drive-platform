-- ============================================================
-- Instructores y horarios por inscripción (6:00 - 23:00, horas enteras)
-- Ejecutar este script en el SQL Editor de Supabase (Dashboard → SQL Editor).
-- ============================================================

-- 1) Tabla instructores (todos disponibles 6am - 11pm por defecto)
CREATE TABLE IF NOT EXISTS public.instructors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(30),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Horarios asignados por curso: un registro = un slot ocupado (cohort + instructor + día + hora)
-- Las horas son de 1 hora: 06:00, 07:00, ... 23:00 (6am a 11pm)
CREATE TABLE IF NOT EXISTS public.course_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cohort_id UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES public.instructors(id) ON DELETE RESTRICT,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  start_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT course_schedule_hour_only CHECK (
    start_time >= '06:00' AND start_time <= '23:00'
    AND EXTRACT(MINUTE FROM start_time) = 0
    AND EXTRACT(SECOND FROM start_time) = 0
  ),
  UNIQUE(cohort_id, instructor_id, day_of_week, start_time)
);

CREATE INDEX IF NOT EXISTS idx_course_schedules_cohort ON public.course_schedules(cohort_id);
CREATE INDEX IF NOT EXISTS idx_course_schedules_instructor ON public.course_schedules(instructor_id);
-- Quitar end_time si existía en versión anterior
ALTER TABLE public.course_schedules DROP COLUMN IF EXISTS end_time;
-- Un slot (cohort + instructor + día + hora) solo puede estar ocupado una vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_course_schedules_slot ON public.course_schedules(cohort_id, instructor_id, day_of_week, start_time);

-- 3) Perfil de usuario: ciudadanía, tipo de sangre y asignación al slot de horario
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS citizenship VARCHAR(100),
  ADD COLUMN IF NOT EXISTS blood_type VARCHAR(10),
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.course_schedules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_schedule ON public.user_profiles(schedule_id);

-- Si existía la tabla anterior de disponibilidad por instructor, se puede eliminar (todos 6-23)
DROP TABLE IF EXISTS public.instructor_availability;

-- Refrescar schema cache en Supabase: Dashboard → Settings → API → "Reload schema cache" (si está disponible).
