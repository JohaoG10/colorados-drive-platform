import { supabaseAdmin } from '../config/supabase';

/** Registra asistencia "presente" del día actual (cuando el estudiante entra a la plataforma) */
export async function recordCheckIn(userId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await supabaseAdmin.from('attendance').upsert(
    {
      user_id: userId,
      date: today,
      status: 'present',
      source: 'auto',
      created_by: null,
    },
    { onConflict: 'user_id,date' }
  );
}

/** Lista de estudiantes del cohort con asistencia en el rango de fechas */
export async function listAttendanceByCohort(
  cohortId: string,
  startDate: string,
  endDate: string
): Promise<{
  userId: string;
  fullName: string;
  email: string;
  startDate: string | null;
  endDate: string | null;
  records: { date: string; status: string }[];
  daysPresent: number;
  totalDays: number;
}[]> {
  const { data: profiles, error: pErr } = await supabaseAdmin
    .from('user_profiles')
    .select('id, full_name, email, start_date, end_date')
    .eq('cohort_id', cohortId)
    .eq('role', 'student');

  if (pErr) throw new Error(pErr.message);
  if (!profiles?.length) return [];

  const userIds = profiles.map((p) => p.id);
  const { data: records, error: rErr } = await supabaseAdmin
    .from('attendance')
    .select('user_id, date, status')
    .in('user_id', userIds)
    .gte('date', startDate)
    .lte('date', endDate);

  if (rErr) throw new Error(rErr.message);

  const recordsByUser = new Map<string, { date: string; status: string }[]>();
  for (const r of records || []) {
    const dateStr = typeof r.date === 'string' ? r.date.slice(0, 10) : r.date;
    const list = recordsByUser.get(r.user_id) ?? [];
    list.push({ date: dateStr, status: r.status });
    recordsByUser.set(r.user_id, list);
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  let totalDays = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    totalDays += 1;
  }

  return profiles.map((p) => {
    const list = recordsByUser.get(p.id) ?? [];
    const daysPresent = list.filter((r) => r.status === 'present' || r.status === 'excused').length;
    return {
      userId: p.id,
      fullName: p.full_name ?? '',
      email: p.email,
      startDate: p.start_date ? String(p.start_date).slice(0, 10) : null,
      endDate: p.end_date ? String(p.end_date).slice(0, 10) : null,
      records: list.sort((a, b) => a.date.localeCompare(b.date)),
      daysPresent,
      totalDays,
    };
  });
}

/** Obtiene todas las fechas en el rango para un estudiante (para edición día a día) */
export async function getAttendanceRecords(
  userId: string,
  startDate: string,
  endDate: string
): Promise<{ date: string; status: string; source: string }[]> {
  const { data, error } = await supabaseAdmin
    .from('attendance')
    .select('date, status, source')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');

  if (error) throw new Error(error.message);
  return (data || []).map((r) => ({
    date: typeof r.date === 'string' ? r.date.slice(0, 10) : r.date,
    status: r.status,
    source: r.source ?? 'auto',
  }));
}

/** Marca o actualiza la asistencia de un estudiante en una fecha (admin) */
export async function setAttendance(
  userId: string,
  date: string,
  status: 'present' | 'absent' | 'excused',
  createdBy: string
): Promise<void> {
  const { error } = await supabaseAdmin.from('attendance').upsert(
    {
      user_id: userId,
      date,
      status,
      source: 'manual',
      created_by: createdBy,
    },
    { onConflict: 'user_id,date' }
  );
  if (error) throw new Error(error.message);
}

/** Genera el listado de fechas (días hábiles o todos) entre start y end */
export function getDateRange(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
