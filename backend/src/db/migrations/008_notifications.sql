-- Avisos / notificaciones por cohorte (curso con número).
-- El admin envía un aviso a todos los usuarios de un cohort; los estudiantes ven sus avisos y pueden marcarlos como leídos.
--
-- Eliminación en cascada (no ocupa almacenamiento al borrar):
-- - Al eliminar un curso (cohort): se borran todas las notifications de ese cohort y sus notification_reads.
-- - Al eliminar un usuario: se borran sus registros en notification_reads.

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

CREATE INDEX IF NOT EXISTS idx_notifications_cohort ON notifications(cohort_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON notification_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_notification ON notification_reads(notification_id);

COMMENT ON TABLE notifications IS 'Avisos enviados por el admin a un curso (cohort)';
COMMENT ON TABLE notification_reads IS 'Registro de lectura de cada aviso por usuario';
