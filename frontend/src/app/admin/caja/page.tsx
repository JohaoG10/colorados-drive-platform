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
  cashBook?: string;
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
  view?: string;
  summary: CashSummary | null;
  summaryDra?: CashSummary | null;
  last7Days: { date: string; totalIncome: number; totalExpense: number; balance: number; count: number }[];
  last7DaysDra?: { date: string; totalIncome: number; totalExpense: number; balance: number; count: number }[];
  monthlyStats: MonthlyStat[];
  monthlyStatsDra?: MonthlyStat[];
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
  const [openCashBook, setOpenCashBook] = useState<'escuela' | 'dra'>('escuela');
  /** Libro usado solo para gráficos y bloque "Este mes". */
  const [chartBook, setChartBook] = useState<'escuela' | 'dra'>('escuela');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const load = () => {
    if (!token) return;
    setLoading(true);
    fetch(`${API_URL}/api/admin/cash/dashboard?view=all`, { headers: getAuthHeaders(token) })
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
        body: JSON.stringify({ date: openDate, openingAmount: amount, cashBook: openCashBook }),
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

  const summaryEscuela = dashboard?.summary ?? null;
  const summaryDra = dashboard?.summaryDra ?? null;
  const alerts = dashboard?.alerts ?? [];
  const last7Days = chartBook === 'dra' ? dashboard?.last7DaysDra ?? [] : dashboard?.last7Days ?? [];
  const monthlyStats =
    chartBook === 'dra' ? dashboard?.monthlyStatsDra ?? [] : dashboard?.monthlyStats ?? [];

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
              <p className="mt-1 max-w-2xl text-sm text-slate-500 sm:text-base leading-relaxed">
                Dos libros independientes: <strong className="text-slate-700">Escuela</strong> (efectivo, transferencia y tarjeta) y{' '}
                <strong className="text-slate-700">DRA</strong> (efectivo y transferencia). Cada uno con su propia sesión del día.
              </p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wider text-slate-400">
                Gráficos y tendencias
              </p>
              <div className="mt-2 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                {(['escuela', 'dra'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setChartBook(v)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      chartBook === v ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {v === 'escuela' ? 'Escuela' : 'DRA'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Link
                href="/admin/caja/movimientos"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Movimientos
              </Link>
              <Link
                href="/admin/caja/reportes"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
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
                  key={`${alert.type}-${alert.sessionId ?? `a${i}`}-${alert.date ?? '—'}`}
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

        {/* ─── Resumen del día: Escuela + DRA ─────────────────────────────── */}
        {!loading && (
          <section className="mb-10 grid gap-6 lg:grid-cols-2">
            {(
              [
                {
                  key: 'escuela' as const,
                  label: 'Caja Escuela',
                  sub: 'Efectivo, transferencia y tarjeta',
                  summary: summaryEscuela,
                  ring: 'ring-emerald-500/10',
                  border: 'border-emerald-100',
                },
                {
                  key: 'dra' as const,
                  label: 'Caja DRA',
                  sub: 'Efectivo y transferencia entre cuentas',
                  summary: summaryDra,
                  ring: 'ring-violet-500/10',
                  border: 'border-violet-100',
                },
              ] as const
            ).map(({ key, label, sub, summary, ring, border }) => (
              <div
                key={key}
                className={`flex flex-col rounded-3xl border ${border} bg-white p-6 shadow-sm ring-1 ${ring} sm:p-7`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-slate-900">{label}</h2>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">{sub}</p>
                  </div>
                  {summary ? (
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                        summary.status === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {summary.status === 'open' ? 'Abierta' : 'Cerrada'}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                      Sin sesión hoy
                    </span>
                  )}
                </div>

                {summary ? (
                  <>
                    <p className="mt-3 text-sm capitalize text-slate-500">
                      {formatLocalDate(summary.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Inicial</p>
                        <p className="mt-1 text-base font-bold tabular-nums text-slate-900">{formatMoney(summary.openingAmount)}</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-100/80 bg-emerald-50/40 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700/90">Ingresos</p>
                        <p className="mt-1 text-base font-bold tabular-nums text-emerald-600">+{formatMoney(summary.totalIncome)}</p>
                      </div>
                      <div className="rounded-2xl border border-rose-100/80 bg-rose-50/40 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700/90">Egresos</p>
                        <p className="mt-1 text-base font-bold tabular-nums text-rose-600">−{formatMoney(summary.totalExpense)}</p>
                      </div>
                      <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-3 sm:col-span-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Balance</p>
                        <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{formatMoney(summary.balance)}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-xs text-slate-500">{summary.transactionCount} movimientos en esta sesión</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link
                        href={`/admin/caja/movimientos?cashBook=${key}`}
                        className="inline-flex flex-1 min-w-[7.5rem] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Ver movimientos
                      </Link>
                      {summary.status === 'open' ? (
                        <>
                          <Link
                            href={`/admin/caja/movimientos?cashBook=${key}`}
                            className="inline-flex flex-1 min-w-[7.5rem] items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                          >
                            Registrar
                          </Link>
                          <Link
                            href={`/admin/caja/cerrar?cashBook=${key}`}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Cerrar caja
                          </Link>
                        </>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="mt-8 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-10 text-center">
                    <p className="max-w-xs text-sm text-slate-500">
                      Abre la sesión del día para registrar ingresos, egresos y transferencias entre cuentas en este libro.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenCashBook(key);
                        setOpenModal(true);
                      }}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                    >
                      Abrir {key === 'escuela' ? 'caja Escuela' : 'caja DRA'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* ─── Este mes ───────────────────────────────────────────────────── */}
        {!loading && currentMonth && (
          <section className="mb-10">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm lg:p-8">
              <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
                <h2 className="text-lg font-semibold text-slate-900">Este mes</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{currentMonth.monthLabel}</span>
                <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-medium text-white">
                  {chartBook === 'dra' ? 'DRA' : 'Escuela'}
                </span>
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
              <h2 className="mb-1 text-lg font-semibold text-slate-900">Ingresos vs egresos · 7 días</h2>
              <p className="mb-6 text-xs font-medium text-slate-500">
                Libro: {chartBook === 'dra' ? 'DRA' : 'Escuela'}
              </p>
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
              <h2 className="mb-1 text-lg font-semibold text-slate-900">Tendencia mensual · 12 meses</h2>
              <p className="mb-6 text-xs font-medium text-slate-500">
                Libro: {chartBook === 'dra' ? 'DRA' : 'Escuela'}
              </p>
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
                  <label className="block text-sm font-medium text-slate-700">Libro de caja</label>
                  <select
                    value={openCashBook}
                    onChange={(e) => setOpenCashBook(e.target.value as 'escuela' | 'dra')}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900"
                  >
                    <option value="escuela">Escuela</option>
                    <option value="dra">DRA</option>
                  </select>
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
