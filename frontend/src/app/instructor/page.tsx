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

const HOURS = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'];

export default function InstructorSchedulePage() {
  const { token } = useAuth();
  const [availability, setAvailability] = useState<{
    occupied: { date: string; start_time: string; student_names: string[]; status: 'occupied_week1' | 'occupied_ending' }[];
    free: { date: string; start_time: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);

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

  useEffect(() => {
    if (!token) return;
    setApiError('');
    setLoading(true);
    const { weekStart, weekEnd } = getWeekStartEnd(weekOffset);
    fetch(
      `${API_URL}/api/instructor/availability?weekStart=${encodeURIComponent(weekStart)}&weekEnd=${encodeURIComponent(weekEnd)}`,
      { headers: getAuthHeaders(token) }
    )
      .then((r) => r.json().then((data) => ({ ok: r.ok, status: r.status, data })))
      .then(({ ok, status, data }) => {
        if (ok && data && Array.isArray(data.occupied) && Array.isArray(data.free)) {
          setAvailability({ occupied: data.occupied, free: data.free });
        } else {
          setAvailability(null);
          if (status === 401) triggerSessionExpired();
          else setApiError(data?.error || 'Error al cargar tu calendario.');
        }
      })
      .catch(() => {
        setAvailability(null);
        setApiError('Error de conexión.');
      })
      .finally(() => setLoading(false));
  }, [token, weekOffset]);

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

  const displayedWeekDates = getWeekDates(weekOffset);
  const weekStart = displayedWeekDates[0]?.date;
  const weekEnd = displayedWeekDates[6]?.date;
  const weekLabel =
    weekStart && weekEnd
      ? `${weekStart.getDate()} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][weekStart.getMonth()]} – ${weekEnd.getDate()} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][weekEnd.getMonth()]} ${weekEnd.getFullYear()}`
      : '';

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 via-teal-600 to-teal-800 p-4 sm:p-8 text-white shadow-xl shadow-teal-900/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.06\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-90" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
            <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mi calendario semanal</h1>
            <p className="mt-1 text-teal-100 text-sm max-w-xl">
              Revisa en qué días y horas tienes clase y con qué alumnos. Verde = libre, rojo/naranja = ocupado.
            </p>
          </div>
        </div>
      </div>

      {apiError && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <svg className="h-5 w-5 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{apiError}</span>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-slate-800">Calendario</h2>
            <nav className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/80 p-1">
              <button
                type="button"
                onClick={() => setWeekOffset((o) => o - 1)}
                className="rounded-md p-2 text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all"
                title="Semana anterior"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="min-w-[200px] px-3 py-1.5 text-sm font-medium text-slate-700 text-center">
                {weekLabel || 'Semana'}
              </span>
              <button
                type="button"
                onClick={() => setWeekOffset((o) => o + 1)}
                className="rounded-md p-2 text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all"
                title="Semana siguiente"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </nav>
            {weekOffset !== 0 && (
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="text-sm text-teal-600 hover:underline"
              >
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

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            <p className="text-sm text-slate-500">Cargando calendario...</p>
          </div>
        ) : (
          <div className="min-w-[640px]">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="w-14 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sticky left-0 bg-slate-50 z-10">
                    Hora
                  </th>
                  {displayedWeekDates.map((d) => (
                    <th
                      key={d.value}
                      className="py-2 text-center text-xs font-semibold text-slate-600 w-[72px]"
                      title={d.label}
                    >
                      <span className="block">{d.short}</span>
                      <span className="block text-[10px] font-normal text-slate-400">
                        {d.date.getDate()}/{d.date.getMonth() + 1}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 text-slate-500 font-medium text-xs sticky left-0 bg-white z-10">
                      {hour}
                    </td>
                    {displayedWeekDates.map((dayInfo) => {
                      const d = dayInfo.date;
                      const dateISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                      const key = `${dateISO}-${hour}`;
                      const isOccupied = occupiedSet.has(key);
                      const occupiedLabel = occupiedLabelByKey.get(key);
                      const status = occupiedStatusByKey.get(key);
                      const bg = !isOccupied
                        ? 'bg-emerald-500'
                        : status === 'occupied_ending'
                          ? 'bg-amber-500'
                          : 'bg-red-500';
                      return (
                        <td key={dayInfo.value} className="p-1">
                          <div
                            className={`min-h-9 rounded-lg flex items-center justify-center text-xs font-medium shadow-sm px-1 py-1.5 text-center text-white ${bg}`}
                            title={isOccupied ? occupiedLabel || '— (ocupado)' : 'Libre'}
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
        )}

        <p className="mt-3 text-xs text-slate-500">
          Solo se muestran los horarios en las fechas del periodo de prácticas de cada alumno (inicio y término). Usa las flechas para cambiar de semana.
        </p>
      </div>
    </div>
  );
}
