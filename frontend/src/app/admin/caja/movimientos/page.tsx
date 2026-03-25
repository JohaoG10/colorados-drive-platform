'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders, triggerSessionExpired } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const INCOME_TYPE_LABELS: Record<string, string> = {
  pago_matricula: 'Pago de matrícula',
  pago_curso: 'Pago de curso',
  pago_examen: 'Pago de examen',
  pago_clases_adicionales: 'Pago de clases adicionales',
  otros: 'Otros',
};
const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  sueldos: 'Sueldos',
  combustible: 'Combustible',
  materiales: 'Materiales',
  publicidad: 'Publicidad',
  mantenimiento: 'Mantenimiento',
  otros: 'Otros',
};
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
};

type CashBook = 'escuela' | 'dra';

type TransferBankId = 'pichincha' | 'guayaquil' | 'pacifico';

const TRANSFER_BANK_OPTIONS: { id: TransferBankId; label: string }[] = [
  { id: 'pichincha', label: 'Banco Pichincha' },
  { id: 'guayaquil', label: 'Banco Guayaquil' },
  { id: 'pacifico', label: 'Banco del Pacífico' },
];

/** Efectivo / tarjeta: destino en BD. Transferencias usan `transferBank` en el body. */
function pickFundsDestination(
  pm: 'efectivo' | 'transferencia' | 'tarjeta',
  book: CashBook
): string | null {
  if (pm === 'tarjeta') return null;
  if (pm === 'efectivo') return book === 'dra' ? 'efectivo_dra' : 'efectivo_escuela';
  return null;
}

function fundsDestinationForPayment(
  pm: 'efectivo' | 'transferencia' | 'tarjeta',
  book: CashBook,
  bank: TransferBankId
): string | null {
  if (pm === 'tarjeta') return null;
  if (pm === 'efectivo') return book === 'dra' ? 'efectivo_dra' : 'efectivo_escuela';
  if (book === 'dra') {
    if (bank === 'pichincha') return 'trans_pichincha_dra';
    if (bank === 'guayaquil') return 'trans_gye_dra';
    return 'trans_pacifico_dra';
  }
  if (bank === 'pichincha') return 'trans_pichincha_escuela';
  if (bank === 'guayaquil') return 'trans_gye_escuela';
  return 'trans_pacifico_escuela';
}

function transferBankFromFundsDestination(fd: string | null | undefined): TransferBankId {
  if (!fd) return 'pichincha';
  if (fd.includes('pichincha')) return 'pichincha';
  if (fd.includes('gye')) return 'guayaquil';
  if (fd.includes('pacifico')) return 'pacifico';
  return 'pichincha';
}

interface CashSummary {
  sessionId: string;
  date: string;
  balance: number;
  status: string;
}

interface Transaction {
  id: string;
  cash_session_id: string;
  type: 'income' | 'expense' | 'internal_transfer';
  concept: string;
  category: string | null;
  income_type: string | null;
  payment_method: string;
  amount: number;
  funds_destination?: string | null;
  internal_from_book?: string | null;
  internal_to_book?: string | null;
  internal_channel?: string | null;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
  session_date?: string;
  session_status?: string;
  anulado_at?: string | null;
  anulado_por?: string | null;
  anulado_reason?: string | null;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(n);
}

/** Etiqueta corta para cuenta/banco guardada en BD (coherente con reportes). */
function shortFundsDestinationLabel(fd: string | null | undefined): string {
  if (!fd) return '';
  if (fd.includes('pichincha')) return 'Pichincha';
  if (fd.includes('gye')) return 'Guayaquil';
  if (fd.includes('pacifico')) return 'Pacífico';
  if (fd.includes('internacional')) return 'Internacional';
  if (fd.includes('efectivo')) return 'Efectivo';
  return fd;
}

function formatDate(s: string) {
  return new Date(s).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' });
}

const defaultFilters = { fromDate: '', toDate: '', type: '' as '' | 'income' | 'expense' | 'internal_transfer', search: '' };

function CajaMovimientosPageInner() {
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const cashBook: CashBook = searchParams.get('cashBook') === 'dra' ? 'dra' : 'escuela';
  const setCashBook = (b: CashBook) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('cashBook', b);
    router.replace(`/admin/caja/movimientos?${p.toString()}`);
  };
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<'income' | 'expense' | null>(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [form, setForm] = useState({
    concept: '',
    incomeType: 'pago_curso',
    category: 'otros',
    amount: '',
    paymentMethod: 'efectivo' as 'efectivo' | 'transferencia' | 'tarjeta',
    transferBank: 'pichincha' as TransferBankId,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [internalForm, setInternalForm] = useState({
    fromBook: 'escuela' as CashBook,
    toBook: 'dra' as CashBook,
    channel: 'transferencia' as 'efectivo' | 'transferencia' | 'deposito',
    transferBank: 'pichincha' as TransferBankId,
    amount: '',
    concept: '',
    notes: '',
  });
  const [showInternalForm, setShowInternalForm] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const paymentMethodOptions =
    cashBook === 'dra'
      ? Object.entries(PAYMENT_METHOD_LABELS).filter(([k]) => k !== 'tarjeta')
      : Object.entries(PAYMENT_METHOD_LABELS);

  const canEditWithoutAuth = (t: Transaction) =>
    t.type !== 'internal_transfer' &&
    !t.anulado_at &&
    t.session_status === 'open' &&
    t.session_date === today;

  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [editForm, setEditForm] = useState({
    concept: '',
    incomeType: 'pago_curso' as string,
    category: 'otros' as string,
    amount: '',
    paymentMethod: 'efectivo' as 'efectivo' | 'transferencia' | 'tarjeta',
    transferBank: 'pichincha' as TransferBankId,
    notes: '',
  });
  const [authModal, setAuthModal] = useState<{
    transaction: Transaction;
    action: 'edit' | 'anulate';
    adminCode: string;
    reason: string;
  } | null>(null);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const reloadCashPage = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.fromDate) params.set('fromDate', filters.fromDate);
    if (filters.toDate) params.set('toDate', filters.toDate);
    if (filters.type) params.set('type', filters.type);
    if (filters.search) params.set('search', filters.search);
    params.set('cashBook', cashBook);

    Promise.all([
      fetch(`${API_URL}/api/admin/cash/summary?cashBook=${cashBook}`, { headers: getAuthHeaders(token) }).then((r) =>
        r.status === 401 ? triggerSessionExpired() : r.json()
      ),
      fetch(`${API_URL}/api/admin/cash/transactions?${params}`, { headers: getAuthHeaders(token) }).then((r) =>
        r.status === 401 ? triggerSessionExpired() : r.json()
      ),
    ])
      .then(([sum, tx]) => {
        setSummary(sum && !sum.error ? sum : null);
        setTransactions(tx?.transactions ?? []);
        setTotal(tx?.total ?? 0);
      })
      .catch(() => {
        setSummary(null);
        setTransactions([]);
      })
      .finally(() => setLoading(false));
  }, [token, cashBook, filters.fromDate, filters.toDate, filters.type, filters.search]);

  useEffect(() => {
    reloadCashPage();
  }, [reloadCashPage]);

  const handleSubmit = async (e: React.FormEvent, type: 'income' | 'expense') => {
    e.preventDefault();
    if (!summary?.sessionId) {
      setMessage('No hay caja abierta.');
      return;
    }
    const amount = parseFloat(form.amount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      setMessage('Monto debe ser mayor a 0.');
      return;
    }
    if (cashBook === 'dra' && form.paymentMethod === 'tarjeta') {
      setMessage('En caja DRA no se registra tarjeta; use efectivo o transferencia.');
      return;
    }
    const fundsDestination =
      form.paymentMethod === 'transferencia'
        ? undefined
        : pickFundsDestination(form.paymentMethod, cashBook);
    setSubmitting(true);
    setMessage('');
    const url = type === 'income' ? `${API_URL}/api/admin/cash/income` : `${API_URL}/api/admin/cash/expense`;
    const body: Record<string, unknown> =
      type === 'income'
        ? {
            sessionId: summary.sessionId,
            concept: form.concept.trim(),
            incomeType: form.incomeType,
            amount,
            paymentMethod: form.paymentMethod,
            notes: form.notes.trim() || undefined,
          }
        : {
            sessionId: summary.sessionId,
            concept: form.concept.trim(),
            category: form.category,
            amount,
            paymentMethod: form.paymentMethod,
            notes: form.notes.trim() || undefined,
          };
    if (form.paymentMethod === 'transferencia') body.transferBank = form.transferBank;
    else body.fundsDestination = fundsDestination;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...getAuthHeaders(token!), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 401) triggerSessionExpired();
      if (!res.ok) {
        setMessage(data?.error || 'Error al registrar');
        setSubmitting(false);
        return;
      }
      setShowForm(null);
      setForm({
        concept: '',
        incomeType: 'pago_curso',
        category: 'otros',
        amount: '',
        paymentMethod: 'efectivo',
        transferBank: 'pichincha',
        notes: '',
      });
      reloadCashPage();
    } catch {
      setMessage('Error de conexión');
    }
    setSubmitting(false);
  };

  const clearFilters = () => setFilters(defaultFilters);
  const hasActiveFilters = filters.fromDate || filters.toDate || filters.type || filters.search;

  const activeTransactions = transactions.filter((t) => !t.anulado_at);
  const filteredIncome = activeTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const filteredExpense = activeTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const filteredBalance = filteredIncome - filteredExpense;
  const activeCount = activeTransactions.length;

  const openEditModal = (t: Transaction) => {
    if (t.anulado_at) return;
    setEditTransaction(t);
    setEditForm({
      concept: t.concept,
      incomeType: t.income_type || 'pago_curso',
      category: t.category || 'otros',
      amount: String(t.amount),
      paymentMethod: t.payment_method as 'efectivo' | 'transferencia' | 'tarjeta',
      transferBank: transferBankFromFundsDestination(t.funds_destination),
      notes: t.notes || '',
    });
    setActionError('');
    setActionSuccess('');
  };

  const openAuthModal = (t: Transaction, action: 'edit' | 'anulate') => {
    setAuthModal({ transaction: t, action, adminCode: '', reason: '' });
    if (action === 'edit') {
      setEditTransaction(t);
      setEditForm({
        concept: t.concept,
        incomeType: t.income_type || 'pago_curso',
        category: t.category || 'otros',
        amount: String(t.amount),
        paymentMethod: t.payment_method as 'efectivo' | 'transferencia' | 'tarjeta',
        transferBank: transferBankFromFundsDestination(t.funds_destination),
        notes: t.notes || '',
      });
    }
    setActionError('');
  };

  const handleSubmitEdit = async (withAuth: boolean) => {
    if (!editTransaction || !token) return;
    const amount = parseFloat(editForm.amount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      setActionError('Monto debe ser mayor a 0.');
      return;
    }
    setSubmitting(true);
    setActionError('');
    setActionSuccess('');
    try {
      const dest =
        editForm.paymentMethod === 'transferencia'
          ? fundsDestinationForPayment('transferencia', cashBook, editForm.transferBank)
          : editForm.paymentMethod === 'efectivo'
            ? pickFundsDestination('efectivo', cashBook)
            : null;
      const body: Record<string, unknown> = {
        concept: editForm.concept.trim(),
        amount,
        payment_method: editForm.paymentMethod,
        funds_destination: dest,
        notes: editForm.notes.trim() || null,
      };
      if (editTransaction.type === 'income') body.income_type = editForm.incomeType;
      else body.category = editForm.category;
      if (withAuth && authModal) {
        body.adminCode = authModal.adminCode;
        body.reason = authModal.reason.trim();
      }
      const res = await fetch(`${API_URL}/api/admin/cash/transactions/${editTransaction.id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) triggerSessionExpired();
      if (!res.ok) {
        setActionError(data?.error || 'Error al actualizar');
        setSubmitting(false);
        return;
      }
      setActionSuccess('Movimiento actualizado correctamente.');
      setEditTransaction(null);
      setAuthModal(null);
      reloadCashPage();
      setTimeout(() => setActionSuccess(''), 4000);
    } catch {
      setActionError('Error de conexión');
    }
    setSubmitting(false);
  };

  const handleAnulate = async (t: Transaction, withAuth: boolean) => {
    if (!token) return;
    if (withAuth && authModal && (!authModal.reason.trim() || !authModal.adminCode.trim())) {
      setActionError('Código y motivo son requeridos para anular movimientos de caja cerrada.');
      return;
    }
    setSubmitting(true);
    setActionError('');
    setActionSuccess('');
    try {
      const body: Record<string, unknown> = {};
      if (withAuth && authModal) {
        body.adminCode = authModal.adminCode;
        body.reason = authModal.reason.trim();
      } else body.reason = 'Anulación desde caja abierta';
      const res = await fetch(`${API_URL}/api/admin/cash/transactions/${t.id}/anulate`, {
        method: 'POST',
        headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) triggerSessionExpired();
      if (!res.ok) {
        setActionError(data?.error || 'Error al anular');
        setSubmitting(false);
        return;
      }
      setActionSuccess('Movimiento anulado correctamente.');
      setAuthModal(null);
      reloadCashPage();
      setTimeout(() => setActionSuccess(''), 4000);
    } catch {
      setActionError('Error de conexión');
    }
    setSubmitting(false);
  };

  const startEdit = (t: Transaction) => {
    if (t.type === 'internal_transfer') {
      setActionError('Las transferencias internas no se editan aquí; anule y registre de nuevo si aplica.');
      return;
    }
    if (canEditWithoutAuth(t)) openEditModal(t);
    else openAuthModal(t, 'edit');
  };

  const handleInternalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (internalForm.fromBook === internalForm.toBook) {
      setMessage('Origen y destino deben ser distintos.');
      return;
    }
    const amount = parseFloat(internalForm.amount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      setMessage('Monto inválido.');
      return;
    }
    if (internalForm.channel === 'deposito' && !internalForm.transferBank) {
      setMessage('Selecciona el banco donde se acreditó el depósito (libro destino).');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/api/admin/cash/internal-transfer`, {
        method: 'POST',
        headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          fromBook: internalForm.fromBook,
          toBook: internalForm.toBook,
          channel: internalForm.channel,
          ...(internalForm.channel === 'transferencia' || internalForm.channel === 'deposito'
            ? { transferBank: internalForm.transferBank }
            : {}),
          amount,
          concept: internalForm.concept.trim(),
          notes: internalForm.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.status === 401) triggerSessionExpired();
      if (!res.ok) {
        setMessage(data?.error || 'Error al registrar transferencia');
        setSubmitting(false);
        return;
      }
      setShowInternalForm(false);
      setInternalForm({
        fromBook: 'escuela',
        toBook: 'dra',
        channel: 'transferencia',
        transferBank: 'pichincha',
        amount: '',
        concept: '',
        notes: '',
      });
      reloadCashPage();
    } catch {
      setMessage('Error de conexión');
    }
    setSubmitting(false);
  };

  const startAnulate = (t: Transaction) => {
    if (canEditWithoutAuth(t)) {
      if (confirm('¿Anular este movimiento? No se borrará; quedará registrado como anulado y dejará de contar en el balance.')) {
        handleAnulate(t, false);
      }
    } else {
      openAuthModal(t, 'anulate');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        {/* ─── Header ───────────────────────────────────────────────────────── */}
        <header className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Movimientos
              </h1>
              <p className="mt-1 max-w-xl text-sm text-slate-500 sm:text-base">
                Historial por libro (Escuela o DRA). Las transferencias internas se detallan sin contar como egreso operativo.
              </p>
              <div className="mt-4 inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1">
                {(['escuela', 'dra'] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setCashBook(b)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      cashBook === b ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {b === 'escuela' ? 'Caja Escuela' : 'Caja DRA'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Link
                href="/admin/caja"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Dashboard
              </Link>
              {summary?.status === 'open' && (
                <>
                  <button
                    type="button"
                    onClick={() => { setShowForm('income'); setMessage(''); }}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    Ingreso
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowForm('expense'); setMessage(''); }}
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                    Egreso
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInternalForm(true);
                      setMessage('');
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-sky-300 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-800 shadow-sm transition hover:bg-sky-100"
                  >
                    Transferir entre cuentas
                  </button>
                </>
              )}
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

        {/* ─── Caja abierta strip ───────────────────────────────────────────── */}
        {summary?.status === 'open' && (
          <div className="mb-6 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 px-5 py-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-sm font-medium text-emerald-800">Caja abierta ({cashBook === 'dra' ? 'DRA' : 'Escuela'})</span>
              <span className="text-slate-400">·</span>
              <span className="text-sm text-emerald-700">Balance actual</span>
              <span className="text-lg font-bold text-emerald-900">{formatMoney(summary.balance)}</span>
            </div>
          </div>
        )}

        {actionSuccess && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
            <svg className="h-5 w-5 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
            <svg className="h-5 w-5 shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{actionError}</span>
          </div>
        )}

        {/* ─── Filtros ─────────────────────────────────────────────────────── */}
        <section className="mb-6">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm lg:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Filtros</h2>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-5">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">Desde</label>
                <div className="relative mt-1.5">
                  <input
                    type="date"
                    value={filters.fromDate}
                    onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/50 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">Hasta</label>
                <div className="relative mt-1.5">
                  <input
                    type="date"
                    value={filters.toDate}
                    onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/50 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">Tipo</label>
                <select
                  value={filters.type}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, type: e.target.value as '' | 'income' | 'expense' | 'internal_transfer' }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 py-2.5 pl-3 pr-9 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">Todos</option>
                  <option value="income">Ingreso</option>
                  <option value="expense">Egreso</option>
                  <option value="internal_transfer">Transferencia interna</option>
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">Buscar</label>
                <div className="relative mt-1.5">
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                    placeholder="Concepto o notas..."
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Resumen filtrado ────────────────────────────────────────────── */}
        {!loading && transactions.length > 0 && (
          <section className="mb-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Movimientos</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{activeCount}</p>
                {total > activeCount && <p className="text-xs text-slate-500">{total - activeCount} anulados</p>}
              </div>
              <div className="rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Ingresos</p>
                <p className="mt-1 text-xl font-bold text-emerald-600">+ {formatMoney(filteredIncome)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Egresos</p>
                <p className="mt-1 text-xl font-bold text-rose-600">− {formatMoney(filteredExpense)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Balance</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{formatMoney(filteredBalance)}</p>
              </div>
            </div>
          </section>
        )}

        {/* ─── Tabla ──────────────────────────────────────────────────────── */}
        <section>
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
            {loading ? (
              <div className="flex flex-col items-center justify-center px-8 py-16">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
                <p className="mt-4 text-sm font-medium text-slate-500">Cargando movimientos...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                  <svg className="h-7 w-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">Sin movimientos</h3>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  {hasActiveFilters ? 'No hay registros con los filtros aplicados. Prueba ampliando el rango o limpiando filtros.' : 'Aún no hay movimientos registrados. Abre la caja y registra ingresos o egresos.'}
                </p>
                {hasActiveFilters && (
                  <button type="button" onClick={clearFilters} className="mt-4 text-sm font-medium text-emerald-600 hover:text-emerald-700">
                    Limpiar filtros
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80">
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Fecha</th>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Tipo</th>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Concepto</th>
                        <th className="hidden px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">Categoría</th>
                        <th className="hidden px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Método</th>
                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Monto</th>
                        <th className="hidden px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">Usuario</th>
                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transactions.map((t) => (
                        <tr key={t.id} className={`transition hover:bg-slate-50/80 ${t.anulado_at ? 'opacity-60 bg-slate-50/50' : ''}`}>
                          <td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatDate(t.created_at)}</td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                t.anulado_at
                                  ? 'bg-slate-200 text-slate-600'
                                  : t.type === 'internal_transfer'
                                  ? 'bg-sky-100 text-sky-900'
                                  : t.type === 'income'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  t.anulado_at
                                    ? 'bg-slate-400'
                                    : t.type === 'internal_transfer'
                                    ? 'bg-sky-500'
                                    : t.type === 'income'
                                    ? 'bg-emerald-500'
                                    : 'bg-rose-500'
                                }`}
                              />
                              {t.anulado_at
                                ? 'Anulado'
                                : t.type === 'internal_transfer'
                                ? 'Transf. interna'
                                : t.type === 'income'
                                ? 'Ingreso'
                                : 'Egreso'}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-medium text-slate-900">
                            {t.concept}
                            {t.anulado_reason && <span className="block text-xs font-normal text-slate-500">Motivo: {t.anulado_reason}</span>}
                          </td>
                          <td className="hidden px-5 py-4 text-slate-600 sm:table-cell">
                            {t.type === 'internal_transfer'
                              ? (() => {
                                  const arrow = `${t.internal_from_book === 'escuela' ? 'Escuela' : 'DRA'} → ${
                                    t.internal_to_book === 'escuela' ? 'Escuela' : 'DRA'
                                  }`;
                                  const ch =
                                    t.internal_channel === 'deposito'
                                      ? 'Depósito (efectivo→banco)'
                                      : t.internal_channel === 'efectivo'
                                        ? 'Efectivo'
                                        : 'Transferencia';
                                  const bank =
                                    t.funds_destination && (t.internal_channel === 'deposito' || t.internal_channel === 'transferencia')
                                      ? ` · ${shortFundsDestinationLabel(t.funds_destination)}`
                                      : '';
                                  return `${arrow} · ${ch}${bank}`;
                                })()
                              : t.type === 'income'
                              ? t.income_type
                                ? INCOME_TYPE_LABELS[t.income_type] ?? t.income_type
                                : '—'
                              : t.category
                              ? EXPENSE_CATEGORY_LABELS[t.category] ?? t.category
                              : '—'}
                          </td>
                          <td className="hidden px-5 py-4 text-slate-600 md:table-cell">
                            {t.type === 'internal_transfer' && t.internal_channel === 'deposito'
                              ? 'Depósito interno'
                              : PAYMENT_METHOD_LABELS[t.payment_method] ?? t.payment_method}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-right">
                            <span
                              className={`font-semibold tabular-nums ${
                                t.anulado_at
                                  ? 'text-slate-400 line-through'
                                  : t.type === 'internal_transfer'
                                  ? 'text-slate-600'
                                  : t.type === 'income'
                                  ? 'text-emerald-600'
                                  : 'text-rose-600'
                              }`}
                            >
                              {t.type === 'internal_transfer' ? '' : t.type === 'income' ? '+' : '−'}{' '}
                              {formatMoney(t.amount)}
                            </span>
                          </td>
                          <td className="hidden px-5 py-4 text-slate-500 lg:table-cell">{t.created_by_name || '—'}</td>
                          <td className="whitespace-nowrap px-5 py-4 text-right">
                            {t.anulado_at ? (
                              <span className="text-xs text-slate-400">—</span>
                            ) : (
                              <div className="flex justify-end gap-1.5">
                                {!canEditWithoutAuth(t) && (
                                  <span className="inline-flex items-center rounded-lg bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800" title="Caja cerrada o de otro día: se requiere autorización">
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                  </span>
                                )}
                                {t.type !== 'internal_transfer' && (
                                  <button
                                    type="button"
                                    onClick={() => startEdit(t)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    Editar
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => startAnulate(t)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                  Anular
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-5 py-3">
                  <span className="text-xs font-medium text-slate-500">{total} movimiento{total !== 1 ? 's' : ''} en total{activeCount < total ? ` (${activeCount} activos)` : ''}</span>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ─── Modal Autorización (caja cerrada / otro día) ─────────────────── */}
        {authModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl shadow-slate-300/30">
              <h3 className="text-xl font-semibold text-slate-900">
                {authModal.action === 'edit' ? 'Autorización para editar' : 'Autorización para anular'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Este movimiento pertenece a una caja cerrada o de otro día. Ingrese el código de administrador y el motivo.
              </p>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Código de administrador *</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    value={authModal.adminCode}
                    onChange={(e) => setAuthModal((a) => a ? { ...a, adminCode: e.target.value } : a)}
                    placeholder="Código"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Motivo de la modificación *</label>
                  <textarea
                    value={authModal.reason}
                    onChange={(e) => setAuthModal((a) => a ? { ...a, reason: e.target.value } : a)}
                    rows={3}
                    placeholder="Ej: corrección de monto por error de digitación"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                {authModal.action === 'edit' && editTransaction && (
                  <>
                    <hr className="border-slate-200" />
                    <p className="text-sm font-medium text-slate-700">Datos del movimiento</p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500">Concepto *</label>
                        <input
                          value={editForm.concept}
                          onChange={(e) => setEditForm((f) => ({ ...f, concept: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      {editTransaction.type === 'income' ? (
                        <div>
                          <label className="block text-xs font-medium text-slate-500">Tipo de ingreso</label>
                          <select
                            value={editForm.incomeType}
                            onChange={(e) => setEditForm((f) => ({ ...f, incomeType: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          >
                            {Object.entries(INCOME_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-medium text-slate-500">Categoría</label>
                          <select
                            value={editForm.category}
                            onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          >
                            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-medium text-slate-500">Monto *</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editForm.amount}
                          onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500">Método de pago</label>
                        <select
                          value={editForm.paymentMethod}
                          onChange={(e) => setEditForm((f) => ({ ...f, paymentMethod: e.target.value as 'efectivo' | 'transferencia' | 'tarjeta' }))}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        >
                          {paymentMethodOptions.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                      {editForm.paymentMethod === 'transferencia' && (
                        <div>
                          <label className="block text-xs font-medium text-slate-500">Banco</label>
                          <select
                            value={editForm.transferBank}
                            onChange={(e) => setEditForm((f) => ({ ...f, transferBank: e.target.value as TransferBankId }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          >
                            {TRANSFER_BANK_OPTIONS.map((o) => (
                              <option key={o.id} value={o.id}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-medium text-slate-500">Observaciones</label>
                        <input
                          value={editForm.notes}
                          onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
              {actionError && <p className="mt-3 text-sm font-medium text-rose-600">{actionError}</p>}
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setAuthModal(null); setActionError(''); }}
                  className="flex-1 rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={submitting || !authModal.adminCode.trim() || !authModal.reason.trim()}
                  onClick={() => {
                    if (authModal.action === 'edit') handleSubmitEdit(true);
                    else handleAnulate(authModal.transaction, true);
                  }}
                  className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? 'Procesando...' : authModal.action === 'edit' ? 'Autorizar y guardar' : 'Autorizar y anular'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Modal Editar (solo caja abierta del día) ─────────────────────── */}
        {editTransaction && !authModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl shadow-slate-300/30 lg:p-8 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-semibold text-slate-900">Editar movimiento</h3>
              <p className="mt-1 text-sm text-slate-500">Caja abierta del día: los cambios actualizarán el balance automáticamente.</p>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Concepto *</label>
                  <input
                    value={editForm.concept}
                    onChange={(e) => setEditForm((f) => ({ ...f, concept: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    required
                  />
                </div>
                {editTransaction.type === 'income' ? (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Tipo de ingreso</label>
                    <select
                      value={editForm.incomeType}
                      onChange={(e) => setEditForm((f) => ({ ...f, incomeType: e.target.value }))}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {Object.entries(INCOME_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Categoría</label>
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700">Monto *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editForm.amount}
                    onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Método de pago</label>
                  <select
                    value={editForm.paymentMethod}
                    onChange={(e) => setEditForm((f) => ({ ...f, paymentMethod: e.target.value as 'efectivo' | 'transferencia' | 'tarjeta' }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {paymentMethodOptions.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {editForm.paymentMethod === 'transferencia' && (
                  <div className="rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3">
                    <label className="block text-sm font-medium text-slate-800">Banco de la transferencia</label>
                    <select
                      value={editForm.transferBank}
                      onChange={(e) => setEditForm((f) => ({ ...f, transferBank: e.target.value as TransferBankId }))}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                    >
                      {TRANSFER_BANK_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700">Observaciones</label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
              {actionError && <p className="mt-3 text-sm font-medium text-rose-600">{actionError}</p>}
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setEditTransaction(null); setActionError(''); }}
                  className="flex-1 rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmitEdit(false)}
                  className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 disabled:opacity-60"
                >
                  {submitting ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Modal Ingreso ───────────────────────────────────────────────── */}
        {showForm === 'income' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl shadow-slate-300/30 lg:p-8 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-semibold text-slate-900">Registrar ingreso</h3>
              <p className="mt-1 text-sm text-slate-500">El movimiento se asociará a la caja abierta del día.</p>
              <form onSubmit={(e) => handleSubmit(e, 'income')} className="mt-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Concepto *</label>
                  <input
                    value={form.concept}
                    onChange={(e) => setForm((f) => ({ ...f, concept: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Tipo de ingreso</label>
                  <select
                    value={form.incomeType}
                    onChange={(e) => setForm((f) => ({ ...f, incomeType: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {Object.entries(INCOME_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Monto *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Método de pago</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value as 'efectivo' | 'transferencia' | 'tarjeta' }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {paymentMethodOptions.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {form.paymentMethod === 'transferencia' && (
                  <div className="rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3">
                    <label className="block text-sm font-medium text-slate-800">Banco de la transferencia</label>
                    <p className="mt-0.5 text-xs text-slate-500">Seleccione la cuenta donde ingresó o salió el valor.</p>
                    <select
                      value={form.transferBank}
                      onChange={(e) => setForm((f) => ({ ...f, transferBank: e.target.value as TransferBankId }))}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                    >
                      {TRANSFER_BANK_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700">Observaciones</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                {message && <p className="text-sm font-medium text-rose-600">{message}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(null)} className="flex-1 rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2">Cancelar</button>
                  <button type="submit" disabled={submitting} className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">{submitting ? 'Guardando...' : 'Registrar'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── Modal Egreso ────────────────────────────────────────────────── */}
        {showForm === 'expense' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl shadow-slate-300/30 lg:p-8 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-semibold text-slate-900">Registrar egreso</h3>
              <p className="mt-1 text-sm text-slate-500">El movimiento se descontará del balance de la caja abierta.</p>
              <form onSubmit={(e) => handleSubmit(e, 'expense')} className="mt-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Concepto *</label>
                  <input
                    value={form.concept}
                    onChange={(e) => setForm((f) => ({ ...f, concept: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Categoría</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Monto *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Método de pago</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value as 'efectivo' | 'transferencia' | 'tarjeta' }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {paymentMethodOptions.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {form.paymentMethod === 'transferencia' && (
                  <div className="rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3">
                    <label className="block text-sm font-medium text-slate-800">Banco de la transferencia</label>
                    <p className="mt-0.5 text-xs text-slate-500">Seleccione la cuenta desde la que salió el pago.</p>
                    <select
                      value={form.transferBank}
                      onChange={(e) => setForm((f) => ({ ...f, transferBank: e.target.value as TransferBankId }))}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                    >
                      {TRANSFER_BANK_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700">Observaciones</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                {message && <p className="text-sm font-medium text-rose-600">{message}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(null)} className="flex-1 rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2">Cancelar</button>
                  <button type="submit" disabled={submitting} className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-600/25 transition hover:bg-rose-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2">{submitting ? 'Guardando...' : 'Registrar'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showInternalForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl lg:p-8 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-semibold text-slate-900">Transferencia entre cuentas</h3>
              <p className="mt-1 text-sm text-slate-500">
                No se registra como ingreso/egreso operativo; ajusta balances entre Escuela y DRA. Requiere caja abierta en el libro de <strong>origen</strong>.{' '}
                <strong>Depósito:</strong> el efectivo sale de la caja del origen y se acredita en la cuenta bancaria del destino (elige el banco del libro destino).
              </p>
              <form onSubmit={handleInternalSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Desde (libro origen)</label>
                  <select
                    value={internalForm.fromBook}
                    onChange={(e) => setInternalForm((f) => ({ ...f, fromBook: e.target.value as CashBook }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900"
                  >
                    <option value="escuela">Escuela</option>
                    <option value="dra">DRA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Hacia</label>
                  <select
                    value={internalForm.toBook}
                    onChange={(e) => setInternalForm((f) => ({ ...f, toBook: e.target.value as CashBook }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900"
                  >
                    <option value="escuela">Escuela</option>
                    <option value="dra">DRA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Canal</label>
                  <select
                    value={internalForm.channel}
                    onChange={(e) =>
                      setInternalForm((f) => ({
                        ...f,
                        channel: e.target.value as 'efectivo' | 'transferencia' | 'deposito',
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-slate-900"
                  >
                    <option value="transferencia">Transferencia (entre cuentas bancarias del origen)</option>
                    <option value="efectivo">Efectivo (caja física entre libros)</option>
                    <option value="deposito">Depósito (sale efectivo del origen → banco del destino)</option>
                  </select>
                </div>
                {internalForm.channel === 'transferencia' && (
                  <div className="rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3">
                    <label className="block text-sm font-medium text-slate-800">Banco de la transferencia</label>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Cuenta del libro <strong>origen</strong> ({internalForm.fromBook === 'dra' ? 'DRA' : 'Escuela'}) por la que se movió el valor.
                    </p>
                    <select
                      value={internalForm.transferBank}
                      onChange={(e) =>
                        setInternalForm((f) => ({ ...f, transferBank: e.target.value as TransferBankId }))
                      }
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                    >
                      {TRANSFER_BANK_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {internalForm.channel === 'deposito' && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3">
                    <label className="block text-sm font-medium text-slate-800">Banco de acreditación (libro destino)</label>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Cuenta bancaria del libro <strong>{internalForm.toBook === 'dra' ? 'DRA' : 'Escuela'}</strong> donde ingresó el depósito. El efectivo se descuenta de la caja del origen.
                    </p>
                    <select
                      value={internalForm.transferBank}
                      onChange={(e) =>
                        setInternalForm((f) => ({ ...f, transferBank: e.target.value as TransferBankId }))
                      }
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                    >
                      {TRANSFER_BANK_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700">Monto *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={internalForm.amount}
                    onChange={(e) => setInternalForm((f) => ({ ...f, amount: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Concepto *</label>
                  <input
                    value={internalForm.concept}
                    onChange={(e) => setInternalForm((f) => ({ ...f, concept: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Observaciones</label>
                  <textarea
                    value={internalForm.notes}
                    onChange={(e) => setInternalForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3"
                  />
                </div>
                {message && <p className="text-sm font-medium text-rose-600">{message}</p>}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInternalForm(false);
                      setMessage('');
                    }}
                    className="flex-1 rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {submitting ? 'Guardando...' : 'Registrar'}
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

export default function CajaMovimientosPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Cargando movimientos…</div>}>
      <CajaMovimientosPageInner />
    </Suspense>
  );
}
