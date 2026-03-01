import { supabaseAdmin } from '../config/supabase';

const HOURS_6_TO_23 = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'];

const WEEKDAYS = [1, 2, 3, 4, 5]; // Lunes a Viernes
const WEEKEND_DAYS = [6, 7]; // Sábado, Domingo

export interface CourseScheduleRow {
  id: string;
  cohort_id: string;
  instructor_id: string;
  day_of_week: number;
  start_time: string;
  created_at: string;
  schedule_group_id?: string | null;
  instructors?: { id: string; full_name: string; email: string | null } | null;
  cohorts?: { id: string; name: string; code: string; course_id: string; courses?: { name: string } } | null;
}

export interface ScheduleGroupRow {
  id: string;
  cohort_id: string;
  instructor_id: string;
  type: 'weekdays' | 'weekends';
  start_time: string;
  created_at: string;
  instructors?: { id: string; full_name: string; email: string | null } | null;
  cohorts?: { id: string; name: string; code: string; course_id: string; courses?: { name: string } } | null;
  slots?: { id: string; day_of_week: number; start_time: string }[];
  student_count?: number;
}

/** Slots disponibles para un cohorte + instructor (no ocupados). Si excludeScheduleId se pasa, ese slot se considera libre (para reasignar al mismo sin conflicto). */
export async function getAvailableSlots(
  cohortId: string,
  instructorId: string,
  excludeScheduleId?: string | null
): Promise<{ day_of_week: number; start_time: string }[]> {
  const { data: taken, error } = await supabaseAdmin
    .from('course_schedules')
    .select('id, day_of_week, start_time')
    .eq('cohort_id', cohortId)
    .eq('instructor_id', instructorId);

  if (error) throw new Error(error.message);

  const takenSet = new Set(
    (taken || [])
      .filter((r) => !excludeScheduleId || (r as { id?: string }).id !== excludeScheduleId)
      .map((r) => {
        const t = typeof r.start_time === 'string' ? r.start_time.slice(0, 5) : r.start_time;
        return `${r.day_of_week}-${t}`;
      })
  );

  const slots: { day_of_week: number; start_time: string }[] = [];
  for (let day = 1; day <= 7; day++) {
    for (const start_time of HOURS_6_TO_23) {
      if (!takenSet.has(`${day}-${start_time}`)) slots.push({ day_of_week: day, start_time });
    }
  }
  return slots;
}

/** Slots libres y ocupados con nombres de estudiantes para un cohorte + instructor (para mostrar disponibilidad con quién está cada horario). */
export async function getInstructorScheduleWithOccupancy(
  cohortId: string,
  instructorId: string,
  excludeScheduleId?: string | null
): Promise<{
  free: { day_of_week: number; start_time: string }[];
  occupied: { day_of_week: number; start_time: string; student_names: string[] }[];
}> {
  const { data: schedules, error: sErr } = await supabaseAdmin
    .from('course_schedules')
    .select('id, day_of_week, start_time')
    .eq('cohort_id', cohortId)
    .eq('instructor_id', instructorId);

  if (sErr) throw new Error(sErr.message);

  const scheduleIds = (schedules || [])
    .filter((s) => !excludeScheduleId || (s as { id?: string }).id !== excludeScheduleId)
    .map((s) => (s as { id: string }).id);

  const takenSet = new Set(
    (schedules || [])
      .filter((s) => !excludeScheduleId || (s as { id?: string }).id !== excludeScheduleId)
      .map((s) => {
        const t = typeof (s as { start_time: string }).start_time === 'string' ? (s as { start_time: string }).start_time.slice(0, 5) : (s as { start_time: string }).start_time;
        return `${(s as { day_of_week: number }).day_of_week}-${t}`;
      })
  );

  const free: { day_of_week: number; start_time: string }[] = [];
  for (let day = 1; day <= 7; day++) {
    for (const start_time of HOURS_6_TO_23) {
      if (!takenSet.has(`${day}-${start_time}`)) free.push({ day_of_week: day, start_time });
    }
  }

  if (scheduleIds.length === 0) {
    return { free, occupied: [] };
  }

  const { data: profiles, error: pErr } = await supabaseAdmin
    .from('user_profiles')
    .select('schedule_id, full_name')
    .eq('role', 'student')
    .in('schedule_id', scheduleIds);

  if (pErr) throw new Error(pErr.message);

  const byScheduleId = new Map<string, string[]>();
  for (const p of profiles || []) {
    const id = (p as { schedule_id: string | null }).schedule_id;
    const name = (p as { full_name: string | null }).full_name || 'Sin nombre';
    if (id) {
      if (!byScheduleId.has(id)) byScheduleId.set(id, []);
      byScheduleId.get(id)!.push(name);
    }
  }

  const occupied: { day_of_week: number; start_time: string; student_names: string[] }[] = [];
  for (const s of schedules || []) {
    const id = (s as { id: string }).id;
    if (excludeScheduleId && id === excludeScheduleId) continue;
    const names = byScheduleId.get(id) || [];
    const day_of_week = (s as { day_of_week: number }).day_of_week;
    const start_time = typeof (s as { start_time: string }).start_time === 'string' ? (s as { start_time: string }).start_time.slice(0, 5) : String((s as { start_time: string }).start_time);
    occupied.push({ day_of_week, start_time, student_names: names });
  }

  return { free, occupied };
}

export async function listCourseSchedules(cohortId?: string, instructorId?: string) {
  let query = supabaseAdmin
    .from('course_schedules')
    .select(
      'id, cohort_id, instructor_id, day_of_week, start_time, created_at, instructors(id, full_name, email), cohorts(id, name, code, course_id, courses(name))'
    )
    .order('cohort_id')
    .order('day_of_week')
    .order('start_time');

  if (cohortId) {
    query = query.eq('cohort_id', cohortId);
  }
  if (instructorId) {
    query = query.eq('instructor_id', instructorId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((r) => {
    const raw = r as Record<string, unknown>;
    const instr = raw.instructors;
    const singleInstr = Array.isArray(instr) ? (instr[0] ?? null) : instr ?? null;
    let singleCohort = Array.isArray(raw.cohorts) ? (raw.cohorts[0] ?? null) : (raw.cohorts ?? null);
    if (singleCohort && typeof singleCohort === 'object' && Array.isArray((singleCohort as Record<string, unknown>).courses)) {
      const c = singleCohort as Record<string, unknown>;
      singleCohort = { ...c, courses: (c.courses as unknown[])[0] ?? null };
    }
    return {
      ...r,
      start_time: typeof r.start_time === 'string' ? r.start_time.slice(0, 5) : r.start_time,
      instructors: singleInstr,
      cohorts: singleCohort,
    };
  }) as unknown as CourseScheduleRow[];
}

/** Obtiene o crea un slot (cohort + instructor + día + hora). Si ya existe, devuelve ese id. */
export async function getOrCreateCourseSchedule(params: {
  cohortId: string;
  instructorId: string;
  dayOfWeek: number;
  startTime: string;
}) {
  const { data: existing } = await supabaseAdmin
    .from('course_schedules')
    .select('id, cohort_id, instructor_id, day_of_week, start_time, created_at')
    .eq('cohort_id', params.cohortId)
    .eq('instructor_id', params.instructorId)
    .eq('day_of_week', params.dayOfWeek)
    .eq('start_time', params.startTime)
    .maybeSingle();
  if (existing) {
    return { ...existing, start_time: typeof existing.start_time === 'string' ? existing.start_time.slice(0, 5) : existing.start_time };
  }
  return createCourseSchedule(params);
}

export async function createCourseSchedule(params: {
  cohortId: string;
  instructorId: string;
  dayOfWeek: number;
  startTime: string; // "06:00", "07:00", ... "23:00"
}) {
  const { data, error } = await supabaseAdmin
    .from('course_schedules')
    .insert({
      cohort_id: params.cohortId,
      instructor_id: params.instructorId,
      day_of_week: params.dayOfWeek,
      start_time: params.startTime,
    })
    .select('id, cohort_id, instructor_id, day_of_week, start_time, created_at')
    .single();
  if (error) throw new Error(error.message);
  return {
    ...data,
    start_time: typeof data.start_time === 'string' ? data.start_time.slice(0, 5) : data.start_time,
  };
}

export async function deleteCourseSchedule(id: string) {
  const { error } = await supabaseAdmin.from('course_schedules').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Normaliza hora a "HH:mm" para que las claves coincidan con el frontend. Acepta "08:00", "08:00:00", etc. */
function normalizeTimeToHHmm(startTime: unknown): string {
  if (startTime == null) return '08:00';
  const str = typeof startTime === 'string' ? startTime.trim() : String(startTime);
  const match = str.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    const h = match[1].padStart(2, '0');
    const m = match[2];
    return `${h}:${m}`;
  }
  return str.slice(0, 5).length === 5 ? str.slice(0, 5) : '08:00';
}

/** Devuelve si un estudiante está en semana 1 o en última semana (terminando). */
function getPracticeWeekStatus(
  practiceStart: Date | null,
  practiceEnd: Date | null,
  practiceWeeks: number | null,
  today: Date
): { isWeek1: boolean; isEnding: boolean } {
  if (!practiceStart || !practiceEnd) return { isWeek1: false, isEnding: false };
  const start = new Date(practiceStart);
  const end = new Date(practiceEnd);
  const t = new Date(today);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  t.setHours(0, 0, 0, 0);
  if (t < start) return { isWeek1: false, isEnding: false };
  if (t > end) return { isWeek1: false, isEnding: false };
  const daysSinceStart = Math.floor((t.getTime() - start.getTime()) / 86400000);
  const totalDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  const totalWeeks = practiceWeeks ?? Math.max(1, Math.ceil(totalDays / 7));
  const weekNum = Math.min(Math.floor(daysSinceStart / 7) + 1, totalWeeks);
  const daysUntilEnd = Math.floor((end.getTime() - t.getTime()) / 86400000);
  const isWeek1 = weekNum === 1;
  const isEnding = weekNum >= totalWeeks || daysUntilEnd < 7;
  return { isWeek1, isEnding };
}


/** Dado un día (Date), devuelve day_of_week 1=Lunes .. 7=Domingo. */
function getDayOfWeek(d: Date): number {
  const j = d.getDay();
  return j === 0 ? 7 : j;
}

/** Parsea "YYYY-MM-DD" como fecha local (medianoche) para evitar desfases por UTC. */
function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  return new Date(isoDate);
}

/** Disponibilidad del instructor en un rango de fechas: solo aparece el alumno en las fechas de su periodo de prácticas. */
export async function getInstructorAvailabilityForWeek(
  instructorId: string,
  weekStartISO: string,
  weekEndISO: string
): Promise<{
  occupied: { date: string; start_time: string; student_names: string[]; status: 'occupied_week1' | 'occupied_ending' }[];
  free: { date: string; start_time: string }[];
}> {
  const weekStart = parseLocalDate(weekStartISO);
  const weekEnd = parseLocalDate(weekEndISO);
  weekEnd.setHours(23, 59, 59, 999);

  const { data: occupiedRows, error } = await supabaseAdmin
    .from('course_schedules')
    .select('id, day_of_week, start_time, schedule_group_id')
    .eq('instructor_id', instructorId);

  if (error) throw new Error(error.message);

  const rows = (occupiedRows || []) as { id: string; day_of_week: number; start_time: string; schedule_group_id: string | null }[];
  const scheduleIds = rows.map((r) => r.id);

  /** Por cada slot id, los ids del mismo grupo (Lunes–Viernes o Sáb–Dom comparten grupo); si no tiene grupo, solo él. */
  const slotIdToGroupIds = new Map<string, string[]>();
  const groupIdToSlotIds = new Map<string, string[]>();
  for (const r of rows) {
    const gid = r.schedule_group_id;
    if (gid) {
      if (!groupIdToSlotIds.has(gid)) groupIdToSlotIds.set(gid, []);
      groupIdToSlotIds.get(gid)!.push(r.id);
    }
  }
  for (const r of rows) {
    if (r.schedule_group_id) {
      slotIdToGroupIds.set(r.id, groupIdToSlotIds.get(r.schedule_group_id)!);
    } else {
      slotIdToGroupIds.set(r.id, [r.id]);
    }
  }

  type ProfileInfo = { schedule_id: string; name: string; practice_start: Date | null; practice_end: Date | null; practice_weeks: number | null };
  /** Estudiantes que deben mostrarse en cada slot: si el alumno está en un grupo, aparece en todos los días del grupo. */
  const profilesBySlot = new Map<string, ProfileInfo[]>();

  if (scheduleIds.length > 0) {
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from('user_profiles')
      .select('schedule_id, full_name, start_date, practice_weeks, practice_start_date, practice_end_date')
      .eq('role', 'student')
      .in('schedule_id', scheduleIds);
    if (!pErr && profiles) {
      for (const p of profiles) {
        const id = (p as { schedule_id: string | null }).schedule_id;
        const name = (p as { full_name: string | null }).full_name || 'Sin nombre';
        if (!id) continue;
        const startDate = (p as { start_date?: string | null }).start_date;
        const practiceStartDate = (p as { practice_start_date?: string | null }).practice_start_date;
        const practiceEndDate = (p as { practice_end_date?: string | null }).practice_end_date;
        const practiceWeeks = (p as { practice_weeks?: number | null }).practice_weeks ?? null;
        const practice_start = practiceStartDate ? parseLocalDate(practiceStartDate) : (startDate ? parseLocalDate(startDate) : null);
        let practice_end: Date | null = practiceEndDate ? parseLocalDate(practiceEndDate) : null;
        if (!practice_end && practice_start) {
          const weeks = practiceWeeks ?? 2;
          practice_end = new Date(practice_start);
          practice_end.setDate(practice_end.getDate() + weeks * 7 - 1);
        }
        const slotIdsInGroup = slotIdToGroupIds.get(id) || [id];
        const info: ProfileInfo = { schedule_id: id, name, practice_start, practice_end, practice_weeks: practiceWeeks };
        for (const slotId of slotIdsInGroup) {
          if (!profilesBySlot.has(slotId)) profilesBySlot.set(slotId, []);
          profilesBySlot.get(slotId)!.push(info);
        }
      }
    }
  }

  const bySlotKey = new Map<string, { names: Set<string>; hasWeek1: boolean; hasEnding: boolean }>();

  for (let i = 0; i <= 6; i++) {
    const d = new Date(weekStart.getTime());
    d.setDate(d.getDate() + i);
    const dateISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayOfWeek = getDayOfWeek(d);
    for (const r of rows) {
      if (r.day_of_week !== dayOfWeek) continue;
      const scheduleId = r.id;
      const startTime = normalizeTimeToHHmm(r.start_time);
      const students = profilesBySlot.get(scheduleId) || [];
      for (const stu of students) {
        let inRange: boolean;
        let dayCheck: Date;
        if (stu.practice_start && stu.practice_end) {
          const start = new Date(stu.practice_start);
          const end = new Date(stu.practice_end);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          dayCheck = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
          inRange = dayCheck >= start && dayCheck <= end;
        } else {
          inRange = true;
          dayCheck = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
        }
        if (!inRange) continue;
        const { isWeek1, isEnding } = stu.practice_start && stu.practice_end
          ? getPracticeWeekStatus(stu.practice_start, stu.practice_end, stu.practice_weeks, dayCheck)
          : { isWeek1: true, isEnding: false };
        const key = `${dateISO}-${startTime}`;
        if (!bySlotKey.has(key)) bySlotKey.set(key, { names: new Set(), hasWeek1: false, hasEnding: false });
        const entry = bySlotKey.get(key)!;
        entry.names.add(stu.name);
        if (isWeek1) entry.hasWeek1 = true;
        if (isEnding) entry.hasEnding = true;
      }
    }
  }

  const occupied: { date: string; start_time: string; student_names: string[]; status: 'occupied_week1' | 'occupied_ending' }[] = [];
  for (const [key, e] of bySlotKey.entries()) {
    if (e.names.size === 0) continue;
    const date = key.slice(0, 10);
    const start_time = key.slice(11);
    occupied.push({
      date,
      start_time: start_time || '08:00',
      student_names: Array.from(e.names),
      status: e.hasWeek1 ? 'occupied_week1' : (e.hasEnding ? 'occupied_ending' : 'occupied_week1'),
    });
  }

  const free: { date: string; start_time: string }[] = [];
  for (let d = new Date(weekStart.getTime()); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    const dateISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    for (const start_time of HOURS_6_TO_23) {
      const key = `${dateISO}-${start_time}`;
      if (!bySlotKey.has(key) || bySlotKey.get(key)!.names.size === 0) free.push({ date: dateISO, start_time });
    }
  }

  return { occupied, free };
}

export async function getScheduleWithStudents(scheduleId: string) {
  const { data: schedule, error: sErr } = await supabaseAdmin
    .from('course_schedules')
    .select('id, cohort_id, instructor_id, day_of_week, start_time, instructors(id, full_name, email), cohorts(id, name, code, courses(name))')
    .eq('id', scheduleId)
    .single();
  if (sErr || !schedule) throw new Error(schedule ? 'Schedule not found' : sErr?.message);

  const { data: profiles } = await supabaseAdmin
    .from('user_profiles')
    .select('id, full_name, email, cedula, citizenship, blood_type')
    .eq('schedule_id', scheduleId)
    .eq('role', 'student');

  return {
    ...schedule,
    start_time: typeof schedule.start_time === 'string' ? (schedule.start_time as string).slice(0, 5) : schedule.start_time,
    students: profiles || [],
  };
}

// --- Horarios semanales (grupos): Lunes a Viernes o Fines de semana ---

/** Obtiene o crea un grupo semanal y sus slots. Devuelve el primer slot para asignar a schedule_id. */
export async function getOrCreateScheduleGroup(params: {
  cohortId: string;
  instructorId: string;
  type: 'weekdays' | 'weekends';
  startTime: string; // "06:00" ... "23:00"
}): Promise<{ groupId: string; firstSlotId: string; label: string }> {
  const startTime = typeof params.startTime === 'string' ? params.startTime.slice(0, 5) : params.startTime;
  const { data: existingGroup } = await supabaseAdmin
    .from('schedule_groups')
    .select('id')
    .eq('cohort_id', params.cohortId)
    .eq('instructor_id', params.instructorId)
    .eq('type', params.type)
    .eq('start_time', startTime)
    .maybeSingle();

  if (existingGroup) {
    const days = params.type === 'weekdays' ? WEEKDAYS : WEEKEND_DAYS;
    const firstDay = days[0];
    const { data: firstSlot } = await supabaseAdmin
      .from('course_schedules')
      .select('id')
      .eq('schedule_group_id', existingGroup.id)
      .eq('day_of_week', firstDay)
      .eq('start_time', startTime)
      .order('day_of_week')
      .limit(1)
      .maybeSingle();
    if (firstSlot) {
      const label = params.type === 'weekdays' ? `Lunes a Viernes ${startTime}` : `Sábado y Domingo ${startTime}`;
      return { groupId: existingGroup.id, firstSlotId: (firstSlot as { id: string }).id, label };
    }
  }

  const { data: newGroup, error: groupErr } = await supabaseAdmin
    .from('schedule_groups')
    .insert({
      cohort_id: params.cohortId,
      instructor_id: params.instructorId,
      type: params.type,
      start_time: startTime,
    })
    .select('id')
    .single();
  if (groupErr) throw new Error(groupErr.message);
  const groupId = (newGroup as { id: string }).id;

  const days = params.type === 'weekdays' ? WEEKDAYS : WEEKEND_DAYS;
  let firstSlotId = '';
  for (const dayOfWeek of days) {
    const slot = await getOrCreateCourseSchedule({
      cohortId: params.cohortId,
      instructorId: params.instructorId,
      dayOfWeek,
      startTime,
    });
    if (!firstSlotId) firstSlotId = slot.id;
    await supabaseAdmin.from('course_schedules').update({ schedule_group_id: groupId }).eq('id', slot.id);
  }
  const label = params.type === 'weekdays' ? `Lunes a Viernes ${startTime}` : `Sábado y Domingo ${startTime}`;
  return { groupId, firstSlotId, label };
}

/** Lista grupos de horario por cohorte (para selector en admin). */
export async function listScheduleGroupsByCohort(cohortId: string): Promise<ScheduleGroupRow[]> {
  const { data: groups, error } = await supabaseAdmin
    .from('schedule_groups')
    .select('id, cohort_id, instructor_id, type, start_time, created_at, instructors(id, full_name, email), cohorts(id, name, code, course_id, courses(name))')
    .eq('cohort_id', cohortId)
    .order('start_time');
  if (error) throw new Error(error.message);

  const result: ScheduleGroupRow[] = [];
  for (const g of groups || []) {
    const raw = g as Record<string, unknown>;
    const instr = raw.instructors;
    const singleInstr = Array.isArray(instr) ? (instr[0] ?? null) : instr ?? null;
    let singleCohort = Array.isArray(raw.cohorts) ? (raw.cohorts[0] ?? null) : (raw.cohorts ?? null);
    if (singleCohort && typeof singleCohort === 'object' && Array.isArray((singleCohort as Record<string, unknown>).courses)) {
      const c = singleCohort as Record<string, unknown>;
      singleCohort = { ...c, courses: (c.courses as unknown[])[0] ?? null };
    }
    const { data: slots } = await supabaseAdmin
      .from('course_schedules')
      .select('id, day_of_week, start_time')
      .eq('schedule_group_id', (g as { id: string }).id)
      .order('day_of_week');
    const slotList = (slots || []).map((s) => ({
      id: (s as { id: string }).id,
      day_of_week: (s as { day_of_week: number }).day_of_week,
      start_time: typeof (s as { start_time?: string }).start_time === 'string' ? (s as { start_time: string }).start_time.slice(0, 5) : '',
    }));
    const slotIds = slotList.map((s) => s.id);
    let studentCount = 0;
    if (slotIds.length > 0) {
      const { count } = await supabaseAdmin
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .in('schedule_id', slotIds)
        .eq('role', 'student');
      studentCount = count ?? 0;
    }
    result.push({
      ...g,
      start_time: typeof (g as { start_time?: string }).start_time === 'string' ? (g as { start_time: string }).start_time.slice(0, 5) : '',
      instructors: singleInstr,
      cohorts: singleCohort,
      slots: slotList,
      student_count: studentCount,
    } as ScheduleGroupRow);
  }
  return result;
}

/** Etiqueta legible del grupo (para mostrar en UI y exports). */
export function scheduleGroupLabel(type: 'weekdays' | 'weekends', startTime: string): string {
  const t = typeof startTime === 'string' ? startTime.slice(0, 5) : startTime;
  return type === 'weekdays' ? `Lunes a Viernes ${t}` : `Sábado y Domingo ${t}`;
}

/** Horario mostrable de un alumno: grupo base + overrides por día. */
export async function getStudentScheduleDisplay(userId: string): Promise<{
  type: 'weekdays' | 'weekends' | 'single';
  startTime: string;
  label: string;
  practiceWeeks: number | null;
  scheduleId: string | null;
  groupId: string | null;
  slots: { day_of_week: number; start_time: string; isOverride?: boolean }[];
  overrides: { day_of_week: number; course_schedule_id: string }[];
} | null> {
  const { data: profile, error } = await supabaseAdmin
    .from('user_profiles')
    .select('schedule_id, practice_weeks')
    .eq('id', userId)
    .single();
  if (error || !profile) return null;
  const scheduleId = (profile as { schedule_id?: string | null }).schedule_id ?? null;
  const practiceWeeks = (profile as { practice_weeks?: number | null }).practice_weeks ?? null;
  if (!scheduleId) {
    return { type: 'single', startTime: '', label: 'Sin horario', practiceWeeks, scheduleId: null, groupId: null, slots: [], overrides: [] };
  }

  const { data: slot } = await supabaseAdmin
    .from('course_schedules')
    .select('id, day_of_week, start_time, schedule_group_id')
    .eq('id', scheduleId)
    .single();
  if (!slot) return null;
  const groupId = (slot as { schedule_group_id?: string | null }).schedule_group_id ?? null;

  const overrides: { day_of_week: number; course_schedule_id: string }[] = [];
  const { data: overrideRows } = await supabaseAdmin
    .from('user_schedule_day_override')
    .select('day_of_week, course_schedule_id')
    .eq('user_id', userId);
  for (const row of overrideRows || []) {
    overrides.push({
      day_of_week: (row as { day_of_week: number }).day_of_week,
      course_schedule_id: (row as { course_schedule_id: string }).course_schedule_id,
    });
  }

  let slots: { day_of_week: number; start_time: string; isOverride?: boolean }[] = [];
  let type: 'weekdays' | 'weekends' | 'single' = 'single';
  let startTime = typeof (slot as { start_time?: string }).start_time === 'string' ? (slot as { start_time: string }).start_time.slice(0, 5) : '';

  if (groupId) {
    const { data: groupSlots } = await supabaseAdmin
      .from('course_schedules')
      .select('id, day_of_week, start_time')
      .eq('schedule_group_id', groupId)
      .order('day_of_week');
    const { data: groupRow } = await supabaseAdmin.from('schedule_groups').select('type, start_time').eq('id', groupId).single();
    if (groupRow) {
      type = (groupRow as { type: 'weekdays' | 'weekends' }).type;
      startTime = typeof (groupRow as { start_time?: string }).start_time === 'string' ? (groupRow as { start_time: string }).start_time.slice(0, 5) : '';
    }
    const overrideByDay = new Map(overrides.map((o) => [o.day_of_week, o.course_schedule_id]));
    const baseSlots = (groupSlots || []).map((s) => ({
      day_of_week: (s as { day_of_week: number }).day_of_week,
      start_time: typeof (s as { start_time?: string }).start_time === 'string' ? (s as { start_time: string }).start_time.slice(0, 5) : '',
      isOverride: false,
    }));
    slots = [...baseSlots];
    for (const ov of overrides) {
      const { data: ovSlot } = await supabaseAdmin
        .from('course_schedules')
        .select('day_of_week, start_time')
        .eq('id', ov.course_schedule_id)
        .single();
      if (ovSlot) {
        const t = typeof (ovSlot as { start_time?: string }).start_time === 'string' ? (ovSlot as { start_time: string }).start_time.slice(0, 5) : '';
        const idx = slots.findIndex((s) => s.day_of_week === ov.day_of_week);
        if (idx >= 0) slots[idx] = { day_of_week: ov.day_of_week, start_time: t, isOverride: true };
        else slots.push({ day_of_week: (ovSlot as { day_of_week: number }).day_of_week, start_time: t, isOverride: true });
      }
    }
    slots.sort((a, b) => a.day_of_week - b.day_of_week);
  } else {
    slots = [{ day_of_week: (slot as { day_of_week: number }).day_of_week, start_time: startTime }];
  }

  const label = type !== 'single' ? scheduleGroupLabel(type, startTime) : `Día ${(slot as { day_of_week: number }).day_of_week} ${startTime}`;
  return { type, startTime, label, practiceWeeks, scheduleId, groupId, slots, overrides };
}

/** Cambio de horario por lo que resta del curso: asigna al alumno a otro grupo (o slot único). */
export async function setStudentScheduleRestOfCourse(
  userId: string,
  params: { cohortId: string; instructorId: string; type: 'weekdays' | 'weekends'; startTime: string } | { scheduleId: string }
): Promise<{ error?: string }> {
  let firstSlotId: string;
  if ('scheduleId' in params) {
    firstSlotId = params.scheduleId;
  } else {
    const { firstSlotId: id } = await getOrCreateScheduleGroup({
      cohortId: params.cohortId,
      instructorId: params.instructorId,
      type: params.type,
      startTime: params.startTime,
    });
    firstSlotId = id;
  }
  await supabaseAdmin.from('user_schedule_day_override').delete().eq('user_id', userId);
  const { error } = await supabaseAdmin.from('user_profiles').update({ schedule_id: firstSlotId }).eq('id', userId);
  if (error) return { error: error.message };
  return {};
}

/** Cambio de horario solo un día: override para ese día de la semana. */
export async function setStudentScheduleOneDay(
  userId: string,
  dayOfWeek: number,
  courseScheduleId: string
): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin
    .from('user_schedule_day_override')
    .upsert({ user_id: userId, day_of_week: dayOfWeek, course_schedule_id: courseScheduleId }, { onConflict: 'user_id,day_of_week' });
  if (error) return { error: error.message };
  return {};
}

/** Quitar override de un día. */
export async function clearStudentScheduleOneDay(userId: string, dayOfWeek: number): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin.from('user_schedule_day_override').delete().eq('user_id', userId).eq('day_of_week', dayOfWeek);
  if (error) return { error: error.message };
  return {};
}
