'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders, triggerSessionExpired } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const DAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: 'Lunes', short: 'Lun' },
  { value: 2, label: 'Martes', short: 'Mar' },
  { value: 3, label: 'Miércoles', short: 'Mié' },
  { value: 4, label: 'Jueves', short: 'Jue' },
  { value: 5, label: 'Viernes', short: 'Vie' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
  { value: 7, label: 'Domingo', short: 'Dom' },
];

interface CourseSchedule {
  id: string;
  cohort_id: string;
  instructor_id: string;
  day_of_week: number;
  start_time: string;
  created_at: string;
  instructors?: { id: string; full_name: string; email: string | null } | null;
  cohorts?: { id: string; name: string; code: string; course_id: string; courses?: { name: string } } | null;
}

interface ScheduleBlockForEnrollment {
  key: string;
  courseName: string;
  cohortId: string;
  cohortName: string;
  timeLabel: string;
  instructorId: string;
  instructorName: string;
  startTime: string;
  scheduleType: 'weekdays' | 'weekends' | 'single';
  totalSlots: number;
  enrolledCount: number;
  firstSlotId: string;
  dayOfWeek: number;
}

interface Cohort {
  id: string;
  name: string;
  code: string;
  course_id: string;
  courses?: { name: string };
}

interface Instructor {
  id: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
}

export default function AdminSchedulesPage() {
  const { token } = useAuth();
  const [schedules, setSchedules] = useState<CourseSchedule[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [filterCohortId, setFilterCohortId] = useState('');
  const [filterInstructorId, setFilterInstructorId] = useState('');
  const [studentsModal, setStudentsModal] = useState<CourseSchedule | null>(null);
  const [studentsModalTimeLabel, setStudentsModalTimeLabel] = useState<string | null>(null);
  const [studentsList, setStudentsList] = useState<{ id: string; full_name: string; email: string; cedula: string | null; citizenship: string | null; blood_type: string | null }[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [changeScheduleStudent, setChangeScheduleStudent] = useState<{ id: string; full_name: string } | null>(null);
  const [changeInstructorId, setChangeInstructorId] = useState('');
  const [changeSlot, setChangeSlot] = useState<{ day_of_week: number; start_time: string } | null>(null);
  const [changeSlots, setChangeSlots] = useState<{ day_of_week: number; start_time: string }[]>([]);
  const [changeScheduleSubmitting, setChangeScheduleSubmitting] = useState(false);
  const [changeScheduleError, setChangeScheduleError] = useState('');
  const [tab, setTab] = useState<'by-course' | 'by-instructor'>('by-course');
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlockForEnrollment[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [filterDay, setFilterDay] = useState<string>('');
  const [filterTime, setFilterTime] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [availabilityInstructorId, setAvailabilityInstructorId] = useState('');
  const [availability, setAvailability] = useState<{ occupied: { date: string; start_time: string; student_names: string[]; status: 'occupied_week1' | 'occupied_ending' }[]; free: { date: string; start_time: string }[] } | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  const load = () => {
    if (!token) return;
    setApiError('');
    const url = filterCohortId
      ? `${API_URL}/api/admin/course-schedules?cohortId=${encodeURIComponent(filterCohortId)}`
      : `${API_URL}/api/admin/course-schedules`;
    fetch(url, { headers: getAuthHeaders(token) })
      .then((r) => r.json().then((data) => ({ ok: r.ok, status: r.status, data })))
      .then(({ ok, status, data }) => {
        if (ok && Array.isArray(data)) {
          setSchedules(data);
        } else {
          setSchedules([]);
          if (status === 401) triggerSessionExpired();
          else setApiError(data?.error || 'Error al cargar horarios.');
        }
      })
      .catch(() => setSchedules([]))
      .finally(() => setLoading(false));
  };

  const loadBlocks = () => {
    if (!token) return;
    setBlocksLoading(true);
    const params = new URLSearchParams();
    if (filterCohortId) params.set('cohortId', filterCohortId);
    if (filterInstructorId) params.set('instructorId', filterInstructorId);
    fetch(`${API_URL}/api/admin/schedule-blocks?${params.toString()}`, { headers: getAuthHeaders(token) })
      .then((r) => r.json().then((data) => ({ ok: r.ok, status: r.status, data })))
      .then(({ ok, status, data }) => {
        if (ok && Array.isArray(data)) {
          setScheduleBlocks(data);
        } else {
          setScheduleBlocks([]);
          if (status === 401) triggerSessionExpired();
        }
      })
      .catch(() => setScheduleBlocks([]))
      .finally(() => setBlocksLoading(false));
  };

  useEffect(() => {
    if (tab === 'by-course') loadBlocks();
  }, [token, tab, filterCohortId, filterInstructorId]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`${API_URL}/api/admin/cohorts`, { headers: getAuthHeaders(token) }).then((r) => r.json()),
      fetch(`${API_URL}/api/admin/instructors`, { headers: getAuthHeaders(token) }).then((r) => r.json()),
    ]).then(([cohortsData, instructorsData]) => {
      setCohorts(Array.isArray(cohortsData) ? cohortsData : []);
      setInstructors(Array.isArray(instructorsData) ? instructorsData : []);
    });
  }, [token]);

  /** Filtra bloques por día, hora y estado (client-side). */
  const filteredBlocks = scheduleBlocks.filter((b) => {
    if (filterDay && b.dayOfWeek !== Number(filterDay)) return false;
    if (filterTime && b.startTime !== filterTime) return false;
    const available = b.totalSlots - b.enrolledCount;
    if (filterStatus === 'disponible' && available < 2) return false;
    if (filterStatus === 'ultimos' && available !== 1) return false;
    if (filterStatus === 'lleno' && available !== 0) return false;
    return true;
  });

  /** Agrupa bloques por nombre de curso para cards/acordeón. */
  const blocksByCourse = filteredBlocks.reduce((acc, b) => {
    const name = b.courseName;
    if (!acc[name]) acc[name] = [];
    acc[name].push(b);
    return acc;
  }, {} as Record<string, ScheduleBlockForEnrollment[]>);

  /** Lunes y domingo de la semana mostrada en fecha local YYYY-MM-DD (weekOffset: 0 = actual) */
  const getWeekStartEnd = (offset: number) => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset + offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const toLocalISO = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { weekStart: toLocalISO(monday), weekEnd: toLocalISO(sunday) };
  };

  useEffect(() => {
    if (!availabilityInstructorId || !token) {
      setAvailability(null);
      return;
    }
    const { weekStart, weekEnd } = getWeekStartEnd(weekOffset);
    setAvailabilityLoading(true);
    setAvailability(null);
    fetch(`${API_URL}/api/admin/instructors/${availabilityInstructorId}/availability?weekStart=${encodeURIComponent(weekStart)}&weekEnd=${encodeURIComponent(weekEnd)}`, { headers: getAuthHeaders(token) })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (ok && data && Array.isArray(data.occupied) && Array.isArray(data.free)) {
          setAvailability({ occupied: data.occupied, free: data.free });
        } else {
          setAvailability(null);
        }
      })
      .catch(() => setAvailability(null))
      .finally(() => setAvailabilityLoading(false));
  }, [availabilityInstructorId, token, weekOffset]);

  const HOURS = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'];
  /** Normaliza hora a "HH:mm" para coincidir con HOURS (ej: "7:00" -> "07:00"). */
  const normalizeSlotTime = (t: string | undefined): string => {
    const s = (t || '').trim().slice(0, 5);
    return s.length === 4 && s[1] === ':' ? '0' + s : s || '00:00';
  };
  const occupiedSet = availability
    ? new Set(availability.occupied.map((o) => `${o.date}-${normalizeSlotTime(o.start_time)}`))
    : new Set<string>();
  const occupiedLabelByKey = availability
    ? new Map(
        availability.occupied.map((o) => {
          const key = `${o.date}-${normalizeSlotTime(o.start_time)}`;
          const names = o.student_names?.length ? o.student_names.join(', ') : '—';
          const label = o.status === 'occupied_ending' ? `${names} (acabando clase)` : `${names} (ocupado)`;
          return [key, label];
        })
      )
    : new Map<string, string>();
  const occupiedStatusByKey = availability
    ? new Map(
        availability.occupied.map((o) => {
          const key = `${o.date}-${normalizeSlotTime(o.start_time)}`;
          return [key, o.status || 'occupied_week1'];
        })
      )
    : new Map<string, 'occupied_week1' | 'occupied_ending'>();
  /** Fechas para la semana mostrada (weekOffset: 0 = actual, 1 = siguiente, -1 = anterior) */
  const getWeekDates = (offset: number) => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset + offset * 7);
    return DAYS.map((d, i) => {
      const d2 = new Date(monday);
      d2.setDate(monday.getDate() + i);
      return { ...d, date: d2 };
    });
  };
  const displayedWeekDates = getWeekDates(weekOffset);
  const weekStart = displayedWeekDates[0]?.date;
  const weekEnd = displayedWeekDates[6]?.date;
  const weekLabel = weekStart && weekEnd
    ? `${weekStart.getDate()} ${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][weekStart.getMonth()]} – ${weekEnd.getDate()} ${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][weekEnd.getMonth()]} ${weekEnd.getFullYear()}`
    : '';

  useEffect(() => {
    if (!studentsModal || !token) {
      setStudentsList([]);
      return;
    }
    setStudentsLoading(true);
    fetch(`${API_URL}/api/admin/course-schedules/${studentsModal.id}/students`, { headers: getAuthHeaders(token) })
      .then((r) => r.json())
      .then((data) => {
        setStudentsList(Array.isArray(data?.students) ? data.students : []);
      })
      .catch(() => setStudentsList([]))
      .finally(() => setStudentsLoading(false));
  }, [studentsModal, token]);

  useEffect(() => {
    if (!studentsModal || !token || !changeInstructorId || !changeScheduleStudent) {
      setChangeSlots([]);
      setChangeSlot(null);
      return;
    }
    const url = `${API_URL}/api/admin/available-slots?cohortId=${encodeURIComponent(studentsModal.cohort_id)}&instructorId=${encodeURIComponent(changeInstructorId)}&currentScheduleId=${encodeURIComponent(studentsModal.id)}`;
    fetch(url, { headers: getAuthHeaders(token) })
      .then((r) => r.json())
      .then((data) => setChangeSlots(Array.isArray(data?.slots) ? data.slots : []))
      .catch(() => setChangeSlots([]));
    setChangeSlot(null);
  }, [studentsModal, token, changeInstructorId, changeScheduleStudent]);

  const openChangeSchedule = (st: { id: string; full_name: string }) => {
    setChangeScheduleStudent(st);
    setChangeScheduleError('');
    setChangeInstructorId(studentsModal?.instructor_id ?? '');
    setChangeSlot(studentsModal ? { day_of_week: studentsModal.day_of_week, start_time: typeof studentsModal.start_time === 'string' ? studentsModal.start_time.slice(0, 5) : studentsModal.start_time } : null);
  };

  const submitChangeSchedule = async () => {
    if (!changeScheduleStudent || !studentsModal || !token || !changeSlot) return;
    setChangeScheduleError('');
    setChangeScheduleSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${changeScheduleStudent.id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cohortId: studentsModal.cohort_id,
          instructorId: changeInstructorId,
          dayOfWeek: changeSlot.day_of_week,
          startTime: changeSlot.start_time,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { triggerSessionExpired(); return; }
      if (!res.ok) throw new Error(data?.error || 'Error al cambiar horario');
      setChangeScheduleStudent(null);
      setStudentsModal(null);
      load();
      loadBlocks();
    } catch (err) {
      setChangeScheduleError(err instanceof Error ? err.message : 'Error al cambiar horario');
    } finally {
      setChangeScheduleSubmitting(false);
    }
  };

  const handleDeleteSlot = async (schedule: CourseSchedule) => {
    const courseName = schedule.cohorts?.courses?.name || 'Curso';
    const cohortName = schedule.cohorts?.name || schedule.cohorts?.code || '';
    const dayLabel = DAYS.find((d) => d.value === schedule.day_of_week)?.label || '';
    if (!confirm(`¿Eliminar horario: ${courseName} Nro ${cohortName} - ${dayLabel} ${schedule.start_time}? El alumno asignado quedará sin horario.`)) return;
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/course-schedules/${schedule.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });
      if (res.status === 401) { triggerSessionExpired(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');
      load();
      loadBlocks();
      if (studentsModal?.id === schedule.id) { setStudentsModal(null); setStudentsModalTimeLabel(null); }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const getCohortLabel = (s: CourseSchedule) => {
    const course = s.cohorts?.courses?.name;
    const name = s.cohorts?.name || s.cohorts?.code || '';
    return course ? `${course} Nro ${name}` : s.cohort_id;
  };

  const formatTime = (s: CourseSchedule) => (typeof s.start_time === 'string' ? s.start_time.slice(0, 5) : s.start_time);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 via-teal-600 to-teal-800 p-8 text-white shadow-xl shadow-teal-900/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.06\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-90" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
            <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Horarios</h1>
            <p className="mt-1 text-teal-100 text-sm max-w-xl">Consulta horarios por curso, asigna alumnos y revisa qué días y horas tiene libre cada instructor para inscribir nuevos estudiantes.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        <button
          type="button"
          onClick={() => setTab('by-course')}
          className={`px-5 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            tab === 'by-course'
              ? 'border-teal-600 text-teal-700 bg-white border-b-white -mb-px'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
          }`}
        >
          Horarios por curso
        </button>
        <button
          type="button"
          onClick={() => setTab('by-instructor')}
          className={`px-5 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            tab === 'by-instructor'
              ? 'border-teal-600 text-teal-700 bg-white border-b-white -mb-px'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
          }`}
        >
          Disponibilidad por instructor
        </button>
      </div>

      {apiError && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <svg className="h-5 w-5 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{apiError}</span>
        </div>
      )}

      {/* Tab: Disponibilidad por instructor */}
      {tab === 'by-instructor' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Ver horarios libres</h3>
            <p className="mb-4 text-sm text-slate-600">Elige un instructor para ver en qué días y horas tiene disponibilidad para inscribir a un nuevo estudiante.</p>
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-[240px]">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Instructor</label>
                <select
                  value={availabilityInstructorId}
                  onChange={(e) => setAvailabilityInstructorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-slate-900 transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">Seleccionar instructor</option>
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>{i.full_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {availabilityLoading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 rounded-2xl border border-slate-200 bg-white">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
              <p className="text-sm text-slate-500">Cargando disponibilidad...</p>
            </div>
          )}

          {!availabilityLoading && availabilityInstructorId && availability && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm overflow-x-auto">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-slate-800">Calendario del instructor</h3>
                  <nav className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/80 p-1">
                    <button
                      type="button"
                      onClick={() => setWeekOffset((o) => o - 1)}
                      className="rounded-md p-2 text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all"
                      title="Semana anterior"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <span className="min-w-[180px] px-3 py-1.5 text-sm font-medium text-slate-700 text-center">{weekLabel || 'Semana'}</span>
                    <button
                      type="button"
                      onClick={() => setWeekOffset((o) => o + 1)}
                      className="rounded-md p-2 text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all"
                      title="Semana siguiente"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </nav>
                  {weekOffset !== 0 && (
                    <button type="button" onClick={() => setWeekOffset(0)} className="text-sm text-teal-600 hover:underline">
                      Hoy
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500 text-white text-xs font-medium shadow-sm">✓</span>
                    Libre
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-red-500 text-white text-xs font-medium shadow-sm">·</span>
                    Semana 1 (inicio prácticas)
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-amber-500 text-white text-xs font-medium shadow-sm">·</span>
                    Acabando clase
                  </span>
                </div>
              </div>
              <div className="min-w-[640px]">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="w-14 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sticky left-0 bg-slate-50 z-10">Hora</th>
                      {displayedWeekDates.map((d) => (
                        <th key={d.value} className="py-2 text-center text-xs font-semibold text-slate-600 w-[72px]" title={d.label}>
                          <span className="block">{d.short}</span>
                          <span className="block text-[10px] font-normal text-slate-400">{d.date.getDate()}/{d.date.getMonth() + 1}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {HOURS.map((hour) => (
                      <tr key={hour} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3 text-slate-500 font-medium text-xs sticky left-0 bg-white z-10">{hour}</td>
                        {displayedWeekDates.map((dayInfo, colIndex) => {
                          const d = dayInfo.date;
                          const dateISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                          const key = `${dateISO}-${hour}`;
                          const isOccupied = occupiedSet.has(key);
                          const occupiedLabel = occupiedLabelByKey.get(key);
                          const status = occupiedStatusByKey.get(key);
                          const bg = !isOccupied ? 'bg-emerald-500' : status === 'occupied_ending' ? 'bg-amber-500' : 'bg-red-500';
                          return (
                            <td key={dayInfo.value} className="p-1">
                              <div
                                className={`min-h-9 rounded-lg flex items-center justify-center text-xs font-medium shadow-sm px-1 py-1.5 text-center text-white ${bg}`}
                                title={isOccupied ? (occupiedLabel || '— (ocupado)') : 'Libre'}
                              >
                                {isOccupied ? (occupiedLabel || '— (ocupado)') : '✓'}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-500">Solo se muestran los alumnos en las fechas de su periodo de prácticas (inicio y término). Usa las flechas para cambiar de semana.</p>
            </div>
          )}

          {!availabilityLoading && availabilityInstructorId && !availability && (
            <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-slate-500">
              No se pudo cargar la disponibilidad. Revisa que el instructor exista.
            </div>
          )}

          {!availabilityLoading && !availabilityInstructorId && (
            <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-slate-500">
              Selecciona un instructor para ver sus horarios libres.
            </div>
          )}
        </div>
      )}

      {/* Tab: Horarios por curso */}
      {tab === 'by-course' && (
        <div className="space-y-6">
          {/* Filtros */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Filtros</h3>
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-full sm:min-w-[180px] sm:w-auto">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Curso</label>
                <select
                  value={filterCohortId}
                  onChange={(e) => setFilterCohortId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-slate-900 transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">Todos los cursos</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.courses?.name || 'Curso'} Nro {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:min-w-[180px] sm:w-auto">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Instructor</label>
                <select
                  value={filterInstructorId}
                  onChange={(e) => setFilterInstructorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-slate-900 transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">Todos los instructores</option>
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>{i.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:min-w-[140px] sm:w-auto">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Día</label>
                <select
                  value={filterDay}
                  onChange={(e) => setFilterDay(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-slate-900 transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">Todos</option>
                  {DAYS.filter((d) => d.value <= 7).map((d) => (
                    <option key={d.value} value={String(d.value)}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:min-w-[120px] sm:w-auto">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Hora</label>
                <select
                  value={filterTime}
                  onChange={(e) => setFilterTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-slate-900 transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">Todas</option>
                  {['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'].map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:min-w-[160px] sm:w-auto">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Estado</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-slate-900 transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">Todos</option>
                  <option value="disponible">Disponible</option>
                  <option value="ultimos">Últimos cupos</option>
                  <option value="lleno">Lleno</option>
                </select>
              </div>
              {(filterCohortId || filterInstructorId || filterDay || filterTime || filterStatus) && (
                <button
                  type="button"
                  onClick={() => { setFilterCohortId(''); setFilterInstructorId(''); setFilterDay(''); setFilterTime(''); setFilterStatus(''); }}
                  className="min-h-[44px] rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {/* Contenido: cards por curso */}
          {blocksLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 rounded-2xl border border-slate-200 bg-white">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
              <p className="text-sm text-slate-500">Cargando horarios...</p>
            </div>
          ) : Object.keys(blocksByCourse).length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 rounded-2xl border border-slate-200 bg-white text-center">
              <div className="rounded-full bg-slate-100 p-4">
                <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="font-medium text-slate-700">No hay horarios para mostrar</p>
              <p className="text-sm text-slate-500">
                {(filterCohortId || filterInstructorId || filterDay || filterTime || filterStatus)
                  ? 'Prueba quitando filtros.'
                  : 'Los horarios se crean al inscribir alumnos en Usuarios.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(blocksByCourse).map(([courseName, blocks]) => (
                <div key={courseName} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
                    <h3 className="text-lg font-semibold text-slate-900">{courseName}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{blocks.length} horario(s) disponible(s)</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {blocks.map((block) => {
                      const available = block.totalSlots - block.enrolledCount;
                      const status: 'disponible' | 'ultimos' | 'lleno' = available === 0 ? 'lleno' : available <= 1 ? 'ultimos' : 'disponible';
                      const statusConfig = {
                        disponible: { label: 'Disponible', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
                        ultimos: { label: 'Últimos cupos', className: 'bg-amber-100 text-amber-800 border-amber-200' },
                        lleno: { label: 'Lleno', className: 'bg-red-100 text-red-800 border-red-200' },
                      }[status];
                      const enrollUrl = `/admin/users?cohortId=${encodeURIComponent(block.cohortId)}&instructorId=${encodeURIComponent(block.instructorId)}&scheduleType=${encodeURIComponent(block.scheduleType)}&startTime=${encodeURIComponent(block.startTime)}`;
                      const openVerAlumnos = () => {
                        const synthetic: CourseSchedule = {
                          id: block.firstSlotId,
                          cohort_id: block.cohortId,
                          instructor_id: block.instructorId,
                          day_of_week: block.dayOfWeek,
                          start_time: block.startTime,
                          created_at: '',
                          instructors: { id: block.instructorId, full_name: block.instructorName, email: null },
                          cohorts: { id: block.cohortId, name: block.cohortName, code: block.cohortName, course_id: '', courses: { name: block.courseName } },
                        };
                        setStudentsModal(synthetic);
                        setStudentsModalTimeLabel(block.timeLabel);
                      };
                      return (
                        <div key={block.key} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">
                          <div className="flex-1 min-w-[200px]">
                            <p className="font-medium text-slate-900">{block.timeLabel}</p>
                            <p className="text-sm text-slate-500">Instructor: {block.instructorName}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-slate-700">
                              Cupos: <span className="text-slate-900">{block.enrolledCount}/{block.totalSlots}</span>
                              <span className="text-slate-500 font-normal ml-1">({available} disponibles)</span>
                            </span>
                            <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium ${statusConfig.className}`}>
                              {statusConfig.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {status === 'lleno' ? (
                              <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500 cursor-not-allowed">
                                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                                Sin cupos
                              </span>
                            ) : (
                              <Link
                                href={enrollUrl}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700"
                              >
                                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                                Inscribir alumno
                              </Link>
                            )}
                            <button
                              type="button"
                              onClick={openVerAlumnos}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            >
                              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                              Ver alumnos
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal alumno */}
      {studentsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => { setStudentsModal(null); setStudentsModalTimeLabel(null); }}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Asignación</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {getCohortLabel(studentsModal)}
                    {studentsModalTimeLabel ? ` · ${studentsModalTimeLabel}` : ` · ${DAYS.find((d) => d.value === studentsModal.day_of_week)?.label} ${formatTime(studentsModal)}`}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-teal-600">{studentsModal.instructors?.full_name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setStudentsModal(null); setStudentsModalTimeLabel(null); }}
                  className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
              {studentsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
                </div>
              ) : studentsList.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">Ningún alumno asignado a este horario.</p>
              ) : (
                <div className="space-y-4">
                  {studentsList.map((st) => (
                    <div key={st.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                      <p className="font-semibold text-slate-900">{st.full_name || st.email}</p>
                      <p className="text-sm text-slate-500">{st.email}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {st.cedula && <span className="rounded-md bg-white px-2 py-1 text-slate-600 shadow-sm">Cédula: {st.cedula}</span>}
                        {st.citizenship && <span className="rounded-md bg-white px-2 py-1 text-slate-600 shadow-sm">Ciudadanía: {st.citizenship}</span>}
                        {st.blood_type && <span className="rounded-md bg-white px-2 py-1 text-slate-600 shadow-sm">Tipo sangre: {st.blood_type}</span>}
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => openChangeSchedule(st)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-50"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Cambiar horario
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-slate-100 px-6 py-4">
              <button
                type="button"
onClick={() => { setStudentsModal(null); setStudentsModalTimeLabel(null); }}
              className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cambiar horario */}
      {changeScheduleStudent && studentsModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto" onClick={() => setChangeScheduleStudent(null)}>
          <div className="w-full max-w-md my-auto overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-100 bg-slate-50/80 px-4 sm:px-6 py-4 shrink-0">
              <h3 className="text-lg font-semibold text-slate-900">Cambiar horario</h3>
              <p className="text-sm text-slate-600 mt-0.5">{changeScheduleStudent.full_name}</p>
              <p className="text-xs text-slate-500">Curso: {getCohortLabel(studentsModal)}</p>
            </div>
            <div className="p-4 sm:px-6 space-y-4 overflow-y-auto flex-1 min-h-0">
              {changeScheduleError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{changeScheduleError}</div>
              )}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Instructor</label>
                <select
                  value={changeInstructorId}
                  onChange={(e) => setChangeInstructorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>{i.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Nuevo horario (día y hora)</label>
                <select
                  value={changeSlot ? `${changeSlot.day_of_week}-${(changeSlot.start_time || '').slice(0, 5)}` : ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) { setChangeSlot(null); return; }
                    const firstDash = v.indexOf('-');
                    const d = v.slice(0, firstDash);
                    const t = v.slice(firstDash + 1);
                    const timeNorm = typeof t === 'string' && t.length >= 5 ? t.slice(0, 5) : t;
                    setChangeSlot({ day_of_week: Number(d), start_time: timeNorm });
                  }}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">Seleccionar día y hora</option>
                  {changeSlots.map((s) => {
                    const timeStr = typeof s.start_time === 'string' ? s.start_time.slice(0, 5) : s.start_time;
                    return (
                      <option key={`${s.day_of_week}-${timeStr}`} value={`${s.day_of_week}-${timeStr}`}>
                        {DAYS.find((d) => d.value === s.day_of_week)?.label} {timeStr}
                      </option>
                    );
                  })}
                </select>
                {changeInstructorId && changeSlots.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">No hay horarios libres para este instructor. Elige otro.</p>
                )}
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 border-t border-slate-100 px-4 sm:px-6 py-4 shrink-0">
              <button
                type="button"
                onClick={submitChangeSchedule}
                disabled={!changeSlot || changeScheduleSubmitting}
                className="flex-1 min-h-[44px] rounded-xl bg-teal-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50 disabled:pointer-events-none"
              >
                {changeScheduleSubmitting ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={() => setChangeScheduleStudent(null)}
                className="min-h-[44px] rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
