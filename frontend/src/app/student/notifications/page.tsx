'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders, triggerSessionExpired } from '@/lib/api';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  isRead: boolean;
}

export default function StudentNotificationsPage() {
  const { token } = useAuth();
  const [list, setList] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = () => {
    if (!token) return;
    Promise.all([
      fetch(`${API_URL}/api/student/notifications`, { headers: getAuthHeaders(token) }).then((r) => r.json().then((d) => ({ status: r.status, data: d }))),
      fetch(`${API_URL}/api/student/notifications/unread-count`, { headers: getAuthHeaders(token) }).then((r) => r.json().then((d) => ({ status: r.status, data: d }))),
    ]).then(([listRes, countRes]) => {
      if (listRes.status === 401 || countRes.status === 401) { triggerSessionExpired(); return; }
      setList(Array.isArray(listRes.data) ? listRes.data : []);
      setUnreadCount(typeof countRes.data?.count === 'number' ? countRes.data.count : 0);
    }).catch(() => {
      setList([]);
      setUnreadCount(0);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const markAsRead = async (id: string) => {
    if (!token) return;
    setMarkingId(id);
    try {
      const res = await fetch(`${API_URL}/api/student/notifications/${id}/read`, {
        method: 'POST',
        headers: getAuthHeaders(token),
      });
      if (res.status === 401) { triggerSessionExpired(); return; }
      if (res.ok) {
        setList((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)));
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } finally {
      setMarkingId(null);
    }
  };

  const handleExpand = (id: string) => {
    setExpandedId((current) => (current === id ? null : id));
    const item = list.find((n) => n.id === id);
    if (item && !item.isRead) markAsRead(id);
  };

  const unread = list.filter((n) => !n.isRead);
  const read = list.filter((n) => n.isRead);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white shadow-xl shadow-emerald-600/20">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold mb-1">Avisos</h2>
            <p className="text-emerald-100 text-sm">
              Aquí aparecen los avisos que te envía el administrador de tu curso.
            </p>
          </div>
          {unreadCount > 0 && (
            <span className="inline-flex items-center px-4 py-2 rounded-xl bg-white/20 text-white font-semibold">
              {unreadCount} sin leer
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-neutral-500">Cargando avisos...</p>
          </div>
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <p className="text-neutral-600 font-medium">No tienes avisos</p>
          <p className="text-sm text-neutral-500 mt-1">Cuando te envíen un aviso, aparecerá aquí.</p>
          <Link href="/student" className="mt-6 inline-block text-emerald-600 hover:text-emerald-700 font-medium">
            Volver a Mi curso
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {unread.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Sin leer ({unread.length})
              </h3>
              <ul className="space-y-3">
                {unread.map((n) => (
                  <li
                    key={n.id}
                    className="bg-white rounded-xl border-2 border-emerald-200 shadow-sm overflow-hidden hover:border-emerald-300 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => handleExpand(n.id)}
                      className="w-full px-6 py-4 text-left flex items-start gap-3"
                    >
                      <span className="shrink-0 w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-neutral-900">{n.title}</p>
                        <p className="text-sm text-neutral-500 mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
                      </div>
                      {markingId === n.id ? (
                        <span className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0" />
                      ) : (
                        <span className="shrink-0 text-emerald-600 font-medium text-sm">{expandedId === n.id ? 'Ocultar' : 'Ver'}</span>
                      )}
                    </button>
                    {expandedId === n.id && (
                      <div className="px-6 pb-4 pt-0 pl-[4.5rem]">
                        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-neutral-700 whitespace-pre-wrap text-sm">
                          {n.body}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {read.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-neutral-500 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-neutral-300" />
                Leídos ({read.length})
              </h3>
              <ul className="space-y-3">
                {read.map((n) => (
                  <li
                    key={n.id}
                    className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden hover:border-neutral-300 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === n.id ? null : n.id)}
                      className="w-full px-6 py-4 text-left flex items-start gap-3"
                    >
                      <span className="shrink-0 w-10 h-10 rounded-xl bg-neutral-100 text-neutral-500 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-neutral-700">{n.title}</p>
                        <p className="text-sm text-neutral-400 mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
                      </div>
                      <span className="shrink-0 text-neutral-400">{expandedId === n.id ? '▲' : '▼'}</span>
                    </button>
                    {expandedId === n.id && (
                      <div className="px-6 pb-4 pt-0 pl-[4.5rem]">
                        <div className="rounded-xl bg-neutral-50 p-4 text-neutral-600 whitespace-pre-wrap text-sm">
                          {n.body}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
