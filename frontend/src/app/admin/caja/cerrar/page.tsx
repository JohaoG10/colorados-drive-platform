'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders, triggerSessionExpired } from '@/lib/api';
import { formatLocalDate } from '@/lib/date';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(n);
}

export default function CajaCerrarPage() {
  const { token } = useAuth();
  const [data, setData] = useState<{
    session: { id: string; date: string; opening_amount: number; opened_by_name?: string | null };
    totalIncome: number;
    totalExpense: number;
    balance: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/admin/cash/summary`, { headers: getAuthHeaders(token) })
      .then((r) => (r.status === 401 ? triggerSessionExpired() : r.json()))
      .then(async (summary) => {
        if (!summary?.sessionId || summary.status !== 'open') {
          setData(null);
          setLoading(false);
          return;
        }
        const res = await fetch(`${API_URL}/api/admin/cash/sessions/${summary.sessionId}/close-preview`, { headers: getAuthHeaders(token) });
        const closeData = await res.json();
        if (res.ok && closeData) setData(closeData);
        else setData(null);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [token]);

  const handleClose = async () => {
    if (!data?.session?.id || !token) return;
    setSubmitting(true);
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/api/admin/cash/close`, {
        method: 'POST',
        headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: data.session.id }),
      });
      const result = await res.json();
      if (res.status === 401) triggerSessionExpired();
      if (!res.ok) {
        setMessage(result?.error || 'Error al cerrar caja');
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setMessage('Error de conexión');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-500">
        Cargando...
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-emerald-800 font-semibold">Caja cerrada correctamente</p>
          <p className="text-sm text-emerald-700 mt-2">El día ha sido cerrado. No se pueden modificar movimientos de esta sesión.</p>
        </div>
        <div className="flex gap-2 justify-center">
          <Link href="/admin/caja" className="px-4 py-2 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700">Ir al dashboard</Link>
          <Link href="/admin/caja/reportes" className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50">Ver reportes</Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <p className="text-neutral-600">No hay caja abierta para cerrar.</p>
        <Link href="/admin/caja" className="inline-block px-4 py-2 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700">
          Volver al dashboard
        </Link>
      </div>
    );
  }

  const { session, totalIncome, totalExpense, balance } = data;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900">Cerrar caja</h2>
        <Link href="/admin/caja" className="text-sm text-neutral-500 hover:text-neutral-700">Cancelar</Link>
      </div>

      <p className="text-sm text-neutral-600">
        Fecha: <strong>{formatLocalDate(session.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
        {session.opened_by_name && (
          <> · Abierta por: <strong>{session.opened_by_name}</strong></>
        )}
      </p>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 space-y-4">
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">Total ingresos</span>
          <span className="font-medium text-emerald-600">+ {formatMoney(totalIncome)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">Total egresos</span>
          <span className="font-medium text-red-600">− {formatMoney(totalExpense)}</span>
        </div>
        <div className="border-t border-neutral-200 pt-4 flex justify-between">
          <span className="font-medium text-neutral-700">Balance final</span>
          <span className="text-xl font-bold text-neutral-900">{formatMoney(balance)}</span>
        </div>
      </div>

      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
        Al cerrar la caja no se podrán modificar ni eliminar los movimientos de este día.
      </p>

      {message && <p className="text-sm text-red-600">{message}</p>}

      <div className="flex gap-2">
        <Link href="/admin/caja" className="flex-1 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 text-center">
          Cancelar
        </Link>
        <button
          type="button"
          onClick={handleClose}
          disabled={submitting}
          className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
        >
          {submitting ? 'Cerrando...' : 'Cerrar caja'}
        </button>
      </div>
    </div>
  );
}
