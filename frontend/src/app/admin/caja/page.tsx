'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders, triggerSessionExpired } from '@/lib/api';
import { formatLocalDate } from '@/lib/date';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface CashSummary {
  sessionId: string;
  date: string;
  openingAmount: number;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  status: string;
  transactionCount: number;
}

interface MonthlyStat {
  year: number;
  month: number;
  monthLabel: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  sessionCount: number;
  transactionCount: number;
}

interface CashAlert {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  date?: string;
  sessionId?: string;
}

interface FinancialDashboard {
  summary: CashSummary | null;
  last7Days: { date: string; totalIncome: number; totalExpense: number; balance: number; count: number }[];
  monthlyStats: MonthlyStat[];
  alerts: CashAlert[];
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function formatShortDate(s: string) {
  return formatLocalDate(s, { day: '2-digit', month: 'short' });
}

const chartColors = {
  income: '#059669',
  incomeLight: 'rgba(5, 150, 105, 0.12)',
  expense: '#e11d48',
  expenseLight: 'rgba(225, 29, 72, 0.12)',
  grid: '#f1f5f9',
  text: '#64748b',
  textStrong: '#0f172a',
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white/95 px-4 py-3 shadow-lg shadow-slate-200/50 backdrop-blur-sm">
      <p className="text-xs font-medium text-slate-500 mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((p) => (
          <p key={p.name} className="text-sm font-semibold" style={{ color: p.name === 'Ingresos' ? chartColors.income : chartColors.expense }}>
            {p.name}: {formatMoney(p.value)}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function CajaDashboardPage() {
  const { token } = useAuth();
  const [dashboard, setDashboard] = useState<FinancialDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [openAmount, setOpenAmount] = useState('');
  const [openDate, setOpenDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const load = () => {
    if (!token) return;
    fetch(`${API_URL}/api/admin/cash/dashboard`, { headers: getAuthHeaders(token) })
      .then((r) => {
        if (r.status === 401) triggerSessionExpired();
        return r.json();
      })
      .then((data) => setDashboard(data || null))
      .catch(() => setDashboard(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const handleOpenCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    const amount = parseFloat(openAmount.replace(',', '.'));
    if (isNaN(amount) || amount < 0) {
      setMessage('Monto inicial debe ser un número mayor o igual a 0.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/cash/open`, {
        method: 'POST',
        headers: { ...getAuthHeaders(token!), 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: openDate, openingAmount: amount }),
      });
      const data = await res.json();
      if (res.status === 401) triggerSessionExpired();
      if (!res.ok) {
        setMessage(data?.error || 'Error al abrir caja');
        setSubmitting(false);
        return;
      }
      setOpenModal(false);
      setOpenAmount('');
      setOpenDate(new Date().toISOString().slice(0, 10));
      load();
    } catch {
      setMessage('Error de conexión');
    }
    setSubmitting(false);
  };

  const summary = dashboard?.summary ?? null;
  const alerts = dashboard?.alerts ?? [];
  const last7Days = dashboard?.last7Days ?? [];
  const monthlyStats = dashboard?.monthlyStats ?? [];

  const chart7Data = [...last7Days].reverse().map((d) => ({
    fecha: formatShortDate(d.date),
    Ingresos: d.totalIncome,
    Egresos: d.totalExpense,
    Balance: d.balance,
  }));

  const chartMonthData = monthlyStats.filter((m) => m.totalIncome > 0 || m.totalExpense > 0).map((m) => ({
    mes: m.monthLabel,
    Ingresos: m.totalIncome,
    Egresos: m.totalExpense,
    Balance: m.balance,
  }));

  const currentMonth = monthlyStats.find(
    (m) => m.year === new Date().getFullYear() && m.month === new Date().getMonth() + 1
  );

  return (
    <div className="min-h-screen bg-slate-50/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        {/* ─── Header ───────────────────────────────────────────────────────── */}
        <header className="mb-8 lg:mb-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Caja
              </h1>
              <p className="mt-1 max-w-xl text-sm text-slate-500 sm:text-base">
                Control de flujo de efectivo, ingresos y egresos del día. Abre la caja, registra movimientos y cierra al finalizar.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {!loading && !summary && (
                <button
                  type="button"
                  onClick={() => setOpenModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Abrir caja del día
                </button>
              )}
              {!loading && summary?.status === 'open' && (
                <>
                  <Link
                    href="/admin/caja/movimientos"
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Registrar movimiento
                  </Link>
                  <Link
                    href="/admin/caja/cerrar"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Cerrar caja
                  </Link>
                </>
              )}
              <Link
                href="/admin/caja/movimientos"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Historial
              </Link>
              <Link
                href="/admin/caja/reportes"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.5a2 2 0 012 2v5.5a2 2 0 01-2 2z" />
                </svg>
                Reportes
              </Link>
            </div>
          </div>
        </header>

        {/* ─── Alertas ─────────────────────────────────────────────────────── */}
        {!loading && alerts.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Alertas</h2>
            <div className="flex flex-col gap-3">
              {alerts.map((alert, i) => (
                <div
                  key={`${alert.type}-${alert.date ?? i}`}
                  className={`flex items-start gap-4 rounded-2xl border px-5 py-4 shadow-sm ${
                    alert.severity === 'error'
                      ? 'border-rose-200/80 bg-rose-50/80 text-rose-900'
                      : alert.severity === 'warning'
                      ? 'border-amber-200/80 bg-amber-50/80 text-amber-900'
                      : 'border-sky-200/80 bg-sky-50/80 text-sky-900'
                  }`}
                >
                  <span className="shrink-0 mt-0.5 text-lg" aria-hidden>
                    {alert.severity === 'error' ? (
                      <svg className="h-5 w-5 text-rose-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                    ) : alert.severity === 'warning' ? (
                      <svg className="h-5 w-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    ) : (
                      <svg className="h-5 w-5 text-sky-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                    )}
                  </span>
                  <p className="flex-1 text-sm font-medium leading-relaxed">{alert.message}</p>
                  {alert.date && (
                    <span className="shrink-0 text-xs font-medium opacity-80">{formatShortDate(alert.date)}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── Loading ─────────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white px-8 py-16 shadow-sm">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
            <p className="mt-4 text-sm font-medium text-slate-500">Cargando dashboard...</p>
          </div>
        )}

        {/* ─── Estado vacío: sin caja abierta ───────────────────────────────── */}
        {!loading && !summary && (
          <section className="mb-10">
            <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 px-8 py-14 shadow-lg shadow-slate-200/40 sm:px-12 sm:py-16">
              <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-100/50 blur-3xl" />
              <div className="absolute bottom-0 left-0 h-48 w-48 -translate-x-1/2 translate-y-1/2 rounded-full bg-slate-100/60 blur-2xl" />
              <div className="relative flex flex-col items-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm">
                  <svg className="h-10 w-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2h-2m-4-1V7a2 2 0 012-2h2a2 2 0 012 2v1m-4 0h10M8 13h8" />
                  </svg>
                </div>
                <h2 className="mt-6 text-xl font-bold text-slate-900 sm:text-2xl">
                  No hay caja abierta para hoy
                </h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                  Abre la caja para comenzar a registrar ingresos y egresos del día. Podrás ver el balance en tiempo real y cerrar la caja al finalizar.
                </p>
                <button
                  type="button"
                  onClick={() => setOpenModal(true)}
                  className="mt-8 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 hover:shadow-emerald-600/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Abrir caja del día
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ─── Resumen del día + KPIs ──────────────────────────────────────── */}
        {!loading && summary && (
          <section className="mb-10">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  summary.status === 'open'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200/80 text-slate-700'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${summary.status === 'open' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {summary.status === 'open' ? 'Abierta' : 'Cerrada'}
              </span>
              <span className="text-sm text-slate-500">
                {formatLocalDate(summary.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="group rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-slate-300/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Monto inicial</span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition group-hover:bg-slate-200/80">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </span>
                </div>
                <p className="mt-4 text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">{formatMoney(summary.openingAmount)}</p>
              </div>
              <div className="group rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-emerald-200/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Ingresos</span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 transition group-hover:bg-emerald-200/80">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                  </span>
                </div>
                <p className="mt-4 text-2xl font-bold tracking-tight text-emerald-600 lg:text-3xl">+ {formatMoney(summary.totalIncome)}</p>
              </div>
              <div className="group rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-rose-200/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Egresos</span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600 transition group-hover:bg-rose-200/80">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" /></svg>
                  </span>
                </div>
                <p className="mt-4 text-2xl font-bold tracking-tight text-rose-600 lg:text-3xl">− {formatMoney(summary.totalExpense)}</p>
              </div>
              <div className="group rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-slate-300/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Balance actual</span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-slate-200/80">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  </span>
                </div>
                <p className="mt-4 text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">{formatMoney(summary.balance)}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center rounded-2xl border border-slate-200/90 bg-white px-6 py-4 shadow-sm">
              <span className="text-sm text-slate-500">Transacciones del día</span>
              <span className="ml-2 text-lg font-bold text-slate-900">{summary.transactionCount}</span>
            </div>
          </section>
        )}

        {/* ─── Este mes ───────────────────────────────────────────────────── */}
        {!loading && currentMonth && (
          <section className="mb-10">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm lg:p-8">
              <div className="mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                <h2 className="text-lg font-semibold text-slate-900">Este mes</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{currentMonth.monthLabel}</span>
              </div>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Ingresos</p>
                  <p className="mt-1 text-xl font-bold text-emerald-600">{formatMoney(currentMonth.totalIncome)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Egresos</p>
                  <p className="mt-1 text-xl font-bold text-rose-600">{formatMoney(currentMonth.totalExpense)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Balance</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{formatMoney(currentMonth.balance)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Transacciones</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{currentMonth.transactionCount}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ─── Gráfico 7 días ───────────────────────────────────────────────── */}
        {!loading && chart7Data.length > 0 && (
          <section className="mb-10">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm lg:p-8">
              <h2 className="mb-6 text-lg font-semibold text-slate-900">Ingresos vs Egresos · Últimos 7 días</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart7Data} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                    <defs>
                      <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartColors.income} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={chartColors.income} stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartColors.expense} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={chartColors.expense} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                    <XAxis dataKey="fecha" tick={{ fontSize: 12, fill: chartColors.text }} axisLine={{ stroke: chartColors.grid }} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: chartColors.text }} axisLine={false} tickLine={false} tickFormatter={(v) => v} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: 16 }} iconType="circle" iconSize={8} formatter={(value) => <span className="text-sm font-medium text-slate-600">{value}</span>} />
                    <Area type="monotone" dataKey="Ingresos" stroke={chartColors.income} strokeWidth={2} fill="url(#gradIncome)" name="Ingresos" />
                    <Area type="monotone" dataKey="Egresos" stroke={chartColors.expense} strokeWidth={2} fill="url(#gradExpense)" name="Egresos" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        )}

        {/* ─── Gráfico mensual ─────────────────────────────────────────────── */}
        {!loading && chartMonthData.length > 0 && (
          <section>
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm lg:p-8">
              <h2 className="mb-6 text-lg font-semibold text-slate-900">Estadísticas mensuales · Últimos 12 meses</h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartMonthData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }} barCategoryGap="28%">
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: chartColors.text }} axisLine={{ stroke: chartColors.grid }} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: chartColors.text }} axisLine={false} tickLine={false} tickFormatter={(v) => v} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: 16 }} iconType="circle" iconSize={8} formatter={(value) => <span className="text-sm font-medium text-slate-600">{value}</span>} />
                    <Bar dataKey="Ingresos" fill={chartColors.income} radius={[6, 6, 0, 0]} name="Ingresos" maxBarSize={48} />
                    <Bar dataKey="Egresos" fill={chartColors.expense} radius={[6, 6, 0, 0]} name="Egresos" maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        )}

        {/* ─── Modal Abrir caja ────────────────────────────────────────────── */}
        {openModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl shadow-slate-300/30 lg:p-8">
              <h3 className="text-xl font-semibold text-slate-900">Abrir caja</h3>
              <p className="mt-1 text-sm text-slate-500">Indica la fecha y el monto inicial para comenzar el día.</p>
              <form onSubmit={handleOpenCaja} className="mt-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Fecha</label>
                  <input
                    type="date"
                    value={openDate}
                    onChange={(e) => setOpenDate(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Monto inicial</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={openAmount}
                    onChange={(e) => setOpenAmount(e.target.value)}
                    placeholder="0.00"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                    required
                  />
                </div>
                {message && <p className="text-sm font-medium text-rose-600">{message}</p>}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setOpenModal(false); setMessage(''); }}
                    className="flex-1 rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                  >
                    {submitting ? 'Abriendo...' : 'Abrir caja'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
