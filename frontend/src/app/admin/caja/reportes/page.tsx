'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders, triggerSessionExpired } from '@/lib/api';
import { formatLocalDate } from '@/lib/date';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ReportData {
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
  sessions: { date: string; totalIncome: number; totalExpense: number; balance: number; count: number }[];
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(n);
}

function getReportTypeLabel(period: 'day' | 'week' | 'month'): string {
  if (period === 'day') return 'Diario';
  if (period === 'week') return 'Semanal';
  return 'Mensual';
}

export default function CajaReportesPage() {
  const { token } = useAuth();
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

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
    fetch(`${API_URL}/api/admin/cash/report?from=${from}&to=${to}`, { headers: getAuthHeaders(token) })
      .then((r) => (r.status === 401 ? triggerSessionExpired() : r.json()))
      .then((d) => setReport(d))
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReport();
  }, [token, period]);

  const handleExportExcel = async () => {
    if (!report || !token) return;
    setExportError(null);
    setExportSuccess(null);
    setExporting('excel');
    const { from, to } = getRange();
    const reportType = getReportTypeLabel(period);
    try {
      const res = await fetch(
        `${API_URL}/api/admin/cash/report/export?from=${from}&to=${to}&format=xlsx&reportType=${encodeURIComponent(reportType)}`,
        { headers: getAuthHeaders(token) }
      );
      if (res.status === 401) {
        triggerSessionExpired();
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'No se pudo exportar el reporte');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = from === to ? `reporte_caja_${from}.xlsx` : `reporte_caja_${from}_a_${to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setExportSuccess('Excel descargado correctamente.');
      setTimeout(() => setExportSuccess(null), 4000);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Error al exportar Excel');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    if (!report || !token) return;
    setExportError(null);
    setExportSuccess(null);
    setExporting('pdf');
    const { from, to } = getRange();
    const reportType = getReportTypeLabel(period);
    try {
      const res = await fetch(
        `${API_URL}/api/admin/cash/report/export?from=${from}&to=${to}&format=pdf&reportType=${encodeURIComponent(reportType)}`,
        { headers: getAuthHeaders(token) }
      );
      if (res.status === 401) {
        triggerSessionExpired();
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'No se pudo generar el PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = from === to ? `reporte_caja_${from}.pdf` : `reporte_caja_${from}_a_${to}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setExportSuccess('PDF descargado correctamente.');
      setTimeout(() => setExportSuccess(null), 4000);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Error al generar PDF');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-semibold text-neutral-900">Reportes de caja</h2>
        <div className="flex gap-2">
          <Link href="/admin/caja" className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50">Dashboard</Link>
          <Link href="/admin/caja/movimientos" className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50">Movimientos</Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPeriod('day')}
          className={`px-4 py-2 rounded-xl font-medium transition-colors ${period === 'day' ? 'bg-red-600 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}
        >
          Día
        </button>
        <button
          type="button"
          onClick={() => setPeriod('week')}
          className={`px-4 py-2 rounded-xl font-medium transition-colors ${period === 'week' ? 'bg-red-600 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}
        >
          Semana
        </button>
        <button
          type="button"
          onClick={() => setPeriod('month')}
          className={`px-4 py-2 rounded-xl font-medium transition-colors ${period === 'month' ? 'bg-red-600 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}
        >
          Mes
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-500">Cargando...</div>
      ) : !report ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-500">No hay datos para el período seleccionado.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-neutral-500">Total ingresos</p>
              <p className="mt-1 text-xl font-bold text-emerald-600">{formatMoney(report.totalIncome)}</p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-neutral-500">Total egresos</p>
              <p className="mt-1 text-xl font-bold text-red-600">{formatMoney(report.totalExpense)}</p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-neutral-500">Balance</p>
              <p className="mt-1 text-xl font-bold text-neutral-900">{formatMoney(report.balance)}</p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-neutral-500">Transacciones</p>
              <p className="mt-1 text-xl font-bold text-neutral-900">{report.transactionCount}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
              <span className="font-medium text-neutral-900">Detalle por día</span>
              <span className="text-sm text-neutral-500">{formatLocalDate(report.startDate)} – {formatLocalDate(report.endDate)}</span>
            </div>
            {report.sessions.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">No hay sesiones en este período.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-neutral-700">Fecha</th>
                      <th className="text-right py-3 px-4 font-medium text-neutral-700">Ingresos</th>
                      <th className="text-right py-3 px-4 font-medium text-neutral-700">Egresos</th>
                      <th className="text-right py-3 px-4 font-medium text-neutral-700">Balance</th>
                      <th className="text-right py-3 px-4 font-medium text-neutral-700">Movimientos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.sessions.map((s) => (
                      <tr key={s.date} className="border-b border-neutral-100">
                        <td className="py-3 px-4 text-neutral-900">{formatLocalDate(s.date)}</td>
                        <td className="py-3 px-4 text-right text-emerald-600">+ {formatMoney(s.totalIncome)}</td>
                        <td className="py-3 px-4 text-right text-red-600">− {formatMoney(s.totalExpense)}</td>
                        <td className="py-3 px-4 text-right font-medium">{formatMoney(s.balance)}</td>
                        <td className="py-3 px-4 text-right text-neutral-600">{s.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {exportError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg" role="alert">
                {exportError}
              </p>
            )}
            {exportSuccess && (
              <p className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg" role="status">
                {exportSuccess}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={exporting !== null || report.transactionCount === 0}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting === 'excel' ? 'Exportando...' : 'Exportar Excel'}
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exporting !== null || report.transactionCount === 0}
                className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting === 'pdf' ? 'Generando PDF...' : 'Exportar PDF'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
