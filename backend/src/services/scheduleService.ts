import { supabaseAdmin } from '../config/supabase';

const HOURS_6_TO_23 = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'];

export interface CourseScheduleRow {
  id: string;
  cohort_id: string;
  instructor_id: string;
  day_of_week: number;
  start_time: string;
  created_at: string;
  instructors?: { id: string; full_name: string; email: string | null } | null;
  cohorts?: { id: string; name: string; code: string; course_id: string; courses?: { name: string } } | null;
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

export async function listCourseSchedules(cohortId?: string) {
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

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((r) => ({
    ...r,
    start_time: typeof r.start_time === 'string' ? r.start_time.slice(0, 5) : r.start_time,
  })) as CourseScheduleRow[];
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
    return { id: existing.id, ...existing, start_time: typeof existing.start_time === 'string' ? existing.start_time.slice(0, 5) : existing.start_time };
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
