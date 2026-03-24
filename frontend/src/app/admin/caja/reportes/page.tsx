'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders, triggerSessionExpired } from '@/lib/api';
import { formatLocalDate } from '@/lib/date';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface BookReport {
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
  sessions: { date: string; totalIncome: number; totalExpense: number; balance: number; count: number }[];
}

interface CombinedReport {
  startDate: string;
  endDate: string;
  escuela: BookReport;
  dra: BookReport;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(n);
}

function getReportTypeLabel(period: 'day' | 'week' | 'month'): string {
  if (period === 'day') return 'Diario';
  if (period === 'week') return 'Semanal';
  return 'Mensual';
}

/** YYYY-MM-DD en calendario local (evita desfase UTC con toISOString). */
function toYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface CashSessionBrowseRow {
  id: string;
  date: string;
  cash_book: 'escuela' | 'dra';
  status: 'open' | 'closed';
  total_income?: number;
  total_expense?: number;
  transaction_count?: number;
}

export default function CajaReportesPage() {
  const { token } = useAuth();
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [report, setReport] = useState<CombinedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const [browseFrom, setBrowseFrom] = useState(() => {
    const t = new Date();
    t.setDate(t.getDate() - 14);
    return toYmdLocal(t);
  });
  const [browseTo, setBrowseTo] = useState(() => toYmdLocal(new Date()));
  const [browseBook, setBrowseBook] = useState<'all' | 'escuela' | 'dra'>('all');
  const [browseStatus, setBrowseStatus] = useState<'' | 'open' | 'closed'>('');
  const [browseSessions, setBrowseSessions] = useState<CashSessionBrowseRow[]>([]);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseMsg, setBrowseMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [singleDayDate, setSingleDayDate] = useState(() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return toYmdLocal(y);
  });
  const [downloadKey, setDownloadKey] = useState<string | null>(null);
  const [browseHasQueried, setBrowseHasQueried] = useState(false);

  const getRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start: Date;
    if (period === 'day') {
      start = new Date(today);
    } else if (period === 'week') {
      start = new Date(today);
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff);
    } else {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    const end = new Date(today);
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    };
  };

  const loadReport = () => {
    if (!token) return;
    const { from, to } = getRange();
    setLoading(true);
    fetch(`${API_URL}/api/admin/cash/report?from=${from}&to=${to}&combined=true`, { headers: getAuthHeaders(token) })
      .then((r) => (r.status === 401 ? triggerSessionExpired() : r.json()))
      .then((d) => {
        if (d?.error) {
          setReport(null);
          return;
        }
        setReport(d);
      })
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReport();
  }, [token, period]);

  const totalMovements =
    (report?.escuela.transactionCount ?? 0) + (report?.dra.transactionCount ?? 0);

  const downloadCombined = async (format: 'xlsx' | 'pdf') => {
    if (!token) return;
    setExportError(null);
    setExportSuccess(null);
    setExporting(format === 'xlsx' ? 'excel' : 'pdf');
    const { from, to } = getRange();
    const reportType = getReportTypeLabel(period);
    try {
      const res = await fetch(
        `${API_URL}/api/admin/cash/report/export?from=${from}&to=${to}&format=${format}&reportType=${encodeURIComponent(
          reportType
        )}&combined=true`,
        { headers: getAuthHeaders(token) }
      );
      if (res.status === 401) {
        triggerSessionExpired();
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'No se pudo generar el archivo');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'xlsx' ? 'xlsx' : 'pdf';
      const nameBase = from === to ? `reporte_caja_completo_${from}` : `reporte_caja_completo_${from}_a_${to}`;
      a.download = `${nameBase}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      setExportSuccess(format === 'xlsx' ? 'Excel descargado correctamente.' : 'PDF descargado correctamente.');
      setTimeout(() => setExportSuccess(null), 4000);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Error al exportar');
    } finally {
      setExporting(null);
    }
  };

  const loadBrowseSessions = (rangeOverride?: { from: string; to: string }) => {
    if (!token) return;
    const from = rangeOverride?.from ?? browseFrom;
    const to = rangeOverride?.to ?? browseTo;
    if (rangeOverride) {
      setBrowseFrom(rangeOverride.from);
      setBrowseTo(rangeOverride.to);
    }
    setBrowseLoading(true);
    setBrowseMsg(null);
    const params = new URLSearchParams();
    params.set('fromDate', from);
    params.set('toDate', to);
    params.set('limit', '100');
    if (browseBook !== 'all') params.set('cashBook', browseBook);
    if (browseStatus) params.set('status', browseStatus);
    fetch(`${API_URL}/api/admin/cash/sessions?${params}`, { headers: getAuthHeaders(token) })
      .then((r) => {
        if (r.status === 401) {
          triggerSessionExpired();
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        if (d.error) {
          setBrowseSessions([]);
          setBrowseTotal(0);
          setBrowseMsg({ kind: 'err', text: d.error });
          return;
        }
        setBrowseSessions(Array.isArray(d.sessions) ? d.sessions : []);
        setBrowseTotal(typeof d.total === 'number' ? d.total : 0);
      })
      .catch(() => {
        setBrowseSessions([]);
        setBrowseMsg({ kind: 'err', text: 'No se pudo cargar el listado de cajas.' });
      })
      .finally(() => {
        setBrowseLoading(false);
        setBrowseHasQueried(true);
      });
  };

  const applyBrowseQuickRange = (which: 'yesterday' | 'today' | 'week') => {
    const t = new Date();
    if (which === 'today') {
      const ymd = toYmdLocal(t);
      setSingleDayDate(ymd);
      loadBrowseSessions({ from: ymd, to: ymd });
      return;
    }
    if (which === 'yesterday') {
      t.setDate(t.getDate() - 1);
      const ymd = toYmdLocal(t);
      setSingleDayDate(ymd);
      loadBrowseSessions({ from: ymd, to: ymd });
      return;
    }
    const end = new Date(t);
    const start = new Date(t);
    start.setDate(start.getDate() - 6);
    loadBrowseSessions({ from: toYmdLocal(start), to: toYmdLocal(end) });
  };

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportBookDay = async (date: string, book: 'escuela' | 'dra', format: 'xlsx' | 'pdf') => {
    if (!token) return;
    const key = `${format}-book-${book}-${date}`;
    setDownloadKey(key);
    setBrowseMsg(null);
    const ext = format === 'xlsx' ? 'xlsx' : 'pdf';
    const slug = book === 'dra' ? 'dra' : 'escuela';
    try {
      const res = await fetch(
        `${API_URL}/api/admin/cash/report/export?from=${date}&to=${date}&format=${format}&reportType=${encodeURIComponent(
          'Diario'
        )}&cashBook=${book}`,
        { headers: getAuthHeaders(token) }
      );
      if (res.status === 401) {
        triggerSessionExpired();
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'No se pudo generar el archivo');
      }
      const blob = await res.blob();
      triggerBlobDownload(blob, `reporte_caja_${slug}_${date}.${ext}`);
      setBrowseMsg({ kind: 'ok', text: 'Descarga lista (un libro, un día).' });
      setTimeout(() => setBrowseMsg(null), 3500);
    } catch (e) {
      setBrowseMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Error al exportar' });
    } finally {
      setDownloadKey(null);
    }
  };

  const exportCombinedDayForBrowse = async (date: string, format: 'xlsx' | 'pdf') => {
    if (!token) return;
    const key = `${format}-combined-${date}`;
    setDownloadKey(key);
    setBrowseMsg(null);
    const ext = format === 'xlsx' ? 'xlsx' : 'pdf';
    try {
      const res = await fetch(
        `${API_URL}/api/admin/cash/report/export?from=${date}&to=${date}&format=${format}&reportType=${encodeURIComponent(
          'Diario'
        )}&combined=true`,
        { headers: getAuthHeaders(token) }
      );
      if (res.status === 401) {
        triggerSessionExpired();
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'No se pudo generar el archivo');
      }
      const blob = await res.blob();
      triggerBlobDownload(blob, `reporte_caja_completo_${date}.${ext}`);
      setBrowseMsg({ kind: 'ok', text: 'Reporte Escuela + DRA descargado.' });
      setTimeout(() => setBrowseMsg(null), 3500);
    } catch (e) {
      setBrowseMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Error al exportar' });
    } finally {
      setDownloadKey(null);
    }
  };

  const SessionTable = ({
    title,
    bookKey,
    accent,
  }: {
    title: string;
    bookKey: 'escuela' | 'dra';
    accent: 'emerald' | 'violet';
  }) => {
    if (!report) return null;
    const book = report[bookKey];
    const ring = accent === 'emerald' ? 'ring-emerald-500/20' : 'ring-violet-500/20';
    const border = accent === 'emerald' ? 'border-emerald-100' : 'border-violet-100';
    return (
      <div className={`rounded-2xl border ${border} bg-white shadow-sm ring-1 ${ring}`}>
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">Detalle por día en el período</p>
        </div>
        {book.sessions.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">Sin sesiones en este período.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3 text-right">Ingresos</th>
                  <th className="px-5 py-3 text-right">Egresos</th>
                  <th className="px-5 py-3 text-right">Balance</th>
                  <th className="px-5 py-3 text-right">Movs.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {book.sessions.map((s) => (
                  <tr key={s.date} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 text-slate-800">{formatLocalDate(s.date)}</td>
                    <td className="px-5 py-3 text-right font-medium text-emerald-600">+ {formatMoney(s.totalIncome)}</td>
                    <td className="px-5 py-3 text-right font-medium text-rose-600">− {formatMoney(s.totalExpense)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatMoney(s.balance)}</td>
                    <td className="px-5 py-3 text-right text-slate-500">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/90">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Reportes de caja</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              Vista unificada <strong>Escuela + DRA</strong>. Descarga un solo archivo con ambos libros detallados.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/caja"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/caja/movimientos"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
            >
              Movimientos
            </Link>
          </div>
        </header>

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6">
          <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Buscar cajas y descargar reporte</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Elige un rango de fechas, lista las sesiones de caja (Escuela y/o DRA) y descarga el reporte <strong>diario</strong> de un libro
                o el <strong>combinado</strong> de un solo día.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex min-w-[140px] flex-1 flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Un día (Escuela + DRA)</label>
              <input
                type="date"
                value={singleDayDate}
                onChange={(e) => setSingleDayDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={downloadKey !== null}
                onClick={() => exportCombinedDayForBrowse(singleDayDate, 'xlsx')}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {downloadKey === `xlsx-combined-${singleDayDate}` ? 'Generando…' : 'Excel combinado'}
              </button>
              <button
                type="button"
                disabled={downloadKey !== null}
                onClick={() => exportCombinedDayForBrowse(singleDayDate, 'pdf')}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-white disabled:opacity-50"
              >
                {downloadKey === `pdf-combined-${singleDayDate}` ? 'Generando…' : 'PDF combinado'}
              </button>
            </div>
            <p className="w-full text-xs text-slate-500 sm:w-auto sm:flex-1 sm:min-w-[200px]">
              Ej.: ayer o cualquier fecha con movimientos. Si no hay datos, el servidor mostrará un mensaje.
            </p>
          </div>

          <div className="mt-6">
            <p className="text-sm font-semibold text-slate-800">Listado por rango</p>
            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Desde</label>
                <input
                  type="date"
                  value={browseFrom}
                  onChange={(e) => setBrowseFrom(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Hasta</label>
                <input
                  type="date"
                  value={browseTo}
                  onChange={(e) => setBrowseTo(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Libro</label>
                <select
                  value={browseBook}
                  onChange={(e) => setBrowseBook(e.target.value as 'all' | 'escuela' | 'dra')}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm"
                >
                  <option value="all">Todos</option>
                  <option value="escuela">Escuela</option>
                  <option value="dra">DRA</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Estado</label>
                <select
                  value={browseStatus}
                  onChange={(e) => setBrowseStatus(e.target.value as '' | 'open' | 'closed')}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm"
                >
                  <option value="">Todos</option>
                  <option value="open">Abierta</option>
                  <option value="closed">Cerrada</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => loadBrowseSessions()}
                disabled={browseLoading || !token}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
              >
                {browseLoading ? 'Buscando…' : 'Buscar cajas'}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyBrowseQuickRange('yesterday')}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Ayer (buscar y descargar arriba)
              </button>
              <button
                type="button"
                onClick={() => applyBrowseQuickRange('today')}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Hoy (buscar)
              </button>
              <button
                type="button"
                onClick={() => applyBrowseQuickRange('week')}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Últimos 7 días (buscar)
              </button>
            </div>
          </div>

          {browseMsg && (
            <p className={`mt-4 text-sm ${browseMsg.kind === 'err' ? 'text-rose-600' : 'text-emerald-600'}`} role="status">
              {browseMsg.text}
            </p>
          )}

          {browseSessions.length > 0 && (
            <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Libro</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Ingresos</th>
                    <th className="px-4 py-3 text-right">Egresos</th>
                    <th className="px-4 py-3 text-right">Movs.</th>
                    <th className="px-4 py-3 text-right">Reporte (día)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {browseSessions.map((s) => {
                    const ti = Number(s.total_income ?? 0);
                    const te = Number(s.total_expense ?? 0);
                    const cnt = s.transaction_count ?? 0;
                    const bookLabel = s.cash_book === 'dra' ? 'DRA' : 'Escuela';
                    const excelKey = `xlsx-book-${s.cash_book}-${s.date}`;
                    const pdfKey = `pdf-book-${s.cash_book}-${s.date}`;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-medium text-slate-800">{formatLocalDate(s.date)}</td>
                        <td className="px-4 py-3 text-slate-600">{bookLabel}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              s.status === 'open' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {s.status === 'open' ? 'Abierta' : 'Cerrada'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-600">+ {formatMoney(ti)}</td>
                        <td className="px-4 py-3 text-right text-rose-600">− {formatMoney(te)}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{cnt}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={downloadKey !== null}
                              onClick={() => exportBookDay(s.date, s.cash_book, 'xlsx')}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {downloadKey === excelKey ? '…' : 'Excel'}
                            </button>
                            <button
                              type="button"
                              disabled={downloadKey !== null}
                              onClick={() => exportBookDay(s.date, s.cash_book, 'pdf')}
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {downloadKey === pdfKey ? '…' : 'PDF'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!browseHasQueried && (
            <p className="mt-4 text-center text-sm text-slate-400">
              Usa <strong>Buscar cajas</strong> para ver sesiones en el rango, o descarga directa con la fecha de arriba.
            </p>
          )}
          {browseHasQueried && !browseLoading && browseSessions.length === 0 && browseMsg?.kind !== 'err' && (
            <p className="mt-4 text-center text-sm text-slate-500">No hay cajas que coincidan con el filtro en ese rango.</p>
          )}

          {browseTotal > 100 && (
            <p className="mt-3 text-xs text-amber-800">
              Hay {browseTotal} sesiones en el rango; solo se muestran las 100 más recientes. Acota las fechas o filtra por libro.
            </p>
          )}
        </section>

        <div className="mb-8 flex flex-wrap items-center gap-2">
          {(['day', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                period === p ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {p === 'day' ? 'Hoy' : p === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 shadow-sm">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800" />
            <p className="mt-4 text-sm font-medium text-slate-500">Cargando resumen…</p>
          </div>
        ) : !report ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            No se pudo cargar el reporte para el período seleccionado.
          </div>
        ) : (
          <>
            <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:col-span-2 lg:col-span-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Período</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {formatLocalDate(report.startDate)} — {formatLocalDate(report.endDate)}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm ring-1 ring-emerald-500/10">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700/80">Escuela · Ingresos</p>
                <p className="mt-2 text-xl font-bold text-emerald-600">{formatMoney(report.escuela.totalIncome)}</p>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm ring-1 ring-rose-500/10">
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-700/80">Escuela · Egresos</p>
                <p className="mt-2 text-xl font-bold text-rose-600">{formatMoney(report.escuela.totalExpense)}</p>
              </div>
              <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm ring-1 ring-violet-500/10">
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-700/80">DRA · Ingresos</p>
                <p className="mt-2 text-xl font-bold text-violet-600">{formatMoney(report.dra.totalIncome)}</p>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm ring-1 ring-orange-500/10">
                <p className="text-xs font-semibold uppercase tracking-wider text-orange-800/80">DRA · Egresos</p>
                <p className="mt-2 text-xl font-bold text-orange-600">{formatMoney(report.dra.totalExpense)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white shadow-md sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Balance neto Escuela</p>
                <p className="mt-2 text-2xl font-bold">{formatMoney(report.escuela.balance)}</p>
                <p className="mt-4 text-xs text-slate-400">{report.escuela.transactionCount} movimientos</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-800 p-5 text-white shadow-md sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Balance neto DRA</p>
                <p className="mt-2 text-2xl font-bold">{formatMoney(report.dra.balance)}</p>
                <p className="mt-4 text-xs text-slate-400">{report.dra.transactionCount} movimientos</p>
              </div>
            </section>

            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <p className="text-sm font-semibold text-slate-900">Reporte completo (un solo archivo)</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Incluye resumen dual, movimientos integrados y transferencias internas entre libros.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {exportError && (
                  <p className="w-full text-sm text-rose-600 sm:order-first sm:w-auto" role="alert">
                    {exportError}
                  </p>
                )}
                {exportSuccess && (
                  <p className="w-full text-sm text-emerald-600 sm:w-auto" role="status">
                    {exportSuccess}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => downloadCombined('xlsx')}
                  disabled={exporting !== null || totalMovements === 0}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  {exporting === 'excel' ? 'Generando…' : 'Descargar Excel completo'}
                </button>
                <button
                  type="button"
                  onClick={() => downloadCombined('pdf')}
                  disabled={exporting !== null || totalMovements === 0}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  {exporting === 'pdf' ? 'Generando…' : 'Descargar PDF completo'}
                </button>
              </div>
            </div>
            {totalMovements === 0 && (
              <p className="mb-6 text-center text-sm text-slate-500">No hay movimientos en el período; la exportación está deshabilitada.</p>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <SessionTable title="Caja Escuela" bookKey="escuela" accent="emerald" />
              <SessionTable title="Caja DRA" bookKey="dra" accent="violet" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
