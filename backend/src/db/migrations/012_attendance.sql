-- Módulo de asistencia: registro por día (entrada a plataforma o marcado manual por admin)
-- Ejecutar en Supabase SQL Editor después de 011.

CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'excused')),
  source VARCHAR(20) NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'manual')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);

COMMENT ON TABLE public.attendance IS 'Asistencia por estudiante y día: presente/ausente/justificado; auto (entró a la plataforma) o manual (admin)';
