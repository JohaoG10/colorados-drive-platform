'use client';

import { useCallback, useEffect, useState } from 'react';
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

const DAY_SHORT_BY_JS: string[] = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

interface AdminCalendarCell {
  hasSlot: boolean;
  free: { instructorId: string; instructorName: string; implicitAvailability?: boolean }[];
  occupied: {
    instructorId: string;
    instructorName: string;
    student_names: string[];
    status: 'occupied_week1' | 'occupied_ending';
  }[];
}

interface AdminScheduleCalendarResponse {
  weekDates: string[];
  hours: string[];
  cells: Record<string, AdminCalendarCell>;
}

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
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
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
  const [scheduleCalendar, setScheduleCalendar] = useState<AdminScheduleCalendarResponse | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [weekOffsetByCourse, setWeekOffsetByCourse] = useState(0);
  const [availabilityInstructorId, setAvailabilityInstructorId] = useState('');
  const [availability, setAvailability] = useState<{ occupied: { date: string; start_time: string; student_names: string[]; status: 'occupied_week1' | 'occupied_ending' }[]; free: { date: string; start_time: string }[] } | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  /** Lunes y domingo de la semana (offset 0 = actual) para Horarios por curso. */
  const getWeekStartEndByCourse = (offset: number) => {
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

  const loadCalendar = useCallback(() => {
    if (!token) return;
    setCalendarLoading(true);
    const params = new URLSearchParams();
    const { weekStart, weekEnd } = getWeekStartEndByCourse(weekOffsetByCourse);
    params.set('weekStart', weekStart);
    params.set('weekEnd', weekEnd);
    if (filterCohortId) params.set('cohortId', filterCohortId);
    if (filterInstructorId) params.set('instructorId', filterInstructorId);
    fetch(`${API_URL}/api/admin/schedule-calendar?${params.toString()}`, { headers: getAuthHeaders(token) })
      .then((r) => r.json().then((d) => ({ ok: r.ok, status: r.status, data: d })))
      .then(({ ok, status, data }) => {
        if (status === 401) triggerSessionExpired();
        if (ok && data && Array.isArray(data.weekDates) && Array.isArray(data.hours) && data.cells && typeof data.cells === 'object') {
          setScheduleCalendar(data as AdminScheduleCalendarResponse);
        } else {
          setScheduleCalendar(null);
        }
      })
      .catch(() => setScheduleCalendar(null))
      .finally(() => setCalendarLoading(false));
  }, [token, weekOffsetByCourse, filterCohortId, filterInstructorId]);

  useEffect(() => {
    if (tab === 'by-course') loadCalendar();
  }, [tab, loadCalendar]);

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

  const calendarCellKey = (date: string, hour: string) => {
    const h = hour.trim().slice(0, 5);
    const norm = h.length === 4 && h[1] === ':' ? `0${h}` : h;
    return `${date.slice(0, 10)}|${norm}`;
  };

  const cellMatchesStatusFilter = (cell: AdminCalendarCell): boolean => {
    if (!filterStatus || !cell.hasSlot) return true;
    const hasF = cell.free.length > 0;
    const hasO = cell.occupied.length > 0;
    if (filterStatus === 'disponible') return hasF && !hasO;
    if (filterStatus === 'ultimos') return hasF && hasO;
    if (filterStatus === 'lleno') return hasO && !hasF;
    return true;
  };

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
      loadCalendar();
    } catch (err) {
      setChangeScheduleError(err instanceof Error ? err.message : 'Error al cambiar horario');
    } finally {
      setChangeScheduleSubmitting(false);
    }
  };

  const getCohortLabel = (s: CourseSchedule) => {
    const course = s.cohorts?.courses?.name;
    const name = s.cohorts?.name || s.cohorts?.code || '';
    return course ? `${course} Nro ${name}` : s.cohort_id;
  };

  const formatTime = (s: CourseSchedule) => (typeof s.start_time === 'string' ? s.start_time.slice(0, 5) : s.start_time);

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-teal-600 via-teal-600 to-teal-800 p-4 sm:p-6 lg:p-8 text-white shadow-xl shadow-teal-900/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.06\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-90" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
          <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
            <svg className="h-6 w-6 sm:h-7 sm:w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Horarios</h1>
            <p className="mt-1.5 text-teal-100 text-xs sm:text-sm leading-relaxed max-w-2xl">
              Vista tipo calendario con todos los instructores: en cada día y hora verás quién tiene cupo libre y quién está ocupado, para planear inscripciones sin abrir cada agenda por separado.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 sm:gap-2 border-b border-slate-200 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] pb-px">
        <button
          type="button"
          onClick={() => setTab('by-course')}
          className={`shrink-0 touch-manipulation whitespace-nowrap px-3 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            tab === 'by-course'
              ? 'border-teal-600 text-teal-700 bg-white border-b-white -mb-px'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
          }`}
        >
          Calendario de cupos
        </button>
        <button
          type="button"
          onClick={() => setTab('by-instructor')}
          className={`shrink-0 touch-manipulation whitespace-nowrap px-3 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            tab === 'by-instructor'
              ? 'border-teal-600 text-teal-700 bg-white border-b-white -mb-px'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
          }`}
        >
          Disponibilidad por instructor
        </button>
      </div>

      {apiError && (
        <div className="flex items-start sm:items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 sm:px-4 text-sm text-amber-800">
          <svg className="h-5 w-5 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{apiError}</span>
        </div>
      )}

      {/* Tab: Disponibilidad por instructor */}
      {tab === 'by-instructor' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
            <h3 className="mb-2 sm:mb-3 text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-500">Ver horarios libres</h3>
            <p className="mb-4 text-xs sm:text-sm text-slate-600 leading-relaxed">Elige un instructor para ver en qué días y horas tiene disponibilidad para inscribir a un nuevo estudiante.</p>
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-end gap-4">
              <div className="w-full sm:min-w-[240px] sm:flex-1 sm:max-w-md">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Instructor</label>
                <select
                  value={availabilityInstructorId}
                  onChange={(e) => setAvailabilityInstructorId(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-base sm:text-sm text-slate-900 transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
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
            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-6 shadow-sm w-full min-w-0">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-4 sm:mb-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center min-w-0">
                  <h3 className="font-semibold text-slate-800 text-sm sm:text-base shrink-0">Calendario del instructor</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <nav className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50/80 p-1 touch-manipulation">
                      <button
                        type="button"
                        onClick={() => setWeekOffset((o) => o - 1)}
                        className="rounded-md p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all"
                        title="Semana anterior"
                        aria-label="Semana anterior"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <span className="min-w-[min(100%,11rem)] px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 text-center tabular-nums">{weekLabel || 'Semana'}</span>
                      <button
                        type="button"
                        onClick={() => setWeekOffset((o) => o + 1)}
                        className="rounded-md p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all"
                        title="Semana siguiente"
                        aria-label="Semana siguiente"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </nav>
                    {weekOffset !== 0 && (
                      <button type="button" onClick={() => setWeekOffset(0)} className="text-sm font-medium text-teal-600 hover:underline touch-manipulation py-2 px-1">
                        Hoy
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] sm:text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-white text-[10px] sm:text-xs font-medium shadow-sm">✓</span>
                    <span className="leading-tight">Libre</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-md bg-red-500 text-white text-[10px] sm:text-xs font-medium shadow-sm">·</span>
                    <span className="leading-tight max-w-[10rem] sm:max-w-none">Semana 1</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-md bg-amber-500 text-white text-[10px] sm:text-xs font-medium shadow-sm">·</span>
                    <span className="leading-tight">Acabando clase</span>
                  </span>
                </div>
              </div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] text-slate-500 md:hidden">
                <svg className="h-3.5 w-3.5 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
                Desliza horizontalmente para ver todos los días
              </p>
              <div className="overflow-x-auto overflow-y-visible -mx-3 px-3 sm:mx-0 sm:px-0 overscroll-x-contain [touch-action:pan-x] pb-1">
                <div className="inline-block w-full min-w-[36rem] sm:min-w-[640px] align-top">
                  <table className="w-full text-xs sm:text-sm border-collapse table-fixed">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80">
                        <th className="w-11 sm:w-14 py-2 sm:py-3 pl-1 pr-1 sm:pr-2 text-left text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 sticky left-0 z-20 bg-slate-50 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">Hora</th>
                        {displayedWeekDates.map((d) => (
                          <th key={d.value} className="py-1.5 sm:py-2 px-0.5 text-center text-[10px] sm:text-xs font-semibold text-slate-600" title={d.label}>
                            <span className="block truncate">{d.short}</span>
                            <span className="block text-[9px] sm:text-[10px] font-normal text-slate-400 tabular-nums">{d.date.getDate()}/{d.date.getMonth() + 1}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {HOURS.map((hour) => (
                        <tr key={hour} className="border-b border-slate-100 last:border-0">
                          <td className="py-1.5 sm:py-2 pr-1 sm:pr-3 text-slate-500 font-medium text-[10px] sm:text-xs tabular-nums sticky left-0 z-10 bg-white shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)]">{hour}</td>
                          {displayedWeekDates.map((dayInfo) => {
                            const d = dayInfo.date;
                            const dateISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                            const key = `${dateISO}-${hour}`;
                            const isOccupied = occupiedSet.has(key);
                            const occupiedLabel = occupiedLabelByKey.get(key);
                            const status = occupiedStatusByKey.get(key);
                            const bg = !isOccupied ? 'bg-emerald-500' : status === 'occupied_ending' ? 'bg-amber-500' : 'bg-red-500';
                            return (
                              <td key={dayInfo.value} className="p-0.5 sm:p-1 align-top">
                                <div
                                  className={`min-h-[2.25rem] sm:min-h-9 rounded-md sm:rounded-lg flex items-center justify-center text-[9px] sm:text-xs font-medium shadow-sm px-0.5 py-1 sm:px-1 sm:py-1.5 text-center text-white leading-tight ${bg}`}
                                  title={isOccupied ? (occupiedLabel || '— (ocupado)') : 'Libre'}
                                >
                                  {isOccupied ? (
                                    <span className="line-clamp-3 break-words hyphens-auto">{occupiedLabel || '—'}</span>
                                  ) : (
                                    '✓'
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="mt-3 text-[11px] sm:text-xs text-slate-500 leading-relaxed">Solo se muestran los alumnos en las fechas de su periodo de prácticas. Usa las flechas para cambiar de semana.</p>
            </div>
          )}

          {!availabilityLoading && availabilityInstructorId && !availability && (
            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white py-10 sm:py-12 px-4 text-center text-sm text-slate-500">
              No se pudo cargar la disponibilidad. Revisa que el instructor exista.
            </div>
          )}

          {!availabilityLoading && !availabilityInstructorId && (
            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white py-10 sm:py-12 px-4 text-center text-sm text-slate-500">
              Selecciona un instructor para ver sus horarios libres.
            </div>
          )}
        </div>
      )}

      {/* Tab: Horarios por curso */}
      {tab === 'by-course' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Navegación semanal (mismo estilo que Disponibilidad por instructor) */}
          <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
            <h3 className="mb-2 sm:mb-3 text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-500">Semana a consultar</h3>
            <p className="mb-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
              La grilla cruza la semana con las mismas reglas que el calendario del instructor: alumnos visibles solo en su periodo de prácticas.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
              <nav className="inline-flex w-full sm:w-auto items-center justify-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50/80 p-1.5 touch-manipulation">
                <button
                  type="button"
                  onClick={() => setWeekOffsetByCourse((o) => o - 1)}
                  className="rounded-lg p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all"
                  title="Semana anterior"
                  aria-label="Semana anterior"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="min-w-0 flex-1 sm:flex-none sm:min-w-[11rem] px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-800 text-center leading-snug">
                  {(() => {
                    const { weekStart, weekEnd } = getWeekStartEndByCourse(weekOffsetByCourse);
                    const d1 = new Date(weekStart + 'T12:00:00');
                    const d2 = new Date(weekEnd + 'T12:00:00');
                    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
                    return `${d1.getDate()} ${months[d1.getMonth()]} – ${d2.getDate()} ${months[d2.getMonth()]} ${d2.getFullYear()}`;
                  })()}
                </span>
                <button
                  type="button"
                  onClick={() => setWeekOffsetByCourse((o) => o + 1)}
                  className="rounded-lg p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all"
                  title="Semana siguiente"
                  aria-label="Semana siguiente"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </nav>
              {weekOffsetByCourse !== 0 && (
                <button
                  type="button"
                  onClick={() => setWeekOffsetByCourse(0)}
                  className="w-full sm:w-auto min-h-[44px] rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-medium text-teal-700 hover:bg-teal-100 transition-colors touch-manipulation"
                >
                  Hoy
                </button>
              )}
            </div>
          </div>

          {/* Filtros: curso, instructor, estado */}
          <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
            <h3 className="mb-3 sm:mb-4 text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-500">Filtros</h3>
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-full sm:min-w-[180px] sm:w-auto">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Curso</label>
                <select
                  value={filterCohortId}
                  onChange={(e) => setFilterCohortId(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-base sm:text-sm text-slate-900 transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
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
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-base sm:text-sm text-slate-900 transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">Todos los instructores</option>
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>{i.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:min-w-[160px] sm:w-auto">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Estado</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-base sm:text-sm text-slate-900 transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">Todos</option>
                  <option value="disponible">Disponible</option>
                  <option value="ultimos">Últimos cupos</option>
                  <option value="lleno">Lleno</option>
                </select>
              </div>
              {(filterCohortId || filterInstructorId || filterStatus) && (
                <button
                  type="button"
                  onClick={() => { setFilterCohortId(''); setFilterInstructorId(''); setFilterStatus(''); }}
                  className="w-full sm:w-auto min-h-[44px] rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 touch-manipulation"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {/* Calendario agregado */}
          {calendarLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 sm:py-20 rounded-xl sm:rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
              <p className="text-sm text-slate-500">Cargando calendario…</p>
            </div>
          ) : scheduleCalendar && scheduleCalendar.weekDates.length > 0 ? (
            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-6 shadow-md shadow-slate-200/50 w-full min-w-0 max-w-full">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-4 sm:mb-5">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 text-base sm:text-lg tracking-tight">Disponibilidad de instructores</h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                    Tres estados: <strong className="text-emerald-700">libre</strong> para inscribir, <strong className="text-rose-700">ocupado</strong> con alumno, <strong className="text-amber-800">acabando clase</strong> en la última etapa de prácticas.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-[11px] font-semibold text-slate-700 shrink-0">
                  <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg bg-emerald-100 px-2 sm:px-3 py-1.5 ring-1 ring-emerald-300/70">
                    <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-emerald-500 shadow-sm shrink-0" />
                    Libre
                  </span>
                  <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg bg-rose-100 px-2 sm:px-3 py-1.5 ring-1 ring-rose-300/70">
                    <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-rose-500 shadow-sm shrink-0" />
                    Ocupado
                  </span>
                  <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg bg-amber-100 px-2 sm:px-3 py-1.5 ring-1 ring-amber-300/70">
                    <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-amber-500 shadow-sm shrink-0" />
                    Acabando clase
                  </span>
                </div>
              </div>

              {(() => {
                let cellsWithSlot = 0;
                let freeOnlyCells = 0;
                let mixedCells = 0;
                let fullCells = 0;
                for (const k of Object.keys(scheduleCalendar.cells)) {
                  const c = scheduleCalendar.cells[k];
                  if (!c?.hasSlot) continue;
                  cellsWithSlot += 1;
                  const f = c.free.length > 0;
                  const o = c.occupied.length > 0;
                  if (f && !o) freeOnlyCells += 1;
                  else if (f && o) mixedCells += 1;
                  else if (o) fullCells += 1;
                }
                return (
                  <p className="text-xs sm:text-sm text-slate-600 mb-3 sm:mb-4 leading-relaxed">
                    <span className="font-semibold text-slate-800">{cellsWithSlot}</span> celdas con actividad esta semana
                    {filterStatus && (
                      <span className="text-slate-500">
                        {' '}
                        · filtro:{' '}
                        {filterStatus === 'disponible' ? 'solo cupos libres' : filterStatus === 'ultimos' ? 'mixto (libre + ocupado)' : 'solo llenos'}
                      </span>
                    )}
                    {cellsWithSlot > 0 && (
                      <span className="text-slate-500">
                        {' '}
                        — {freeOnlyCells} solo libres, {mixedCells} mixtas, {fullCells} solo ocupadas
                      </span>
                    )}
                  </p>
                );
              })()}

              <p className="mb-2 flex items-center gap-1.5 text-[11px] text-slate-500 md:hidden">
                <svg className="h-3.5 w-3.5 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
                Desliza horizontalmente para ver todos los días
              </p>
              <div className="overflow-x-auto overflow-y-visible -mx-3 px-3 sm:mx-0 sm:px-0 overscroll-x-contain [touch-action:pan-x] pb-1 rounded-xl bg-slate-200/35 sm:bg-transparent">
                <div className="inline-block min-w-[34rem] sm:min-w-[720px] w-full align-top rounded-xl bg-slate-200/35 p-1.5 sm:p-2.5">
                  <table className="w-full text-[10px] sm:text-sm border-separate border-spacing-1 sm:border-spacing-2 table-fixed">
                  <thead>
                    <tr>
                      <th className="w-[44px] sm:w-[56px] rounded-md sm:rounded-lg bg-slate-700 py-2 sm:py-3 pl-1 pr-0.5 sm:pr-1 text-left text-[8px] sm:text-[10px] font-bold uppercase tracking-wide sm:tracking-widest text-slate-200 sticky left-0 z-20 shadow-lg shadow-slate-900/15 ring-1 ring-slate-600/50">
                        Hora
                      </th>
                      {scheduleCalendar.weekDates.map((iso) => {
                        const d = new Date(`${iso}T12:00:00`);
                        const short = DAY_SHORT_BY_JS[d.getDay()];
                        return (
                          <th
                            key={iso}
                            className="rounded-md sm:rounded-lg bg-gradient-to-b from-slate-700 to-slate-800 py-2 sm:py-3 px-0.5 sm:px-1.5 text-center text-[10px] sm:text-xs font-semibold text-white shadow-md shadow-slate-900/20 ring-1 ring-slate-600/40 min-w-[68px] sm:min-w-[104px]"
                            title={iso}
                          >
                            <span className="block text-white truncate">{short}</span>
                            <span className="block text-[8px] sm:text-[10px] font-medium text-slate-300 tabular-nums mt-0.5 sm:mt-1">
                              {d.getDate()}/{d.getMonth() + 1}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleCalendar.hours.map((hour) => (
                      <tr key={hour}>
                        <td className="rounded-md sm:rounded-lg bg-white py-2 sm:py-2.5 pl-1 pr-0.5 sm:pr-1 text-center text-slate-700 font-bold text-[9px] sm:text-[11px] tabular-nums sticky left-0 z-10 shadow-md shadow-slate-300/30 ring-1 ring-slate-200">
                          {hour}
                        </td>
                        {scheduleCalendar.weekDates.map((dateStr) => {
                          const cell =
                            scheduleCalendar.cells[calendarCellKey(dateStr, hour)] ?? {
                              hasSlot: false,
                              free: [],
                              occupied: [],
                            };
                          const dimmed = Boolean(filterStatus && cell.hasSlot && !cellMatchesStatusFilter(cell));
                          const titleParts: string[] = [];
                          if (cell.free.length) {
                            titleParts.push(`Libre: ${cell.free.map((x) => x.instructorName).join(', ')}`);
                          }
                          if (cell.occupied.length) {
                            cell.occupied.forEach((o) => {
                              const st = o.student_names?.length ? ` — ${o.student_names.join(', ')}` : '';
                              titleParts.push(`${o.instructorName}${st}`);
                            });
                          }
                          return (
                            <td key={`${dateStr}-${hour}`} className="p-0 align-top">
                              <div
                                className={`rounded-md sm:rounded-xl min-h-[52px] sm:min-h-[58px] overflow-hidden bg-white ring-1 ring-slate-300/80 shadow-sm transition-all sm:hover:shadow-md sm:hover:ring-slate-400/60 ${
                                  dimmed ? 'opacity-[0.42] saturate-50' : ''
                                }`}
                                title={titleParts.length ? titleParts.join(' | ') : undefined}
                              >
                                {!cell.hasSlot ? (
                                  <div className="min-h-[52px] sm:min-h-[58px] flex items-center justify-center bg-white">
                                    <span className="text-slate-300 text-[10px] sm:text-xs" aria-hidden>
                                      ·
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col min-h-[52px] sm:min-h-[58px] gap-0.5 sm:gap-1 p-0.5 sm:p-1">
                                    {cell.free.length > 0 && (
                                      <div className="rounded-md sm:rounded-lg border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-teal-50/80 to-emerald-100/50 px-1.5 sm:px-2 py-1 sm:py-1.5 space-y-0.5 sm:space-y-1 shadow-sm">
                                        <p className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wide text-emerald-800">
                                          Libre · {cell.free.length}
                                        </p>
                                        {cell.free.map((f, fi) => (
                                          <p
                                            key={`${f.instructorId}-${fi}`}
                                            className="text-[8px] sm:text-[10px] font-semibold leading-snug text-emerald-950 line-clamp-2 sm:truncate border-l-2 border-emerald-500 pl-1 sm:pl-1.5"
                                            title={f.instructorName}
                                          >
                                            {f.instructorName}
                                          </p>
                                        ))}
                                      </div>
                                    )}
                                    {cell.occupied.length > 0 && (
                                      <div className="flex flex-col gap-0.5 sm:gap-1">
                                        {cell.occupied.map((o) => {
                                          const ending = o.status === 'occupied_ending';
                                          const names = o.student_names?.length ? o.student_names.join(', ') : '';
                                          return (
                                            <div
                                              key={o.instructorId}
                                              className={`rounded-md sm:rounded-lg border-y border-r px-1.5 sm:px-2 py-1 sm:py-1.5 shadow-sm ${
                                                ending
                                                  ? 'border-amber-300/90 border-l-[3px] sm:border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-100 to-amber-50'
                                                  : 'border-rose-300/90 border-l-[3px] sm:border-l-4 border-l-rose-500 bg-gradient-to-br from-rose-100 to-rose-50'
                                              }`}
                                            >
                                              <p
                                                className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wide leading-tight line-clamp-2 sm:truncate text-slate-900"
                                                title={o.instructorName}
                                              >
                                                {o.instructorName}
                                                <span className={`font-bold normal-case ${ending ? 'text-amber-900' : 'text-rose-900'}`}>
                                                  {ending ? ' · acabando' : ' · ocupado'}
                                                </span>
                                              </p>
                                              {names ? (
                                                <p
                                                  className="text-[8px] sm:text-[9px] font-semibold normal-case text-slate-700 mt-0.5 line-clamp-2"
                                                  title={names}
                                                >
                                                  {names}
                                                </p>
                                              ) : null}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>

              <div className="mt-4 sm:mt-5 flex flex-col-reverse sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 border-t border-slate-200/80 pt-4">
                <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
                  Mantén pulsada una celda o pasa el cursor para ver el texto completo. El filtro «Estado» atenúa las celdas que no coinciden.
                </p>
                <Link
                  href={`/admin/users${filterCohortId ? `?cohortId=${encodeURIComponent(filterCohortId)}` : ''}`}
                  className="inline-flex w-full sm:w-auto min-h-[44px] items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-600/95 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition-colors touch-manipulation"
                >
                  Inscribir alumno
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white py-12 sm:py-16 px-4 text-center text-sm text-slate-500 shadow-sm">
              No hay datos de calendario para esta semana o filtros. Prueba otra semana o amplía el curso/instructor.
            </div>
          )}
        </div>
      )}

      {/* Modal alumno */}
      {studentsModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]" onClick={() => { setStudentsModal(null); setStudentsModalTimeLabel(null); }}>
          <div className="w-full max-w-lg max-h-[92dvh] sm:max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-4 sm:px-6 sm:py-5 shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-slate-900">Asignación</h3>
                  <p className="mt-1 text-xs sm:text-sm text-slate-600 break-words">
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
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
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
            <div className="border-t border-slate-100 px-4 py-3 sm:px-6 sm:py-4 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4">
              <button
                type="button"
                onClick={() => { setStudentsModal(null); setStudentsModalTimeLabel(null); }}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 touch-manipulation"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cambiar horario */}
      {changeScheduleStudent && studentsModal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm overflow-y-auto pb-[env(safe-area-inset-bottom)]" onClick={() => setChangeScheduleStudent(null)}>
          <div className="w-full max-w-md my-auto sm:my-4 overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl max-h-[min(92dvh,720px)] flex flex-col" onClick={(e) => e.stopPropagation()}>
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
            <div className="flex flex-col-reverse sm:flex-row gap-2 border-t border-slate-100 px-4 sm:px-6 py-3 sm:py-4 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4">
              <button
                type="button"
                onClick={submitChangeSchedule}
                disabled={!changeSlot || changeScheduleSubmitting}
                className="flex-1 min-h-[44px] rounded-xl bg-teal-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50 disabled:pointer-events-none touch-manipulation"
              >
                {changeScheduleSubmitting ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={() => setChangeScheduleStudent(null)}
                className="min-h-[44px] rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 touch-manipulation"
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
