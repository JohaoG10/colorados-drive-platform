-- =============================================================================
-- Migración 024: Habilitar RLS (Row Level Security) en tablas del esquema public
-- =============================================================================
-- OBJETIVO: Resolver avisos "RLS Disabled in Public" de Supabase sin romper la app.
--
-- CONTEXTO:
-- - Todo el acceso a datos desde la aplicación se hace con SERVICE ROLE (backend).
-- - En Supabase, el rol service_role BYPASEA RLS, por tanto el backend sigue
--   funcionando igual después de habilitar RLS.
-- - No se crean políticas en esta migración. Las tablas quedan inaccesibles para
--   anon/authenticated (que es lo deseado); solo el backend con service key tiene
--   acceso efectivo.
--
-- EJECUCIÓN: Supabase SQL Editor, después de 023_practice_hours_per_day.sql
-- Si alguna tabla no existe en tu instancia, comenta o elimina la línea correspondiente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Bloque 1: Tablas críticas de usuarios, auth y perfiles
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
-- Usada en: login, middleware auth, admin, attendance, payments, schedules, exams, caja, reportes

-- -----------------------------------------------------------------------------
-- Bloque 2: Cursos, cohortes, contenidos y materias
-- -----------------------------------------------------------------------------
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contents ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Bloque 3: Instructores y horarios
-- -----------------------------------------------------------------------------
ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_schedule_day_override ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Bloque 4: Asistencia y pagos
-- -----------------------------------------------------------------------------
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Bloque 5: Caja (sesiones, movimientos, auditoría)
-- -----------------------------------------------------------------------------
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_audit ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Bloque 6: Notificaciones
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Bloque 7: Exámenes (exámenes, preguntas, opciones, intentos, disponibilidad)
-- -----------------------------------------------------------------------------
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_extra_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_availability ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Bloque 8: Actividad y vistas de contenido
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
-- content_views: puede no existir si no se ejecutó schema.sql completo; se habilita RLS solo si existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'content_views') THEN
    ALTER TABLE public.content_views ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =============================================================================
-- FIN MIGRACIÓN 024
-- No se han creado políticas. El backend (service role) no se ve afectado.
-- Para acceso futuro con anon/authenticated, crear políticas en migraciones nuevas.
-- =============================================================================
