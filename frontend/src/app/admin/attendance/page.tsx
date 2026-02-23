'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders, triggerSessionExpired } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Cohort {
  id: string;
  name: string;
  code: string;
  course_id: string;
  courses?: { name: string };
}

interface AttendanceRow {
  userId: string;
  fullName: string;
  email: string;
  startDate: string | null;
  endDate: string | null;
  records: { date: string; status: string }[];
  daysPresent: number;
  totalDays: number;
}

function getDateRange(startStr: string, endStr: string): string[] {
  const out: string[] = [];
  const start = new Date(startStr);
  const end = new Date(endStr);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function AdminAttendancePage() {
  const { token } = useAuth();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [cohortId, setCohortId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [list, setList] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editStudent, setEditStudent] = useState<AttendanceRow | null>(null);
  const [editMap, setEditMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/admin/cohorts`, { headers: getAuthHeaders(token) })
      .then((r) => r.json().then((d) => ({ status: r.status, data: d })))
      .then(({ status, data }) => {
        if (status === 401) { triggerSessionExpired(); return; }
        setCohorts(Array.isArray(data) ? data : []);
      })
      .catch(() => setCohorts([]));
  }, [token]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const first = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    if (!startDate) setStartDate(first);
    if (!endDate) setEndDate(today);
  }, []);

  const loadAttendance = () => {
    if (!token || !cohortId || !startDate || !endDate) return;
    setError('');
    setLoading(true);
    const url = `${API_URL}/api/admin/attendance?cohortId=${encodeURIComponent(cohortId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
    fetch(url, { headers: getAuthHeaders(token) })
      .then((r) => r.json().then((d) => ({ status: r.status, data: d })))
      .then(({ status, data }) => {
        if (status === 401) { triggerSessionExpired(); return; }
        if (status !== 200) {
          setError(data?.error || 'Error al cargar');
          setList([]);
          return;
        }
        setList(Array.isArray(data) ? data : []);
      })
      .catch(() => { setList([]); setError('Error de conexión'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (cohortId && startDate && endDate && token) loadAttendance();
  }, [cohortId, token]);

  const openEdit = (row: AttendanceRow) => {
    const dates = getDateRange(startDate, endDate);
    const map: Record<string, string> = {};
    dates.forEach((d) => {
      const rec = row.records.find((r) => r.date === d);
      map[d] = rec?.status ?? 'absent';
    });
    setEditMap(map);
    setEditStudent(row);
  };

  const saveAttendance = async () => {
    if (!editStudent || !token) return;
    const dates = getDateRange(startDate, endDate);
    const initialMap: Record<string, string> = {};
    editStudent.records.forEach((r) => { initialMap[r.date] = r.status; });
    const defaultStatus = 'absent';
    const toSend = dates.filter((d) => (editMap[d] ?? defaultStatus) !== (initialMap[d] ?? defaultStatus));
    setSaving(true);
    try {
      for (const date of toSend) {
        const res = await fetch(`${API_URL}/api/admin/attendance/set`, {
          method: 'POST',
          headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: editStudent.userId, date, status: editMap[date] ?? 'absent' }),
        });
        const data = await res.json();
        if (res.status === 401) { triggerSessionExpired(); setEditStudent(null); return; }
        if (!res.ok) throw new Error(data?.error || 'Error al guardar');
      }
      setEditStudent(null);
      loadAttendance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const cohortLabel = cohorts.find((c) => c.id === cohortId);
  const totalDays = list[0]?.totalDays ?? 0;

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 p-8 text-white shadow-xl">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold mb-1">Asistencia</h1>
          <p className="text-teal-100 text-sm max-w-xl">
            Consulta y registra la asistencia por curso en el periodo de inicio y término. La asistencia se marca automáticamente cuando el estudiante entra a la plataforma; aquí puedes corregir o completar día a día.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-neutral-900 mb-4">Filtros</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[220px]">
            <label className="block text-sm font-medium text-neutral-700 mb-1">Curso (número de curso)</label>
            <select
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="">Seleccionar curso</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>{c.courses?.name || 'Curso'} Nro {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
          <button
            type="button"
            onClick={loadAttendance}
            className="px-5 py-2.5 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors"
          >
            Actualizar
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
          <h3 className="font-semibold text-neutral-900">Reporte de asistencia</h3>
          {cohortId && (
            <p className="text-sm text-neutral-500 mt-0.5">
              {cohortLabel ? `${cohortLabel.courses?.name || 'Curso'} Nro ${cohortLabel.name}` : ''} · {startDate} a {endDate}
              {totalDays > 0 && ` · ${totalDays} días en el periodo`}
            </p>
          )}
        </div>
        {loading ? (
          <div className="p-12 text-center text-neutral-500">Cargando...</div>
        ) : !cohortId ? (
          <div className="p-12 text-center text-neutral-500">Selecciona un curso y rango de fechas.</div>
        ) : list.length === 0 ? (
          <div className="p-12 text-center text-neutral-500">No hay estudiantes en este curso.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-neutral-50/80 border-b border-neutral-100">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Estudiante</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Días presentes</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Total días</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">%</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-neutral-700 w-36">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {list.map((row) => {
                  const pct = row.totalDays > 0 ? Math.round((row.daysPresent / row.totalDays) * 100) : 0;
                  return (
                    <tr key={row.userId} className="hover:bg-neutral-50/50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-neutral-900">{row.fullName || row.email}</p>
                        <p className="text-sm text-neutral-500">{row.email}</p>
                      </td>
                      <td className="px-6 py-4 text-neutral-700">{row.daysPresent}</td>
                      <td className="px-6 py-4 text-neutral-700">{row.totalDays}</td>
                      <td className="px-6 py-4">
                        <span className={`font-medium ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {pct}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="text-teal-600 hover:text-teal-700 font-medium text-sm"
                        >
                          Registrar / Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !saving && setEditStudent(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center">
              <h3 className="font-semibold text-neutral-900">Asistencia: {editStudent.fullName || editStudent.email}</h3>
              <button type="button" onClick={() => !saving && setEditStudent(null)} className="text-neutral-500 hover:text-neutral-700 p-1">✕</button>
            </div>
            <div className="p-6 overflow-auto flex-1">
              <p className="text-sm text-neutral-500 mb-4">
                Periodo: {startDate} a {endDate}. Marca cada día como Presente, Ausente o Justificado.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {getDateRange(startDate, endDate).map((date) => (
                  <div key={date} className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-neutral-500">
                      {new Date(date + 'T12:00:00').toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </label>
                    <select
                      value={editMap[date] ?? 'absent'}
                      onChange={(e) => setEditMap((m) => ({ ...m, [date]: e.target.value }))}
                      className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                    >
                      <option value="present">Presente</option>
                      <option value="absent">Ausente</option>
                      <option value="excused">Justificado</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-neutral-100 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => !saving && setEditStudent(null)}
                className="px-4 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveAttendance}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
