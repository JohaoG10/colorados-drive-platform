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
  courses?: { name: string; code: string };
}

interface Notification {
  id: string;
  cohortId: string;
  title: string;
  body: string;
  createdAt: string;
  cohortLabel: string;
}

export default function AdminNotificationsPage() {
  const { token } = useAuth();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ cohortId: '', title: '', body: '' });
  const [filterCohortId, setFilterCohortId] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadCohorts = () => {
    if (!token) return;
    fetch(`${API_URL}/api/admin/cohorts`, { headers: getAuthHeaders(token) })
      .then((r) => r.json().then((d) => ({ status: r.status, data: d })))
      .then(({ status, data }) => {
        if (status === 401) { triggerSessionExpired(); return; }
        setCohorts(Array.isArray(data) ? data : []);
      })
      .catch(() => setCohorts([]));
  };

  const loadNotifications = () => {
    if (!token) return;
    const url = filterCohortId
      ? `${API_URL}/api/admin/notifications?cohortId=${encodeURIComponent(filterCohortId)}`
      : `${API_URL}/api/admin/notifications`;
    fetch(url, { headers: getAuthHeaders(token) })
      .then((r) => r.json().then((d) => ({ status: r.status, data: d })))
      .then(({ status, data }) => {
        if (status === 401) { triggerSessionExpired(); return; }
        setNotifications(Array.isArray(data) ? data : []);
      })
      .catch(() => setNotifications([]));
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/api/admin/cohorts`, { headers: getAuthHeaders(token) }).then((r) => r.json().then((d) => ({ status: r.status, data: d }))),
      fetch(`${API_URL}/api/admin/notifications`, { headers: getAuthHeaders(token) }).then((r) => r.json().then((d) => ({ status: r.status, data: d }))),
    ]).then(([cRes, nRes]) => {
      if (cRes.status === 401 || nRes.status === 401) { triggerSessionExpired(); return; }
      setCohorts(Array.isArray(cRes.data) ? cRes.data : []);
      setNotifications(Array.isArray(nRes.data) ? nRes.data : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    loadNotifications();
  }, [token, filterCohortId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.cohortId.trim() || !form.title.trim() || !form.body.trim()) {
      setMessage('Completa curso, título y mensaje.');
      return;
    }
    setMessage('');
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/notifications`, {
        method: 'POST',
        headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cohortId: form.cohortId,
          title: form.title.trim(),
          body: form.body.trim(),
        }),
      });
      const data = await res.json();
      if (res.status === 401) { triggerSessionExpired(); return; }
      if (!res.ok) throw new Error(data.error || 'Error al enviar');
      setMessage('Aviso enviado correctamente a todos los usuarios del curso.');
      setForm({ cohortId: form.cohortId, title: '', body: '' });
      loadNotifications();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white shadow-xl shadow-emerald-600/20">
        <div className="relative z-10">
          <h2 className="text-xl font-bold mb-1">Avisos y notificaciones</h2>
          <p className="text-emerald-100 text-sm">
            Envía un aviso a todos los usuarios de un curso (número de curso). Ellos lo verán en su apartado de Notificaciones.
          </p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-2 ${message.includes('correctamente') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.includes('correctamente') ? (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          ) : (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          )}
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100 bg-emerald-50/50">
            <h3 className="font-semibold text-neutral-900">Nuevo aviso</h3>
            <p className="text-sm text-neutral-500 mt-0.5">Se enviará a todos los estudiantes del curso seleccionado.</p>
          </div>
          <form onSubmit={handleSend} className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Curso (número de curso)</label>
              <select
                required
                value={form.cohortId}
                onChange={(e) => setForm({ ...form, cohortId: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-shadow"
              >
                <option value="">Seleccionar curso</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.courses?.name || 'Curso'} Nro {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Título del aviso</label>
              <input
                type="text"
                required
                maxLength={300}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ej: Recordatorio de examen"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Mensaje</label>
              <textarea
                required
                rows={5}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Escribe el contenido del aviso..."
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none resize-y min-h-[120px]"
              />
            </div>
            <button
              type="submit"
              disabled={sending || !form.cohortId || !form.title.trim() || !form.body.trim()}
              className="w-full py-3.5 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none transition-colors flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  Enviar aviso al curso
                </>
              )}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold text-neutral-900">Avisos enviados</h3>
            <select
              value={filterCohortId}
              onChange={(e) => setFilterCohortId(e.target.value)}
              className="text-sm px-3 py-2 rounded-lg border border-neutral-200 bg-white"
            >
              <option value="">Todos los cursos</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>{c.courses?.name || 'Curso'} Nro {c.name}</option>
              ))}
            </select>
          </div>
          <div className="max-h-[480px] overflow-auto">
            {loading ? (
              <div className="p-8 text-center text-neutral-500">Cargando...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">
                <p className="font-medium">No hay avisos enviados</p>
                <p className="text-sm mt-1">Los avisos que envíes aparecerán aquí.</p>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {notifications.map((n) => (
                  <li key={n.id} className="hover:bg-neutral-50/50 transition-colors">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === n.id ? null : n.id)}
                      className="w-full px-6 py-4 text-left flex items-start gap-3"
                    >
                      <span className="shrink-0 w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-neutral-900 truncate">{n.title}</p>
                        <p className="text-sm text-neutral-500 mt-0.5">{n.cohortLabel}</p>
                        <p className="text-xs text-neutral-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                      </div>
                      <span className="shrink-0 text-neutral-400">
                        {expandedId === n.id ? '▲' : '▼'}
                      </span>
                    </button>
                    {expandedId === n.id && (
                      <div className="px-6 pb-4 pt-0 pl-[4.5rem]">
                        <div className="rounded-xl bg-neutral-100 p-4 text-sm text-neutral-700 whitespace-pre-wrap">
                          {n.body}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
