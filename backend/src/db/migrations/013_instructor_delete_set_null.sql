-- Permitir eliminar instructores: los horarios (course_schedules) quedan sin asignar en lugar de bloquear el delete.
-- Ejecutar en Supabase SQL Editor.

-- 1) Permitir NULL en instructor_id (los slots pueden quedar "sin instructor" hasta reasignar)
ALTER TABLE public.course_schedules
  ALTER COLUMN instructor_id DROP NOT NULL;

-- 2) Quitar la FK que tiene ON DELETE RESTRICT
ALTER TABLE public.course_schedules
  DROP CONSTRAINT IF EXISTS course_schedules_instructor_id_fkey;

-- 3) Volver a crear la FK con ON DELETE SET NULL
ALTER TABLE public.course_schedules
  ADD CONSTRAINT course_schedules_instructor_id_fkey
  FOREIGN KEY (instructor_id) REFERENCES public.instructors(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.course_schedules.instructor_id IS 'Puede ser NULL si el instructor fue eliminado; el horario queda disponible para reasignar.';
