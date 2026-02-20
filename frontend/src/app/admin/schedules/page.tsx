'use client';

import { useEffect, useState } from 'react';
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
  const [studentsList, setStudentsList] = useState<{ id: string; full_name: string; email: string; cedula: string | null; citizenship: string | null; blood_type: string | null }[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [changeScheduleStudent, setChangeScheduleStudent] = useState<{ id: string; full_name: string } | null>(null);
  const [changeInstructorId, setChangeInstructorId] = useState('');
  const [changeSlot, setChangeSlot] = useState<{ day_of_week: number; start_time: string } | null>(null);
  const [changeSlots, setChangeSlots] = useState<{ day_of_week: number; start_time: string }[]>([]);
  const [changeScheduleSubmitting, setChangeScheduleSubmitting] = useState(false);
  const [changeScheduleError, setChangeScheduleError] = useState('');

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

  useEffect(() => {
    load();
  }, [token, filterCohortId]);

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

  const filteredSchedules = filterInstructorId
    ? schedules.filter((s) => s.instructor_id === filterInstructorId)
    : schedules;

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
    } catch (err) {
      setChangeScheduleError(err instanceof Error ? err.message : 'Error al cambiar horario');
    } finally {
      setChangeScheduleSubmitting(false);
    }
  };

  const handleDelete = async (schedule: CourseSchedule) => {
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
      if (studentsModal?.id === schedule.id) setStudentsModal(null);
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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 via-red-600 to-red-800 p-8 text-white shadow-xl shadow-red-900/25">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-80" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
            <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Horarios por curso</h1>
            <p className="mt-1 text-red-100 text-sm max-w-xl">Asignaciones de alumnos a horarios. Filtra por curso e instructor para revisar qué alumno tiene cada slot.</p>
          </div>
        </div>
      </div>

      {apiError && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          <svg className="h-5 w-5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{apiError}</span>
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-500">Filtros</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px]">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Curso</label>
            <select
              value={filterCohortId}
              onChange={(e) => setFilterCohortId(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 px-4 py-2.5 text-neutral-900 transition-colors focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:ring-offset-0"
            >
              <option value="">Todos los cursos</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.courses?.name || 'Curso'} Nro {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Instructor</label>
            <select
              value={filterInstructorId}
              onChange={(e) => setFilterInstructorId(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 px-4 py-2.5 text-neutral-900 transition-colors focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:ring-offset-0"
            >
              <option value="">Todos los instructores</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>{i.full_name}</option>
              ))}
            </select>
          </div>
          {(filterCohortId || filterInstructorId) && (
            <button
              type="button"
              onClick={() => { setFilterCohortId(''); setFilterInstructorId(''); }}
              className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
            <p className="text-sm text-neutral-500">Cargando horarios...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80">
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Curso</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Instructor</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Día</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Hora</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredSchedules.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-red-50/30">
                    <td className="px-6 py-4">
                      <span className="font-medium text-neutral-900">{getCohortLabel(s)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-2.5 py-1 text-sm font-medium text-neutral-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        {s.instructors?.full_name || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-lg border border-neutral-200 bg-white px-3 py-1 text-sm font-medium text-neutral-700">
                        {DAYS.find((d) => d.value === s.day_of_week)?.label || s.day_of_week}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-lg bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">
                        {formatTime(s)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setStudentsModal(s)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          Ver alumno
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredSchedules.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <div className="rounded-full bg-neutral-100 p-4">
                  <svg className="h-8 w-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="font-medium text-neutral-700">No hay horarios para mostrar</p>
                <p className="text-sm text-neutral-500">
                  {filterCohortId || filterInstructorId ? 'Prueba quitando filtros.' : 'Los horarios se crean al inscribir alumnos en Usuarios.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal alumno */}
      {studentsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setStudentsModal(null)}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">Asignación</h3>
                  <p className="mt-1 text-sm text-neutral-600">
                    {getCohortLabel(studentsModal)} · {DAYS.find((d) => d.value === studentsModal.day_of_week)?.label} {formatTime(studentsModal)}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-red-600">{studentsModal.instructors?.full_name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStudentsModal(null)}
                  className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="max-h-[50vh] overflow-auto p-6">
              {studentsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                </div>
              ) : studentsList.length === 0 ? (
                <p className="py-4 text-center text-sm text-neutral-500">Ningún alumno asignado a este horario.</p>
              ) : (
                <div className="space-y-4">
                  {studentsList.map((st) => (
                    <div key={st.id} className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4">
                      <p className="font-semibold text-neutral-900">{st.full_name || st.email}</p>
                      <p className="text-sm text-neutral-500">{st.email}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {st.cedula && <span className="rounded-md bg-white px-2 py-1 text-neutral-600 shadow-sm">Cédula: {st.cedula}</span>}
                        {st.citizenship && <span className="rounded-md bg-white px-2 py-1 text-neutral-600 shadow-sm">Ciudadanía: {st.citizenship}</span>}
                        {st.blood_type && <span className="rounded-md bg-white px-2 py-1 text-neutral-600 shadow-sm">Tipo sangre: {st.blood_type}</span>}
                      </div>
                      <div className="mt-3 pt-3 border-t border-neutral-100">
                        <button
                          type="button"
                          onClick={() => openChangeSchedule(st)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
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
            <div className="border-t border-neutral-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setStudentsModal(null)}
                className="w-full rounded-xl border border-neutral-200 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cambiar horario */}
      {changeScheduleStudent && studentsModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setChangeScheduleStudent(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-neutral-100 bg-neutral-50/80 px-6 py-4">
              <h3 className="text-lg font-semibold text-neutral-900">Cambiar horario</h3>
              <p className="text-sm text-neutral-600 mt-0.5">{changeScheduleStudent.full_name}</p>
              <p className="text-xs text-neutral-500">Curso: {getCohortLabel(studentsModal)}</p>
            </div>
            <div className="p-6 space-y-4">
              {changeScheduleError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{changeScheduleError}</div>
              )}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">Instructor</label>
                <select
                  value={changeInstructorId}
                  onChange={(e) => setChangeInstructorId(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                >
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>{i.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">Nuevo horario (día y hora)</label>
                <select
                  value={changeSlot ? `${changeSlot.day_of_week}-${changeSlot.start_time}` : ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) { setChangeSlot(null); return; }
                    const [d, t] = v.split('-');
                    setChangeSlot({ day_of_week: Number(d), start_time: t });
                  }}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                >
                  <option value="">Seleccionar día y hora</option>
                  {changeSlots.map((s) => (
                    <option key={`${s.day_of_week}-${s.start_time}`} value={`${s.day_of_week}-${s.start_time}`}>
                      {DAYS.find((d) => d.value === s.day_of_week)?.label} {typeof s.start_time === 'string' ? s.start_time.slice(0, 5) : s.start_time}
                    </option>
                  ))}
                </select>
                {changeInstructorId && changeSlots.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">No hay horarios libres para este instructor. Elige otro.</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 border-t border-neutral-100 px-6 py-4">
              <button
                type="button"
                onClick={submitChangeSchedule}
                disabled={!changeSlot || changeScheduleSubmitting}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none"
              >
                {changeScheduleSubmitting ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={() => setChangeScheduleStudent(null)}
                className="rounded-xl border border-neutral-200 py-2.5 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
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
