import { supabaseAdmin } from '../config/supabase';

export interface CreateNotificationParams {
  cohortId: string;
  title: string;
  body: string;
  createdBy: string;
}

export async function createNotification(params: CreateNotificationParams) {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert({
      cohort_id: params.cohortId,
      title: params.title.trim(),
      body: params.body.trim(),
      created_by: params.createdBy,
    })
    .select('id, cohort_id, title, body, created_at')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/** Lista de avisos enviados (admin): con nombre del curso/cohort */
export async function listNotificationsForAdmin(cohortId?: string) {
  let query = supabaseAdmin
    .from('notifications')
    .select(`
      id,
      cohort_id,
      title,
      body,
      created_by,
      created_at,
      cohorts (
        id,
        name,
        code,
        courses ( name )
      )
    `)
    .order('created_at', { ascending: false });

  if (cohortId) query = query.eq('cohort_id', cohortId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((n) => {
    const cohort = n.cohorts as { id: string; name: string; code: string; courses?: { name: string } } | null;
    const courseName = cohort?.courses?.name;
    return {
      id: n.id,
      cohortId: n.cohort_id,
      title: n.title,
      body: n.body,
      createdBy: n.created_by,
      createdAt: n.created_at,
      cohortLabel: cohort ? `${courseName || 'Curso'} Nro ${cohort.name}` : '—',
    };
  });
}

/** Avisos para un estudiante (su cohort) con estado leído */
export async function listNotificationsForStudent(userId: string, cohortId: string | null) {
  if (!cohortId) return [];

  const { data: notifications, error: nErr } = await supabaseAdmin
    .from('notifications')
    .select('id, title, body, created_at')
    .eq('cohort_id', cohortId)
    .order('created_at', { ascending: false });

  if (nErr) throw new Error(nErr.message);
  if (!notifications?.length) return [];

  const ids = notifications.map((n) => n.id);
  const { data: reads } = await supabaseAdmin
    .from('notification_reads')
    .select('notification_id, read_at')
    .eq('user_id', userId)
    .in('notification_id', ids);

  const readMap = new Map((reads || []).map((r) => [r.notification_id, r.read_at]));

  return notifications.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    createdAt: n.created_at,
    readAt: readMap.get(n.id) ?? null,
    isRead: readMap.has(n.id),
  }));
}

/** Cuántos avisos sin leer tiene el usuario */
export async function getUnreadCount(userId: string, cohortId: string | null): Promise<number> {
  if (!cohortId) return 0;

  const { data: notifications } = await supabaseAdmin
    .from('notifications')
    .select('id')
    .eq('cohort_id', cohortId);
  if (!notifications?.length) return 0;

  const ids = notifications.map((n) => n.id);
  const { count } = await supabaseAdmin
    .from('notification_reads')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('notification_id', ids);
  const readCount = count ?? 0;
  return notifications.length - readCount;
}

/** Marcar un aviso como leído */
export async function markAsRead(notificationId: string, userId: string) {
  const { error } = await supabaseAdmin
    .from('notification_reads')
    .upsert(
      { notification_id: notificationId, user_id: userId, read_at: new Date().toISOString() },
      { onConflict: 'notification_id,user_id' }
    );
  if (error) throw new Error(error.message);
}
