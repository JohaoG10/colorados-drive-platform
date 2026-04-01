import { supabaseAdmin } from '../config/supabase';

export type CashSessionStatus = 'open' | 'closed';
export type CashBook = 'escuela' | 'dra';
export type CashTransactionType = 'income' | 'expense' | 'internal_transfer';
export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta';

/** Destinos de fondos (sub-cuenta) para efectivo y transferencia; tarjeta no usa destino (solo Escuela). */
export const FUNDS_DESTINATIONS = [
  'trans_pichincha_escuela',
  'trans_internacional_escuela',
  'trans_gye_escuela',
  'trans_pacifico_escuela',
  'trans_pichincha_dra',
  'trans_gye_dra',
  'trans_pacifico_dra',
  'efectivo_escuela',
  'efectivo_dra',
] as const;
export type FundsDestination = (typeof FUNDS_DESTINATIONS)[number];

/** Bancos estándar al elegir transferencia (UI). */
export const TRANSFER_BANK_IDS = ['pichincha', 'guayaquil', 'pacifico'] as const;
export type TransferBankId = (typeof TRANSFER_BANK_IDS)[number];

export const TRANSFER_BANK_LABELS: Record<TransferBankId, string> = {
  pichincha: 'Banco Pichincha',
  guayaquil: 'Banco Guayaquil',
  pacifico: 'Banco del Pacífico',
};

export const FUNDS_DESTINATION_LABELS: Record<FundsDestination, string> = {
  trans_pichincha_escuela: 'Transferencia — Pichincha (Escuela)',
  trans_internacional_escuela: 'Transferencia — Internacional (Escuela)',
  trans_gye_escuela: 'Transferencia — Guayaquil (Escuela)',
  trans_pacifico_escuela: 'Transferencia — Pacífico (Escuela)',
  trans_pichincha_dra: 'Transferencia — Pichincha (DRA)',
  trans_gye_dra: 'Transferencia — Guayaquil (DRA)',
  trans_pacifico_dra: 'Transferencia — Pacífico (DRA)',
  efectivo_escuela: 'Efectivo — Caja Escuela',
  efectivo_dra: 'Efectivo — Caja DRA',
};

/** Mapea banco UI → destino en BD según libro. */
export function fundsDestinationForTransferBank(cashBook: CashBook, bank: TransferBankId): FundsDestination {
  if (cashBook === 'dra') {
    if (bank === 'pichincha') return 'trans_pichincha_dra';
    if (bank === 'guayaquil') return 'trans_gye_dra';
    return 'trans_pacifico_dra';
  }
  if (bank === 'pichincha') return 'trans_pichincha_escuela';
  if (bank === 'guayaquil') return 'trans_gye_escuela';
  return 'trans_pacifico_escuela';
}

export function parseTransferBankId(q: unknown): TransferBankId | undefined {
  if (q === 'pichincha' || q === 'guayaquil' || q === 'pacifico') return q;
  return undefined;
}

export const INTERNAL_TRANSFER_CHANNELS = ['efectivo', 'transferencia', 'deposito'] as const;
export type InternalTransferChannel = (typeof INTERNAL_TRANSFER_CHANNELS)[number];

export function parseCashBookQuery(q: unknown): CashBook | 'all' | undefined {
  if (q === 'all' || q === 'escuela' || q === 'dra') return q;
  return undefined;
}

export function normalizeCashBookFromRow(row: { cash_book?: string | null }): CashBook {
  return row.cash_book === 'dra' ? 'dra' : 'escuela';
}

export const INCOME_TYPES = [
  'pago_matricula',
  'pago_curso',
  'pago_examen',
  'pago_clases_adicionales',
  'otros',
] as const;
export type IncomeType = (typeof INCOME_TYPES)[number];

export const EXPENSE_CATEGORIES = [
  'sueldos',
  'combustible',
  'materiales',
  'publicidad',
  'mantenimiento',
  'otros',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface CashSessionRow {
  id: string;
  date: string;
  cash_book: CashBook;
  opening_amount: number;
  closing_amount: number | null;
  status: CashSessionStatus;
  opened_by: string;
  closed_by: string | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashTransactionRow {
  id: string;
  cash_session_id: string;
  cash_book: CashBook;
  type: CashTransactionType;
  concept: string;
  category: string | null;
  income_type: string | null;
  payment_method: PaymentMethod;
  amount: number;
  funds_destination: FundsDestination | null;
  internal_from_book: CashBook | null;
  internal_to_book: CashBook | null;
  internal_channel: InternalTransferChannel | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  anulado_at?: string | null;
  anulado_por?: string | null;
  anulado_reason?: string | null;
}

export interface CashSessionWithDetails extends CashSessionRow {
  opened_by_name?: string | null;
  closed_by_name?: string | null;
  total_income?: number;
  total_expense?: number;
  transaction_count?: number;
}

export interface CashTransactionWithCreator extends CashTransactionRow {
  created_by_name?: string | null;
}

/** Para listado en movimientos: incluye datos de la sesión para saber si permite editar/anular sin código */
export interface CashTransactionWithSession extends CashTransactionWithCreator {
  session_date?: string;
  session_status?: CashSessionStatus;
}

export interface CashSummary {
  sessionId: string;
  date: string;
  cashBook: CashBook;
  openingAmount: number;
  totalIncome: number;
  totalExpense: number;
  /** Balance según libro: Escuela = solo efectivo (+ ajustes transferencia interna en efectivo); DRA = efectivo + transferencia (+ internas). */
  balance: number;
  status: CashSessionStatus;
  transactionCount: number;
}

export interface CashReportPeriod {
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
  sessions: { date: string; totalIncome: number; totalExpense: number; balance: number; count: number }[];
}

export interface MonthlyStat {
  year: number;
  month: number;
  monthLabel: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  sessionCount: number;
  transactionCount: number;
}

export interface CashAlert {
  type: 'negative_balance' | 'yesterday_not_closed' | 'no_caja_today' | 'session_negative_balance';
  severity: 'error' | 'warning' | 'info';
  message: string;
  date?: string;
  sessionId?: string;
}

export interface FinancialDashboard {
  /** Vista solicitada (por defecto escuela). */
  view: CashBook | 'all';
  summary: CashSummary | null;
  /** Si view=all, resumen del libro DRA en paralelo. */
  summaryDra: CashSummary | null;
  last7Days: { date: string; totalIncome: number; totalExpense: number; balance: number; count: number }[];
  last7DaysDra?: { date: string; totalIncome: number; totalExpense: number; balance: number; count: number }[];
  monthlyStats: MonthlyStat[];
  monthlyStatsDra?: MonthlyStat[];
  alerts: CashAlert[];
}

/** Datos completos para exportar reporte (PDF/Excel) */
export interface CashReportExportData {
  cashBook: CashBook;
  bookTitle: string;
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  balanceDescription: string;
  totalEfectivo?: number;
  totalTransferencia?: number;
  totalTarjeta?: number;
  transactionCount: number;
  countIncome: number;
  countExpense: number;
  byCategory: { label: string; total: number; count: number }[];
  byPaymentMethod: { method: string; total: number; count: number }[];
  /** Ingresos y egresos operativos (sin anulados). */
  transactions: CashTransactionWithCreator[];
  /** Movimientos entre libros; no suman a ingreso/egreso operativo. */
  internalTransfers: CashTransactionWithCreator[];
}

/** Reporte único: Escuela + DRA + internas consolidadas. */
export interface CashReportCombinedExportData {
  startDate: string;
  endDate: string;
  escuela: CashReportExportData;
  dra: CashReportExportData;
  allInternalTransfers: CashTransactionWithCreator[];
}

function getUserDisplayName(profile: { full_name?: string | null } | null): string | null {
  return profile?.full_name?.trim() || null;
}

function mapSessionRow(raw: Record<string, unknown>): CashSessionRow {
  const r = raw as unknown as CashSessionRow;
  return { ...r, cash_book: normalizeCashBookFromRow(raw as { cash_book?: string | null }) };
}

function mapTransactionRow(raw: Record<string, unknown>): CashTransactionRow {
  const r = raw as unknown as CashTransactionRow;
  const typeRaw = String(raw.type || 'income');
  const type: CashTransactionType =
    typeRaw === 'internal_transfer' ? 'internal_transfer' : typeRaw === 'expense' ? 'expense' : 'income';
  return {
    ...r,
    cash_book: normalizeCashBookFromRow(raw as { cash_book?: string | null }),
    type,
    funds_destination: (raw.funds_destination as FundsDestination | null | undefined) ?? null,
    internal_from_book: (raw.internal_from_book as CashBook | null | undefined) ?? null,
    internal_to_book: (raw.internal_to_book as CashBook | null | undefined) ?? null,
    internal_channel: (raw.internal_channel as InternalTransferChannel | null | undefined) ?? null,
  };
}

async function loadTransactionsForSessionIds(sessionIds: string[]): Promise<CashTransactionRow[]> {
  if (sessionIds.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from('cash_transactions')
    .select('*')
    .in('cash_session_id', sessionIds)
    .is('anulado_at', null);
  if (error) throw new Error(error.message);
  return (data || []).map((row) => mapTransactionRow(row as Record<string, unknown>));
}

/** Transferencias internas en el rango de fechas que afectan al libro (aunque el registro cuelgue de la sesión origen). */
async function fetchInternalTransfersAffectingBook(
  fromDate: string,
  toDate: string,
  book: CashBook
): Promise<CashTransactionRow[]> {
  const { data: sessions, error: sErr } = await supabaseAdmin
    .from('cash_sessions')
    .select('id')
    .gte('date', fromDate)
    .lte('date', toDate);
  if (sErr) throw new Error(sErr.message);
  const sessionIds = (sessions || []).map((s: { id: string }) => s.id);
  if (sessionIds.length === 0) return [];
  const orFilter =
    book === 'dra'
      ? 'internal_from_book.eq.dra,internal_to_book.eq.dra'
      : 'internal_from_book.eq.escuela,internal_to_book.eq.escuela';
  const { data, error } = await supabaseAdmin
    .from('cash_transactions')
    .select('*')
    .in('cash_session_id', sessionIds)
    .eq('type', 'internal_transfer')
    .is('anulado_at', null)
    .or(orFilter);
  if (error) throw new Error(error.message);
  return (data || []).map((row) => mapTransactionRow(row as Record<string, unknown>));
}

/** Todas las transferencias internas en el rango (una fila por movimiento). */
async function fetchInternalTransfersInPeriod(fromDate: string, toDate: string): Promise<CashTransactionRow[]> {
  const { data: sessions, error: sErr } = await supabaseAdmin
    .from('cash_sessions')
    .select('id')
    .gte('date', fromDate)
    .lte('date', toDate);
  if (sErr) throw new Error(sErr.message);
  const sessionIds = (sessions || []).map((s: { id: string }) => s.id);
  if (sessionIds.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from('cash_transactions')
    .select('*')
    .in('cash_session_id', sessionIds)
    .eq('type', 'internal_transfer')
    .is('anulado_at', null);
  if (error) throw new Error(error.message);
  return (data || []).map((row) => mapTransactionRow(row as Record<string, unknown>));
}

async function attachCreatorNames<T extends { created_by: string | null }>(transactions: T[]): Promise<(T & { created_by_name?: string | null })[]> {
  const creatorIds = [...new Set(transactions.map((t) => t.created_by).filter(Boolean))] as string[];
  let profiles: Map<string, string | null> = new Map();
  if (creatorIds.length > 0) {
    const { data: profilesData } = await supabaseAdmin
      .from('user_profiles')
      .select('id, full_name')
      .in('id', creatorIds);
    profilesData?.forEach((p: { id: string; full_name: string | null }) => {
      profiles.set(p.id, p.full_name?.trim() || null);
    });
  }
  return transactions.map((t) => ({
    ...t,
    created_by_name: t.created_by ? profiles.get(t.created_by) ?? null : null,
  }));
}

/**
 * Cierre de caja según libro:
 * - Escuela: efectivo operativo + internas (sale = -, entra = +).
 * - DRA: todos los métodos operativos + internas (sale = -, entra = +).
 */
export async function computeBookClosing(sessionId: string): Promise<number> {
  const { data: sessionRaw, error: fetchErr } = await supabaseAdmin
    .from('cash_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
  if (fetchErr || !sessionRaw) throw new Error('Sesión no encontrada');
  const session = mapSessionRow(sessionRaw as Record<string, unknown>);
  const book = session.cash_book;
  const date = session.date;
  const opening = Number(session.opening_amount);

  const { data: daySessionsRaw } = await supabaseAdmin.from('cash_sessions').select('id').eq('date', date);
  const daySessionIds = (daySessionsRaw || []).map((s: { id: string }) => s.id);
  const dayTxs = await loadTransactionsForSessionIds(daySessionIds);
  const internalTxs = dayTxs.filter((t) => t.type === 'internal_transfer');

  if (book === 'escuela') {
    let closing = opening;
    const myNormal = dayTxs.filter(
      (t) => t.cash_session_id === sessionId && (t.type === 'income' || t.type === 'expense')
    );
    for (const t of myNormal) {
      if (t.payment_method !== 'efectivo') continue;
      const a = Number(t.amount);
      if (t.type === 'income') closing += a;
      else closing -= a;
    }
    for (const t of internalTxs) {
      const a = Number(t.amount);
      if (t.internal_from_book === 'escuela') closing -= a;
      if (t.internal_to_book === 'escuela') closing += a;
    }
    return closing;
  }

  let closing = opening;
  const myNormal = dayTxs.filter(
    (t) => t.cash_session_id === sessionId && (t.type === 'income' || t.type === 'expense')
  );
  for (const t of myNormal) {
    const a = Number(t.amount);
    if (t.type === 'income') closing += a;
    else closing -= a;
  }
  for (const t of internalTxs) {
    const a = Number(t.amount);
    if (t.internal_to_book === 'dra') closing += a;
    if (t.internal_from_book === 'dra') closing -= a;
  }
  return closing;
}

export async function getOpenSessionForDate(dateStr?: string, cashBook: CashBook = 'escuela'): Promise<CashSessionRow | null> {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from('cash_sessions')
    .select('*')
    .eq('date', date)
    .eq('cash_book', cashBook)
    .eq('status', 'open')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapSessionRow(data as Record<string, unknown>) : null;
}

export async function getSessionByDate(dateStr: string, cashBook: CashBook = 'escuela'): Promise<CashSessionRow | null> {
  const { data, error } = await supabaseAdmin
    .from('cash_sessions')
    .select('*')
    .eq('date', dateStr)
    .eq('cash_book', cashBook)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapSessionRow(data as Record<string, unknown>) : null;
}

export async function openSession(params: {
  date: string;
  openingAmount: number;
  openedBy: string;
  cashBook?: CashBook;
}): Promise<CashSessionRow> {
  const cashBook = params.cashBook ?? 'escuela';
  if (params.openingAmount < 0) throw new Error('El monto inicial no puede ser negativo');
  const { data: existing } = await supabaseAdmin
    .from('cash_sessions')
    .select('id, status')
    .eq('date', params.date)
    .eq('cash_book', cashBook)
    .maybeSingle();
  if (existing) {
    if (existing.status === 'open') throw new Error('Ya existe una caja abierta para esta fecha y libro');
    throw new Error('Ya existe una caja cerrada para esta fecha y libro');
  }
  const { data, error } = await supabaseAdmin
    .from('cash_sessions')
    .insert({
      date: params.date,
      cash_book: cashBook,
      opening_amount: params.openingAmount,
      status: 'open',
      opened_by: params.openedBy,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapSessionRow(data as Record<string, unknown>);
}

export async function closeSession(params: {
  sessionId: string;
  closedBy: string;
}): Promise<CashSessionRow> {
  const { data: sessionRaw, error: fetchErr } = await supabaseAdmin
    .from('cash_sessions')
    .select('*')
    .eq('id', params.sessionId)
    .single();
  if (fetchErr || !sessionRaw) throw new Error('Sesión no encontrada');
  const session = mapSessionRow(sessionRaw as Record<string, unknown>);
  if (session.status !== 'open') throw new Error('La caja ya está cerrada');

  const closingAmount = await computeBookClosing(params.sessionId);

  const { data: updated, error } = await supabaseAdmin
    .from('cash_sessions')
    .update({
      status: 'closed',
      closing_amount: closingAmount,
      closed_by: params.closedBy,
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.sessionId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapSessionRow(updated as Record<string, unknown>);
}

export async function getTotalsForSession(sessionId: string): Promise<{ totalIncome: number; totalExpense: number }> {
  const { data, error } = await supabaseAdmin
    .from('cash_transactions')
    .select('type, amount')
    .eq('cash_session_id', sessionId)
    .is('anulado_at', null);
  if (error) throw new Error(error.message);
  let totalIncome = 0;
  let totalExpense = 0;
  (data || []).forEach((row: { type: string; amount: number }) => {
    if (row.type === 'internal_transfer') return;
    if (row.type === 'income') totalIncome += Number(row.amount);
    else if (row.type === 'expense') totalExpense += Number(row.amount);
  });
  return { totalIncome, totalExpense };
}

export async function getTodaySummary(cashBook: CashBook = 'escuela'): Promise<CashSummary | null> {
  const today = new Date().toISOString().slice(0, 10);
  const session = await getOpenSessionForDate(today, cashBook);
  if (!session) return null;
  const opening = Number(session.opening_amount);
  const [{ totalIncome, totalExpense }, balance, countRes] = await Promise.all([
    getTotalsForSession(session.id),
    computeBookClosing(session.id),
    supabaseAdmin
      .from('cash_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('cash_session_id', session.id)
      .is('anulado_at', null),
  ]);
  return {
    sessionId: session.id,
    date: session.date,
    cashBook: session.cash_book,
    openingAmount: opening,
    totalIncome,
    totalExpense,
    balance,
    status: session.status,
    transactionCount: countRes.count ?? 0,
  };
}

const DEST_BY_BOOK: Record<CashBook, { trans: FundsDestination[]; efectivo: FundsDestination }> = {
  escuela: {
    trans: [
      'trans_pichincha_escuela',
      'trans_gye_escuela',
      'trans_pacifico_escuela',
      'trans_internacional_escuela',
    ],
    efectivo: 'efectivo_escuela',
  },
  dra: {
    trans: ['trans_pichincha_dra', 'trans_gye_dra', 'trans_pacifico_dra'],
    efectivo: 'efectivo_dra',
  },
};

function isTransferDestinationForBook(dest: FundsDestination | null | undefined, book: CashBook): boolean {
  return !!dest && DEST_BY_BOOK[book].trans.includes(dest);
}

function isDepositInternal(t: Pick<CashTransactionWithCreator, 'type' | 'internal_channel' | 'internal_to_book' | 'funds_destination'>): boolean {
  if (t.type !== 'internal_transfer') return false;
  if (t.internal_channel === 'deposito') return true;
  if (t.internal_channel !== 'transferencia' || !t.internal_to_book) return false;
  return isTransferDestinationForBook(t.funds_destination as FundsDestination | null | undefined, t.internal_to_book);
}

/** Valida y normaliza destino de fondos según método y libro de caja. */
export function validateFundsDestination(
  paymentMethod: PaymentMethod,
  cashBook: CashBook,
  dest: FundsDestination | null | undefined
): FundsDestination | null {
  if (paymentMethod === 'tarjeta') {
    if (cashBook !== 'escuela') throw new Error('Los pagos con tarjeta solo se registran en la caja Escuela');
    return null;
  }
  if (!dest) throw new Error('Debe indicar el destino de los fondos (cuenta o caja)');
  if (paymentMethod === 'efectivo') {
    const want = DEST_BY_BOOK[cashBook].efectivo;
    if (dest !== want) throw new Error('El destino de efectivo no corresponde al libro de caja seleccionado');
    return dest;
  }
  if (!DEST_BY_BOOK[cashBook].trans.includes(dest)) {
    throw new Error('El destino de transferencia no corresponde al libro de caja seleccionado');
  }
  return dest;
}

export async function addIncome(params: {
  sessionId: string;
  concept: string;
  incomeType: IncomeType;
  amount: number;
  paymentMethod: PaymentMethod;
  fundsDestination?: FundsDestination | null;
  transferBank?: TransferBankId | null;
  notes?: string | null;
  createdBy: string | null;
}): Promise<CashTransactionRow> {
  if (params.amount <= 0) throw new Error('El monto debe ser mayor a 0');
  const { data: sessionRaw } = await supabaseAdmin
    .from('cash_sessions')
    .select('status, cash_book')
    .eq('id', params.sessionId)
    .single();
  if (!sessionRaw || (sessionRaw as { status: string }).status !== 'open') {
    throw new Error('La caja está cerrada o no existe. No se pueden agregar movimientos.');
  }
  const cashBook = normalizeCashBookFromRow(sessionRaw as { cash_book?: string | null });
  const destInput =
    params.paymentMethod === 'transferencia' && params.transferBank
      ? fundsDestinationForTransferBank(cashBook, params.transferBank)
      : params.fundsDestination;
  const funds_destination = validateFundsDestination(params.paymentMethod, cashBook, destInput);

  const { data, error } = await supabaseAdmin
    .from('cash_transactions')
    .insert({
      cash_session_id: params.sessionId,
      cash_book: cashBook,
      type: 'income',
      concept: params.concept.trim(),
      income_type: params.incomeType,
      payment_method: params.paymentMethod,
      amount: params.amount,
      funds_destination,
      notes: params.notes?.trim() || null,
      created_by: params.createdBy,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapTransactionRow(data as Record<string, unknown>);
}

export async function addExpense(params: {
  sessionId: string;
  concept: string;
  category: ExpenseCategory;
  amount: number;
  paymentMethod: PaymentMethod;
  fundsDestination?: FundsDestination | null;
  transferBank?: TransferBankId | null;
  notes?: string | null;
  createdBy: string | null;
}): Promise<CashTransactionRow> {
  if (params.amount <= 0) throw new Error('El monto debe ser mayor a 0');
  const { data: sessionRaw } = await supabaseAdmin
    .from('cash_sessions')
    .select('status, cash_book')
    .eq('id', params.sessionId)
    .single();
  if (!sessionRaw || (sessionRaw as { status: string }).status !== 'open') {
    throw new Error('La caja está cerrada o no existe. No se pueden agregar movimientos.');
  }
  const cashBook = normalizeCashBookFromRow(sessionRaw as { cash_book?: string | null });
  const destInput =
    params.paymentMethod === 'transferencia' && params.transferBank
      ? fundsDestinationForTransferBank(cashBook, params.transferBank)
      : params.fundsDestination;
  const funds_destination = validateFundsDestination(params.paymentMethod, cashBook, destInput);

  const { data, error } = await supabaseAdmin
    .from('cash_transactions')
    .insert({
      cash_session_id: params.sessionId,
      cash_book: cashBook,
      type: 'expense',
      concept: params.concept.trim(),
      category: params.category,
      payment_method: params.paymentMethod,
      amount: params.amount,
      funds_destination,
      notes: params.notes?.trim() || null,
      created_by: params.createdBy,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapTransactionRow(data as Record<string, unknown>);
}

/** Transferencia entre libros Escuela ↔ DRA (no es ingreso ni egreso operativo; solo detalle y ajuste de balance). */
export async function addInternalTransfer(params: {
  date: string;
  fromBook: CashBook;
  toBook: CashBook;
  channel: InternalTransferChannel;
  amount: number;
  concept: string;
  /** Si channel es transferencia, banco de la cuenta usada (mismo criterio que ingresos/egresos). */
  transferBank?: TransferBankId | null;
  notes?: string | null;
  createdBy: string | null;
}): Promise<CashTransactionRow> {
  if (params.fromBook === params.toBook) throw new Error('El origen y el destino deben ser distintos');
  if (params.amount <= 0) throw new Error('El monto debe ser mayor a 0');
  const session = await getOpenSessionForDate(params.date, params.fromBook);
  if (!session) {
    throw new Error(`No hay caja abierta (${params.fromBook}) para la fecha indicada`);
  }
  let payment_method: PaymentMethod;
  let funds_destination: FundsDestination | null;
  if (params.channel === 'efectivo') {
    payment_method = 'efectivo';
    funds_destination = validateFundsDestination('efectivo', params.fromBook, DEST_BY_BOOK[params.fromBook].efectivo);
  } else if (params.channel === 'transferencia') {
    payment_method = 'transferencia';
    funds_destination = validateFundsDestination(
      'transferencia',
      params.fromBook,
      fundsDestinationForTransferBank(params.fromBook, params.transferBank ?? 'pichincha')
    );
  } else {
    /* deposito: sale efectivo del origen; se registra cuenta bancaria del libro destino */
    if (!params.transferBank) {
      throw new Error('Indique el banco donde se acreditó el depósito (libro destino)');
    }
    payment_method = 'transferencia';
    funds_destination = validateFundsDestination(
      'transferencia',
      params.toBook,
      fundsDestinationForTransferBank(params.toBook, params.transferBank)
    );
  }
  const persistedChannel: 'efectivo' | 'transferencia' = params.channel === 'efectivo' ? 'efectivo' : 'transferencia';
  const { data, error } = await supabaseAdmin
    .from('cash_transactions')
    .insert({
      cash_session_id: session.id,
      cash_book: params.fromBook,
      type: 'internal_transfer',
      concept: params.concept.trim(),
      category: null,
      income_type: null,
      payment_method,
      amount: params.amount,
      funds_destination,
      internal_from_book: params.fromBook,
      internal_to_book: params.toBook,
      internal_channel: persistedChannel,
      notes: params.notes?.trim() || null,
      created_by: params.createdBy,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapTransactionRow(data as Record<string, unknown>);
}

export async function listTransactionsBySession(sessionId: string): Promise<CashTransactionWithCreator[]> {
  const { data: rows, error } = await supabaseAdmin
    .from('cash_transactions')
    .select('*')
    .eq('cash_session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  const transactions = (rows || []).map((row) => mapTransactionRow(row as Record<string, unknown>));
  const creatorIds = [...new Set(transactions.map((t) => t.created_by).filter(Boolean))] as string[];
  let profiles: Map<string, string | null> = new Map();
  if (creatorIds.length > 0) {
    const { data: profilesData } = await supabaseAdmin
      .from('user_profiles')
      .select('id, full_name')
      .in('id', creatorIds);
    profilesData?.forEach((p: { id: string; full_name: string | null }) => {
      profiles.set(p.id, p.full_name?.trim() || null);
    });
  }
  return transactions.map((t) => ({
    ...t,
    created_by_name: t.created_by ? profiles.get(t.created_by) ?? null : null,
  }));
}

export async function listTransactions(params: {
  fromDate?: string;
  toDate?: string;
  type?: CashTransactionType;
  sessionId?: string;
  cashBook?: CashBook | 'all';
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ transactions: CashTransactionWithSession[]; total: number }> {
  let query = supabaseAdmin
    .from('cash_transactions')
    .select('*', { count: 'exact' });
  if (params.sessionId) {
    query = query.eq('cash_session_id', params.sessionId);
  }
  if (params.type) {
    query = query.eq('type', params.type);
  }
  if (params.fromDate || params.toDate) {
    const sessionsQuery = supabaseAdmin.from('cash_sessions').select('id, date, cash_book');
    if (params.fromDate) sessionsQuery.gte('date', params.fromDate);
    if (params.toDate) sessionsQuery.lte('date', params.toDate);
    if (params.cashBook && params.cashBook !== 'all') {
      sessionsQuery.eq('cash_book', params.cashBook);
    }
    const { data: sessions } = await sessionsQuery;
    const sessionIds = (sessions || []).map((s: { id: string }) => s.id);
    if (sessionIds.length === 0) return { transactions: [], total: 0 };
    query = query.in('cash_session_id', sessionIds);
  } else if (params.cashBook && params.cashBook !== 'all' && !params.sessionId) {
    query = query.eq('cash_book', params.cashBook);
  }
  if (params.search?.trim()) {
    query = query.or(`concept.ilike.%${params.search.trim()}%,notes.ilike.%${params.search.trim()}%`);
  }
  query = query.order('created_at', { ascending: false });
  const limit = Math.min(5000, params.limit ?? 100);
  const offset = params.offset ?? 0;
  query = query.range(offset, offset + limit - 1);
  const { data: rows, error, count } = await query;
  if (error) throw new Error(error.message);
  const transactions = (rows || []).map((row) => mapTransactionRow(row as Record<string, unknown>));
  const creatorIds = [...new Set(transactions.map((t) => t.created_by).filter(Boolean))] as string[];
  let profiles: Map<string, string | null> = new Map();
  if (creatorIds.length > 0) {
    const { data: profilesData } = await supabaseAdmin
      .from('user_profiles')
      .select('id, full_name')
      .in('id', creatorIds);
    profilesData?.forEach((p: { id: string; full_name: string | null }) => {
      profiles.set(p.id, p.full_name?.trim() || null);
    });
  }
  const sessionIds = [...new Set(transactions.map((t) => t.cash_session_id))];
  const sessionMap = new Map<string, { date: string; status: CashSessionStatus }>();
  if (sessionIds.length > 0) {
    const { data: sessions } = await supabaseAdmin
      .from('cash_sessions')
      .select('id, date, status')
      .in('id', sessionIds);
    (sessions || []).forEach((s: { id: string; date: string; status: string }) => {
      sessionMap.set(s.id, { date: s.date, status: s.status as CashSessionStatus });
    });
  }
  let withCreator = transactions.map((t) => {
    const sess = sessionMap.get(t.cash_session_id);
    return {
      ...t,
      created_by_name: t.created_by ? profiles.get(t.created_by) ?? null : null,
      session_date: sess?.date,
      session_status: sess?.status,
    };
  }) as CashTransactionWithSession[];

  if (
    params.cashBook === 'dra' &&
    (params.fromDate || params.toDate) &&
    !params.sessionId &&
    offset === 0 &&
    (!params.type || params.type === 'internal_transfer')
  ) {
    const fromD = params.fromDate || '1970-01-01';
    const toD = params.toDate || '2099-12-31';
    const extras = await fetchInternalTransfersAffectingBook(fromD, toD, 'dra');
    const existingIds = new Set(withCreator.map((x) => x.id));
    const need = extras.filter((t) => !existingIds.has(t.id) && !t.anulado_at);
    if (need.length > 0) {
      const cr = (await attachCreatorNames(need)) as (CashTransactionRow & { created_by_name?: string | null })[];
      const extraSessionIds = [...new Set(cr.map((t) => t.cash_session_id))];
      const { data: sessExtra } = await supabaseAdmin
        .from('cash_sessions')
        .select('id, date, status')
        .in('id', extraSessionIds);
      const sm = new Map(
        (sessExtra || []).map((s: { id: string; date: string; status: string }) => [
          s.id,
          { date: s.date, status: s.status as CashSessionStatus },
        ])
      );
      for (const t of cr) {
        const sess = sm.get(t.cash_session_id);
        withCreator.push({
          ...t,
          session_date: sess?.date,
          session_status: sess?.status,
        } as CashTransactionWithSession);
      }
      withCreator.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }

  return { transactions: withCreator, total: count ?? 0 };
}

export async function getSessionForClose(sessionId: string): Promise<{
  session: CashSessionWithDetails;
  totalIncome: number;
  totalExpense: number;
  balance: number;
} | null> {
  const { data: sessionRaw, error } = await supabaseAdmin
    .from('cash_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
  if (error || !sessionRaw) return null;
  const session = mapSessionRow(sessionRaw as Record<string, unknown>);
  if (session.status !== 'open') return null;
  const { totalIncome, totalExpense } = await getTotalsForSession(sessionId);
  const opening = Number((session as CashSessionRow).opening_amount);
  const balance = await computeBookClosing(sessionId);
  const { data: openedProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('full_name')
    .eq('id', session.opened_by)
    .single();
  return {
    session: {
      ...session,
      opened_by_name: getUserDisplayName(openedProfile as { full_name?: string | null } | null),
      closed_by_name: null,
      total_income: totalIncome,
      total_expense: totalExpense,
      transaction_count: 0,
    },
    totalIncome,
    totalExpense,
    balance,
  };
}

const SESSION_TX_AGG_CHUNK = 80;
const PROFILE_FETCH_CHUNK = 100;
/** computeBookClosing por sesión en paralelo, en tandas para no saturar el pool. */
const BOOK_CLOSING_PARALLEL = 8;

async function mapInChunks<T, R>(items: T[], chunkSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const part = await Promise.all(chunk.map(fn));
    out.push(...part);
  }
  return out;
}

/**
 * Agrega movimientos por sesión en pocas consultas (antes: 2N queries).
 * Alineado con getTotalsForSession (sin anulados; internas no suman a ingreso/egreso).
 */
async function fetchTransactionAggregatesForSessions(
  sessionIds: string[]
): Promise<Map<string, { totalIncome: number; totalExpense: number; count: number }>> {
  const map = new Map<string, { totalIncome: number; totalExpense: number; count: number }>();
  if (sessionIds.length === 0) return map;
  for (let i = 0; i < sessionIds.length; i += SESSION_TX_AGG_CHUNK) {
    const chunk = sessionIds.slice(i, i + SESSION_TX_AGG_CHUNK);
    const { data, error } = await supabaseAdmin
      .from('cash_transactions')
      .select('cash_session_id, type, amount')
      .in('cash_session_id', chunk)
      .is('anulado_at', null);
    if (error) throw new Error(error.message);
    for (const row of data || []) {
      const sid = String((row as { cash_session_id: string }).cash_session_id);
      let cur = map.get(sid);
      if (!cur) {
        cur = { totalIncome: 0, totalExpense: 0, count: 0 };
        map.set(sid, cur);
      }
      cur.count += 1;
      const type = String((row as { type: string }).type);
      if (type === 'internal_transfer') continue;
      const a = Number((row as { amount: number }).amount);
      if (type === 'income') cur.totalIncome += a;
      else if (type === 'expense') cur.totalExpense += a;
    }
  }
  return map;
}

async function fetchProfilesByUserIds(userIds: string[]): Promise<Map<string, { full_name: string | null }>> {
  const map = new Map<string, { full_name: string | null }>();
  const unique = [...new Set(userIds.filter(Boolean))];
  for (let i = 0; i < unique.length; i += PROFILE_FETCH_CHUNK) {
    const chunk = unique.slice(i, i + PROFILE_FETCH_CHUNK);
    const { data, error } = await supabaseAdmin.from('user_profiles').select('id, full_name').in('id', chunk);
    if (error) throw new Error(error.message);
    for (const p of data || []) {
      const row = p as { id: string; full_name: string | null };
      map.set(row.id, { full_name: row.full_name ?? null });
    }
  }
  return map;
}

async function enrichSessionsWithTotalsAndProfiles(sessions: CashSessionRow[]): Promise<CashSessionWithDetails[]> {
  if (sessions.length === 0) return [];
  const ids = sessions.map((s) => s.id);
  const userIds = [...new Set(sessions.flatMap((s) => [s.opened_by, s.closed_by].filter(Boolean) as string[]))];
  const [agg, profiles] = await Promise.all([
    fetchTransactionAggregatesForSessions(ids),
    fetchProfilesByUserIds(userIds),
  ]);
  return sessions.map((s) => {
    const a = agg.get(s.id);
    return {
      ...s,
      opened_by_name: getUserDisplayName(profiles.get(s.opened_by) ?? null),
      closed_by_name: s.closed_by ? getUserDisplayName(profiles.get(s.closed_by) ?? null) : null,
      total_income: a?.totalIncome ?? 0,
      total_expense: a?.totalExpense ?? 0,
      transaction_count: a?.count ?? 0,
    };
  });
}

export async function listSessions(params: {
  fromDate?: string;
  toDate?: string;
  status?: CashSessionStatus;
  cashBook?: CashBook | 'all';
  limit?: number;
  offset?: number;
}): Promise<{ sessions: CashSessionWithDetails[]; total: number }> {
  let query = supabaseAdmin
    .from('cash_sessions')
    .select('*', { count: 'exact' })
    .order('date', { ascending: false });
  if (params.fromDate) query = query.gte('date', params.fromDate);
  if (params.toDate) query = query.lte('date', params.toDate);
  if (params.status) query = query.eq('status', params.status);
  if (params.cashBook && params.cashBook !== 'all') query = query.eq('cash_book', params.cashBook);
  const limit = Math.min(200, params.limit ?? 50);
  const offset = params.offset ?? 0;
  query = query.range(offset, offset + limit - 1);
  const { data: rows, error, count } = await query;
  if (error) throw new Error(error.message);
  const sessions = (rows || []).map((row) => mapSessionRow(row as Record<string, unknown>));
  const withDetails = await enrichSessionsWithTotalsAndProfiles(sessions);
  return { sessions: withDetails, total: count ?? 0 };
}

export async function getReportByPeriod(
  startDate: string,
  endDate: string,
  cashBook: CashBook = 'escuela'
): Promise<CashReportPeriod> {
  const { sessions } = await listSessions({ fromDate: startDate, toDate: endDate, limit: 500, cashBook });
  let totalIncome = 0;
  let totalExpense = 0;
  let transactionCount = 0;
  const balances = await mapInChunks(sessions, BOOK_CLOSING_PARALLEL, (s) => computeBookClosing(s.id));
  const byDay: CashReportPeriod['sessions'] = [];
  sessions.forEach((s, idx) => {
    const ti = Number(s.total_income ?? 0);
    const te = Number(s.total_expense ?? 0);
    const cnt = s.transaction_count ?? 0;
    totalIncome += ti;
    totalExpense += te;
    transactionCount += cnt;
    byDay.push({
      date: s.date,
      totalIncome: ti,
      totalExpense: te,
      balance: balances[idx],
      count: cnt,
    });
  });
  return {
    startDate,
    endDate,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    transactionCount,
    sessions: byDay.sort((a, b) => b.date.localeCompare(a.date)),
  };
}

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const INCOME_TYPE_LABELS: Record<string, string> = {
  pago_matricula: 'Pago de matrícula',
  pago_curso: 'Pago de curso',
  pago_examen: 'Pago de examen',
  pago_clases_adicionales: 'Pago de clases adicionales',
  otros: 'Otros',
};
export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  sueldos: 'Sueldos',
  combustible: 'Combustible',
  materiales: 'Materiales',
  publicidad: 'Publicidad',
  mantenimiento: 'Mantenimiento',
  otros: 'Otros',
};
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
};

function categoryLabel(t: CashTransactionWithCreator): string {
  if (t.type === 'internal_transfer') {
    const from = t.internal_from_book === 'escuela' ? 'Escuela' : 'DRA';
    const to = t.internal_to_book === 'escuela' ? 'Escuela' : 'DRA';
    if (isDepositInternal(t)) {
      return `Depósito interno (${from} → ${to}: efectivo origen → cuenta bancaria destino)`;
    }
    const ch = t.internal_channel === 'efectivo' ? 'efectivo' : 'transferencia';
    return `Transferencia interna (${from} → ${to}, ${ch})`;
  }
  if (t.type === 'income') return t.income_type ? (INCOME_TYPE_LABELS[t.income_type] ?? t.income_type) : 'Otros';
  return t.category ? (EXPENSE_CATEGORY_LABELS[t.category] ?? t.category) : 'Otros';
}

function fundsDestDisplay(t: CashTransactionWithCreator): string {
  if (!t.funds_destination) return '—';
  return FUNDS_DESTINATION_LABELS[t.funds_destination as FundsDestination] ?? String(t.funds_destination);
}

function internalTransferExportTypeLabel(t: CashTransactionWithCreator): string {
  if (isDepositInternal(t)) return 'Depósito interno';
  return 'Transf. interna';
}

function internalTransferPaymentExportLabel(t: CashTransactionWithCreator): string {
  if (isDepositInternal(t)) return 'Depósito (efectivo → banco destino)';
  return PAYMENT_METHOD_LABELS[t.payment_method] ?? t.payment_method;
}

function bookExportTitle(book: CashBook): string {
  return book === 'dra' ? 'Caja DRA' : 'Caja Escuela';
}

function balanceExportDescription(book: CashBook): string {
  return book === 'dra'
    ? 'Balance (efectivo + transferencias, según libro DRA)'
    : 'Balance de caja en efectivo (transferencias internas detalladas aparte)';
}

/** Obtiene todos los datos necesarios para exportar reporte (transacciones + resúmenes). Excluye anulados. */
export async function getReportDataForExport(
  startDate: string,
  endDate: string,
  cashBook: CashBook = 'escuela'
): Promise<CashReportExportData> {
  const { transactions } = await listTransactions({
    fromDate: startDate,
    toDate: endDate,
    cashBook,
    limit: 5000,
    offset: 0,
  });
  const active = transactions.filter((t) => !t.anulado_at);
  const operational = active.filter((t) => t.type === 'income' || t.type === 'expense');
  const internalRaw = await fetchInternalTransfersAffectingBook(startDate, endDate, cashBook);
  const internalActive = internalRaw.filter((t) => !t.anulado_at);
  const internalWithNames = await attachCreatorNames(internalActive);
  const internalTransfers = [...internalWithNames].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  ) as CashTransactionWithCreator[];
  const sorted = [...operational].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  let totalIncome = 0;
  let totalExpense = 0;
  let countIncome = 0;
  let countExpense = 0;
  const categoryMap = new Map<string, { total: number; count: number }>();
  const methodMap = new Map<string, { total: number; count: number }>();
  const byPaymentNet = { efectivo: 0, transferencia: 0, tarjeta: 0 };
  for (const t of sorted) {
    const amount = Number(t.amount);
    const cat = categoryLabel(t);
    const method = PAYMENT_METHOD_LABELS[t.payment_method] ?? t.payment_method;
    const methodKey =
      t.payment_method === 'efectivo' ? 'efectivo' : t.payment_method === 'transferencia' ? 'transferencia' : 'tarjeta';
    if (t.type === 'income') {
      totalIncome += amount;
      countIncome += 1;
      byPaymentNet[methodKey] += amount;
    } else {
      totalExpense += amount;
      countExpense += 1;
      byPaymentNet[methodKey] -= amount;
    }
    const curCat = categoryMap.get(cat) ?? { total: 0, count: 0 };
    curCat.total += amount;
    curCat.count += 1;
    categoryMap.set(cat, curCat);
    const curMethod = methodMap.get(method) ?? { total: 0, count: 0 };
    curMethod.total += t.type === 'income' ? amount : -amount;
    curMethod.count += 1;
    methodMap.set(method, curMethod);
  }
  const byCategory = Array.from(categoryMap.entries()).map(([label, v]) => ({ label, total: v.total, count: v.count }));
  const byPaymentMethod = Array.from(methodMap.entries()).map(([method, v]) => ({ method, total: v.total, count: v.count }));

  const balance =
    cashBook === 'dra' ? byPaymentNet.efectivo + byPaymentNet.transferencia : byPaymentNet.efectivo;

  return {
    cashBook,
    bookTitle: bookExportTitle(cashBook),
    startDate,
    endDate,
    totalIncome,
    totalExpense,
    balance,
    balanceDescription: balanceExportDescription(cashBook),
    totalEfectivo: byPaymentNet.efectivo,
    totalTransferencia: byPaymentNet.transferencia,
    totalTarjeta: cashBook === 'dra' ? 0 : byPaymentNet.tarjeta,
    transactionCount: sorted.length + internalTransfers.length,
    countIncome,
    countExpense,
    byCategory: byCategory.sort((a, b) => b.total - a.total),
    byPaymentMethod: byPaymentMethod.sort((a, b) => b.total - a.total),
    transactions: sorted,
    internalTransfers,
  };
}

export async function getReportDataForExportCombined(
  startDate: string,
  endDate: string
): Promise<CashReportCombinedExportData> {
  const [escuela, dra] = await Promise.all([
    getReportDataForExport(startDate, endDate, 'escuela'),
    getReportDataForExport(startDate, endDate, 'dra'),
  ]);
  const raw = await fetchInternalTransfersInPeriod(startDate, endDate);
  const active = raw.filter((t) => !t.anulado_at);
  const uniq = [...new Map(active.map((t) => [t.id, t])).values()];
  const named = await attachCreatorNames(uniq);
  const allInternalTransfers = [...named].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  ) as CashTransactionWithCreator[];
  return { startDate, endDate, escuela, dra, allInternalTransfers };
}

/** Resumen JSON para pantalla (ambas cajas). */
export async function getReportCombinedSummary(
  startDate: string,
  endDate: string
): Promise<{ startDate: string; endDate: string; escuela: CashReportPeriod; dra: CashReportPeriod }> {
  const [escuela, dra] = await Promise.all([
    getReportByPeriod(startDate, endDate, 'escuela'),
    getReportByPeriod(startDate, endDate, 'dra'),
  ]);
  return { startDate, endDate, escuela, dra };
}

/** Estadísticas agregadas por mes (últimos N meses) */
export async function getMonthlyStats(monthsCount: number = 12, cashBook: CashBook = 'escuela'): Promise<MonthlyStat[]> {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - monthsCount + 1, 1);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  const { sessions } = await listSessions({ fromDate: startStr, toDate: endStr, limit: 500, cashBook });
  const byMonth = new Map<string, { totalIncome: number; totalExpense: number; sessionCount: number; transactionCount: number }>();
  for (const s of sessions) {
    const ti = Number(s.total_income ?? 0);
    const te = Number(s.total_expense ?? 0);
    const [y, m] = s.date.split('-').map(Number);
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const cur = byMonth.get(key) ?? { totalIncome: 0, totalExpense: 0, sessionCount: 0, transactionCount: 0 };
    cur.totalIncome += ti;
    cur.totalExpense += te;
    cur.sessionCount += 1;
    cur.transactionCount += s.transaction_count ?? 0;
    byMonth.set(key, cur);
  }
  const result: MonthlyStat[] = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const cur = byMonth.get(key) ?? { totalIncome: 0, totalExpense: 0, sessionCount: 0, transactionCount: 0 };
    result.push({
      year: y,
      month: m,
      monthLabel: `${MONTH_LABELS[m - 1]} ${y}`,
      totalIncome: cur.totalIncome,
      totalExpense: cur.totalExpense,
      balance: cur.totalIncome - cur.totalExpense,
      sessionCount: cur.sessionCount,
      transactionCount: cur.transactionCount,
    });
  }
  return result;
}

/** Alertas de caja: balance negativo, caja de ayer no cerrada, etc. (ambos libros). */
export async function getCashAlerts(): Promise<CashAlert[]> {
  const alerts: CashAlert[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const thirtyOneDaysAgo = new Date(Date.now() - 31 * 864e5).toISOString().slice(0, 10);
  const books: CashBook[] = ['escuela', 'dra'];

  const [sTodayEsc, sTodayDra, sYesEsc, sYesDra] = await Promise.all([
    getSessionByDate(today, 'escuela'),
    getSessionByDate(today, 'dra'),
    getSessionByDate(yesterday, 'escuela'),
    getSessionByDate(yesterday, 'dra'),
  ]);
  const todayByBook: Record<CashBook, Awaited<ReturnType<typeof getSessionByDate>>> = {
    escuela: sTodayEsc,
    dra: sTodayDra,
  };
  const yestByBook: Record<CashBook, Awaited<ReturnType<typeof getSessionByDate>>> = {
    escuela: sYesEsc,
    dra: sYesDra,
  };

  const balanceChecks: Promise<void>[] = [];
  for (const book of books) {
    const todaySession = todayByBook[book];
    if (!todaySession) {
      alerts.push({
        type: 'no_caja_today',
        severity: 'info',
        message: `No hay caja abierta (${book}) para hoy.`,
      });
    } else if (todaySession.status === 'open') {
      const sid = todaySession.id;
      balanceChecks.push(
        (async () => {
          const balance = await computeBookClosing(sid);
          if (balance < 0) {
            alerts.push({
              type: 'negative_balance',
              severity: 'error',
              message: `La caja ${book} de hoy tiene balance negativo.`,
              date: today,
              sessionId: sid,
            });
          }
        })()
      );
    }

    const yesterdaySession = yestByBook[book];
    if (yesterdaySession && yesterdaySession.status === 'open') {
      alerts.push({
        type: 'yesterday_not_closed',
        severity: 'warning',
        message: `La caja ${book} del ${yesterday} no fue cerrada.`,
        date: yesterday,
        sessionId: yesterdaySession.id,
      });
    }
  }

  await Promise.all(balanceChecks);

  const { data: negClosed, error: negErr } = await supabaseAdmin
    .from('cash_sessions')
    .select('id, date, cash_book, closing_amount')
    .eq('status', 'closed')
    .gte('date', thirtyOneDaysAgo)
    .lte('date', today)
    .lt('closing_amount', 0)
    .limit(100);
  if (!negErr && negClosed) {
    for (const row of negClosed) {
      const s = row as { id: string; date: string; cash_book: string };
      alerts.push({
        type: 'session_negative_balance',
        severity: 'warning',
        message: `Sesión ${s.cash_book} del ${s.date} cerró con balance negativo.`,
        date: s.date,
        sessionId: s.id,
      });
    }
  }

  return alerts;
}

/** Dashboard financiero: resumen del día, últimos 7 días, estadísticas mensuales y alertas */
export async function getFinancialDashboard(view: CashBook | 'all' = 'escuela'): Promise<FinancialDashboard> {
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);

  if (view === 'all') {
    const [alerts, summary, summaryDra, report, reportDra, monthlyStats, monthlyStatsDra] = await Promise.all([
      getCashAlerts(),
      getTodaySummary('escuela'),
      getTodaySummary('dra'),
      getReportByPeriod(sevenDaysAgo, today, 'escuela'),
      getReportByPeriod(sevenDaysAgo, today, 'dra'),
      getMonthlyStats(12, 'escuela'),
      getMonthlyStats(12, 'dra'),
    ]);
    return {
      view: 'all',
      summary,
      summaryDra,
      last7Days: report.sessions,
      last7DaysDra: reportDra.sessions,
      monthlyStats,
      monthlyStatsDra,
      alerts,
    };
  }

  const [alerts, summary, report, monthlyStats] = await Promise.all([
    getCashAlerts(),
    getTodaySummary(view),
    getReportByPeriod(sevenDaysAgo, today, view),
    getMonthlyStats(12, view),
  ]);
  return {
    view,
    summary,
    summaryDra: null,
    last7Days: report.sessions,
    monthlyStats,
    alerts,
  };
}

export async function deleteTransaction(transactionId: string, sessionId: string): Promise<void> {
  const { data: session } = await supabaseAdmin
    .from('cash_sessions')
    .select('status')
    .eq('id', sessionId)
    .single();
  if (!session || (session as { status: string }).status !== 'open') {
    throw new Error('No se puede eliminar un movimiento de una caja cerrada');
  }
  const { error } = await supabaseAdmin
    .from('cash_transactions')
    .delete()
    .eq('id', transactionId)
    .eq('cash_session_id', sessionId);
  if (error) throw new Error(error.message);
}

const CASH_ADMIN_CODE = process.env.CASH_ADMIN_CODE || '3651';

/** Valida el código de administrador para editar/anular cajas cerradas o de otros días. */
export function verifyCashAdminCode(code: string): boolean {
  return String(code).trim() === CASH_ADMIN_CODE;
}

/** Indica si la sesión permite editar/anular sin código (caja abierta del día actual). */
export function canEditWithoutCode(sessionDate: string, sessionStatus: CashSessionStatus): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return sessionStatus === 'open' && sessionDate === today;
}

/** Obtiene una transacción con su sesión (para validar antes de editar/anular). */
export async function getTransactionWithSession(
  transactionId: string
): Promise<{ transaction: CashTransactionRow; session: CashSessionRow } | null> {
  const { data: tx, error: txErr } = await supabaseAdmin
    .from('cash_transactions')
    .select('*')
    .eq('id', transactionId)
    .single();
  if (txErr || !tx) return null;
  const transaction = mapTransactionRow(tx as Record<string, unknown>);
  const { data: sessionRaw, error: sessErr } = await supabaseAdmin
    .from('cash_sessions')
    .select('*')
    .eq('id', transaction.cash_session_id)
    .single();
  if (sessErr || !sessionRaw) return null;
  return { transaction, session: mapSessionRow(sessionRaw as Record<string, unknown>) };
}

/** Registra un evento en la auditoría de caja. */
async function insertCashAudit(params: {
  transactionId: string;
  cashSessionId: string;
  action: 'edit' | 'anulate' | 'reopen';
  dataBefore: Record<string, unknown>;
  dataAfter: Record<string, unknown>;
  userId: string;
  reason: string | null;
  adminCodeUsed: boolean;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('cash_audit').insert({
    transaction_id: params.transactionId,
    cash_session_id: params.cashSessionId,
    action: params.action,
    data_before: params.dataBefore,
    data_after: params.dataAfter,
    user_id: params.userId,
    reason: params.reason || null,
    admin_code_used: params.adminCodeUsed,
  });
  if (error) throw new Error(error.message);
}

/** Actualiza un movimiento. Si la sesión está cerrada o es de otro día, requiere adminCode y reason. */
export async function updateTransaction(
  transactionId: string,
  payload: {
    concept?: string;
    category?: string | null;
    income_type?: string | null;
    amount?: number;
    payment_method?: PaymentMethod;
    funds_destination?: FundsDestination | null;
    notes?: string | null;
  },
  userId: string,
  options?: { adminCode?: string; reason?: string }
): Promise<CashTransactionRow> {
  const pair = await getTransactionWithSession(transactionId);
  if (!pair) throw new Error('Movimiento no encontrado');
  const { transaction, session } = pair;
  if (transaction.anulado_at) throw new Error('No se puede editar un movimiento anulado');

  const allowedWithoutCode = canEditWithoutCode(session.date, session.status);
  if (!allowedWithoutCode) {
    if (!options?.adminCode?.trim() || !options?.reason?.trim()) {
      throw new Error('Para modificar una caja cerrada o de otro día se requiere código de administrador y motivo');
    }
    if (!verifyCashAdminCode(options.adminCode.trim())) {
      throw new Error('Código de administrador incorrecto');
    }
  }

  if (transaction.type === 'internal_transfer') {
    throw new Error('Las transferencias internas no se editan desde este flujo; anule y registre de nuevo si aplica.');
  }

  const dataBefore = {
    concept: transaction.concept,
    category: transaction.category,
    income_type: transaction.income_type,
    amount: transaction.amount,
    payment_method: transaction.payment_method,
    funds_destination: transaction.funds_destination,
    notes: transaction.notes,
  };
  const updates: Record<string, unknown> = {};
  if (payload.concept !== undefined) updates.concept = payload.concept;
  if (payload.category !== undefined) updates.category = payload.category;
  if (payload.income_type !== undefined) updates.income_type = payload.income_type;
  if (payload.amount !== undefined) {
    if (payload.amount <= 0) throw new Error('El monto debe ser mayor a 0');
    updates.amount = payload.amount;
  }
  if (payload.payment_method !== undefined) {
    updates.payment_method = payload.payment_method;
    const dest = validateFundsDestination(
      payload.payment_method,
      session.cash_book,
      payload.funds_destination !== undefined ? payload.funds_destination : transaction.funds_destination
    );
    updates.funds_destination = dest;
  } else if (payload.funds_destination !== undefined) {
    const pm = transaction.payment_method;
    updates.funds_destination = validateFundsDestination(pm, session.cash_book, payload.funds_destination);
  }
  if (payload.notes !== undefined) updates.notes = payload.notes;

  if (Object.keys(updates).length === 0) return transaction;

  const { data: updated, error } = await supabaseAdmin
    .from('cash_transactions')
    .update(updates)
    .eq('id', transactionId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  await insertCashAudit({
    transactionId,
    cashSessionId: session.id,
    action: 'edit',
    dataBefore,
    dataAfter: { ...dataBefore, ...updates },
    userId,
    reason: options?.reason?.trim() || null,
    adminCodeUsed: !allowedWithoutCode,
  });

  return mapTransactionRow(updated as Record<string, unknown>);
}

/** Anula un movimiento (soft delete). Si la sesión está cerrada o es de otro día, requiere adminCode y reason. */
export async function anulateTransaction(
  transactionId: string,
  userId: string,
  options?: { adminCode?: string; reason?: string }
): Promise<CashTransactionRow> {
  const pair = await getTransactionWithSession(transactionId);
  if (!pair) throw new Error('Movimiento no encontrado');
  const { transaction, session } = pair;
  if (transaction.anulado_at) throw new Error('El movimiento ya está anulado');

  const allowedWithoutCode = canEditWithoutCode(session.date, session.status);
  const reason = options?.reason?.trim();
  if (!allowedWithoutCode) {
    if (!options?.adminCode?.trim()) {
      throw new Error('Para anular un movimiento de caja cerrada o de otro día se requiere código de administrador');
    }
    if (!reason) throw new Error('Se debe indicar el motivo de la anulación');
    if (!verifyCashAdminCode(options.adminCode.trim())) {
      throw new Error('Código de administrador incorrecto');
    }
  }

  const dataBefore = {
    concept: transaction.concept,
    type: transaction.type,
    amount: transaction.amount,
    anulado_at: transaction.anulado_at,
  };
  const { data: updated, error } = await supabaseAdmin
    .from('cash_transactions')
    .update({
      anulado_at: new Date().toISOString(),
      anulado_por: userId,
      anulado_reason: reason || 'Anulación desde caja abierta',
    })
    .eq('id', transactionId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  await insertCashAudit({
    transactionId,
    cashSessionId: session.id,
    action: 'anulate',
    dataBefore,
    dataAfter: { anulado_at: (updated as CashTransactionRow).anulado_at },
    userId,
    reason: reason || null,
    adminCodeUsed: !allowedWithoutCode,
  });

  return mapTransactionRow(updated as Record<string, unknown>);
}

/** Genera un buffer Excel del reporte de caja para el período dado */
export async function buildCashReportExcel(startDate: string, endDate: string, cashBook: CashBook = 'escuela'): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const report = await getReportByPeriod(startDate, endDate, cashBook);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Reporte Caja', { views: [{ state: 'frozen', ySplit: 2 }] });
  sheet.columns = [
    { header: 'Fecha', key: 'date', width: 14 },
    { header: 'Total ingresos', key: 'totalIncome', width: 16 },
    { header: 'Total egresos', key: 'totalExpense', width: 16 },
    { header: 'Balance', key: 'balance', width: 14 },
    { header: 'Movimientos', key: 'count', width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow([]);
  report.sessions.forEach((s) => {
    sheet.addRow({
      date: s.date,
      totalIncome: s.totalIncome,
      totalExpense: s.totalExpense,
      balance: s.balance,
      count: s.count,
    });
  });
  sheet.addRow([]);
  sheet.addRow(['Resumen del período', report.totalIncome, report.totalExpense, report.balance, report.transactionCount]);
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

const SCHOOL_NAME = 'Colorados Drive';
const REPORT_GENERATED = 'Generado el';

function formatDateForExport(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-EC', { timeZone: 'America/Guayaquil', dateStyle: 'short', timeStyle: 'medium' });
}

/** Clasifica el tipo de reporte según la etiqueta enviada desde el front (Diario / Semanal / Mensual). */
type ReportCadence = 'diario' | 'semanal' | 'mensual';

function reportCadenceFromLabel(reportType: string): ReportCadence {
  const t = (reportType || '').trim().toLowerCase();
  if (t.includes('semanal')) return 'semanal';
  if (t.includes('mensual')) return 'mensual';
  return 'diario';
}

/** Fecha calendario (YYYY-MM-DD) en zona Guayaquil, para agrupar movimientos por día. */
function ymdInGuayaquil(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
}

function addDaysYmdUtc(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function enumerateDatesInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard++ < 400) {
    out.push(cur);
    cur = addDaysYmdUtc(cur, 1);
  }
  return out;
}

interface DayOperationalAgg {
  date: string;
  totalIncome: number;
  totalExpense: number;
  net: number;
  count: number;
}

/** Ingresos/egresos operativos por día (excluye internas). Opcionalmente rellena días sin movimientos en el rango. */
function aggregateOperationalByDay(
  transactions: CashTransactionWithCreator[],
  startDate: string,
  endDate: string,
  fillAllDaysInRange: boolean
): DayOperationalAgg[] {
  const map = new Map<string, { income: number; expense: number; count: number }>();
  for (const t of transactions) {
    if (t.type !== 'income' && t.type !== 'expense') continue;
    const dk = ymdInGuayaquil(t.created_at);
    if (dk < startDate || dk > endDate) continue;
    const cur = map.get(dk) ?? { income: 0, expense: 0, count: 0 };
    const amt = Number(t.amount);
    if (t.type === 'income') cur.income += amt;
    else cur.expense += amt;
    cur.count += 1;
    map.set(dk, cur);
  }
  const dates = fillAllDaysInRange
    ? enumerateDatesInclusive(startDate, endDate)
    : [...map.keys()].sort((a, b) => a.localeCompare(b));
  return dates.map((date) => {
    const c = map.get(date) ?? { income: 0, expense: 0, count: 0 };
    return {
      date,
      totalIncome: c.income,
      totalExpense: c.expense,
      net: c.income - c.expense,
      count: c.count,
    };
  });
}

/** Lunes de la semana ISO civil (YYYY-MM-DD en UTC date math). */
function mondayKeyFromYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const utcMid = Date.UTC(y, m - 1, d);
  const dow = new Date(utcMid).getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(utcMid + diff * 86400000);
  return `${mon.getUTCFullYear()}-${String(mon.getUTCMonth() + 1).padStart(2, '0')}-${String(mon.getUTCDate()).padStart(2, '0')}`;
}

function formatYmdEs(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('es-EC', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface WeekCombinedAgg {
  weekStart: string;
  weekEnd: string;
  label: string;
  escuelaIncome: number;
  escuelaExpense: number;
  draIncome: number;
  draExpense: number;
  count: number;
}

interface CombinedDailyRow {
  date: string;
  escuelaIncome: number;
  escuelaExpense: number;
  draIncome: number;
  draExpense: number;
  count: number;
}

/** Tabla diaria Escuela + DRA alineada por fecha (rellena días sin movimientos si fillDays). */
function buildCombinedDailyTable(data: CashReportCombinedExportData, fillDays: boolean): CombinedDailyRow[] {
  const e = aggregateOperationalByDay(data.escuela.transactions, data.startDate, data.endDate, fillDays);
  const d = aggregateOperationalByDay(data.dra.transactions, data.startDate, data.endDate, fillDays);
  const mapE = new Map(e.map((r) => [r.date, r]));
  const mapD = new Map(d.map((r) => [r.date, r]));
  const dates = fillDays
    ? enumerateDatesInclusive(data.startDate, data.endDate)
    : [...new Set([...mapE.keys(), ...mapD.keys()])].sort((a, b) => a.localeCompare(b));
  return dates.map((date) => {
    const er = mapE.get(date);
    const dr = mapD.get(date);
    return {
      date,
      escuelaIncome: er?.totalIncome ?? 0,
      escuelaExpense: er?.totalExpense ?? 0,
      draIncome: dr?.totalIncome ?? 0,
      draExpense: dr?.totalExpense ?? 0,
      count: (er?.count ?? 0) + (dr?.count ?? 0),
    };
  });
}

function rollupCombinedDailyToWeeks(daily: CombinedDailyRow[]): WeekCombinedAgg[] {
  const weekMap = new Map<
    string,
    {
      minD: string;
      maxD: string;
      escuelaIncome: number;
      escuelaExpense: number;
      draIncome: number;
      draExpense: number;
      count: number;
    }
  >();
  for (const row of daily) {
    const wk = mondayKeyFromYmd(row.date);
    const cur = weekMap.get(wk) ?? {
      minD: row.date,
      maxD: row.date,
      escuelaIncome: 0,
      escuelaExpense: 0,
      draIncome: 0,
      draExpense: 0,
      count: 0,
    };
    if (row.date < cur.minD) cur.minD = row.date;
    if (row.date > cur.maxD) cur.maxD = row.date;
    cur.escuelaIncome += row.escuelaIncome;
    cur.escuelaExpense += row.escuelaExpense;
    cur.draIncome += row.draIncome;
    cur.draExpense += row.draExpense;
    cur.count += row.count;
    weekMap.set(wk, cur);
  }
  return [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({
      weekStart: mondayKeyFromYmd(v.minD),
      weekEnd: v.maxD,
      label: `${formatYmdEs(v.minD)} — ${formatYmdEs(v.maxD)}`,
      escuelaIncome: v.escuelaIncome,
      escuelaExpense: v.escuelaExpense,
      draIncome: v.draIncome,
      draExpense: v.draExpense,
      count: v.count,
    }));
}

/** Una sola caja: agregado semanal a partir de filas diarias. */
function rollupSingleBookDailyToWeeks(daily: DayOperationalAgg[]): {
  label: string;
  totalIncome: number;
  totalExpense: number;
  net: number;
  count: number;
}[] {
  const weekMap = new Map<
    string,
    { minD: string; maxD: string; income: number; expense: number; count: number }
  >();
  for (const row of daily) {
    const wk = mondayKeyFromYmd(row.date);
    const cur = weekMap.get(wk) ?? {
      minD: row.date,
      maxD: row.date,
      income: 0,
      expense: 0,
      count: 0,
    };
    if (row.date < cur.minD) cur.minD = row.date;
    if (row.date > cur.maxD) cur.maxD = row.date;
    cur.income += row.totalIncome;
    cur.expense += row.totalExpense;
    cur.count += row.count;
    weekMap.set(wk, cur);
  }
  return [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({
      label: `${formatYmdEs(v.minD)} — ${formatYmdEs(v.maxD)}`,
      totalIncome: v.income,
      totalExpense: v.expense,
      net: v.income - v.expense,
      count: v.count,
    }));
}

const moneyFmtExcel = '"$"#,##0.00';

/** Excel detallado multi-hoja para reporte de caja */
export async function buildCashReportExcelFull(
  data: CashReportExportData,
  reportType: string,
  generatedAt: string,
  generatedBy: string
): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = SCHOOL_NAME;

  const greenFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD1FAE5' } };
  const redFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFEE2E2' } };

  // ─── Hoja 1: Resumen ─────────────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet('Resumen', { views: [{ state: 'frozen', ySplit: 1 }] });
  summarySheet.columns = [{ key: 'k', width: 28 }, { key: 'v', width: 24 }];

  summarySheet.addRow(['REPORTE DE CAJA', '']).font = { bold: true, size: 14 };
  summarySheet.addRow(['Escuela', SCHOOL_NAME]);
  summarySheet.addRow(['Módulo', 'Caja']);
  summarySheet.addRow(['Libro', data.bookTitle]);
  summarySheet.addRow(['Tipo de reporte', reportType]);
  summarySheet.addRow(['Rango de fechas', `${data.startDate} - ${data.endDate}`]);
  summarySheet.addRow(['Fecha y hora de generación', generatedAt]);
  summarySheet.addRow(['Usuario que generó el reporte', generatedBy]);
  summarySheet.addRow([]);

  const resumenEjecutivoRow = summarySheet.addRow(['RESUMEN EJECUTIVO', '']);
  resumenEjecutivoRow.font = { bold: true };

  const totalMovRow = summarySheet.addRow(['Total movimientos', data.transactionCount]);
  const totalIngresosRow = summarySheet.addRow(['Total ingresos', data.totalIncome]);
  const totalEgresosRow = summarySheet.addRow(['Total egresos', data.totalExpense]);

  const totalEfectivoRow = summarySheet.addRow(['TOTAL EN EFECTIVO', data.totalEfectivo ?? 0]);
  const totalTransferenciasRow = summarySheet.addRow(['TOTAL TRANSFERENCIAS', data.totalTransferencia ?? 0]);
  const totalTarjetaRow = summarySheet.addRow(['TOTAL TARJETA', data.totalTarjeta ?? 0]);

  const balanceRow = summarySheet.addRow([data.balanceDescription, data.balance]);

  summarySheet.getRow(1).font = { bold: true, size: 14 };

  totalMovRow.getCell(2).numFmt = '#,##0';
  [totalIngresosRow, totalEgresosRow, totalEfectivoRow, totalTransferenciasRow, totalTarjetaRow, balanceRow].forEach((r) => {
    r.getCell(2).numFmt = '"$"#,##0.00';
  });

  const balanceCell = balanceRow.getCell(2);
  balanceCell.font = { bold: true, size: 12 };
  balanceCell.fill = data.balance >= 0 ? greenFill : redFill;
  balanceRow.height = 24;

  const cadenceFull = reportCadenceFromLabel(reportType);
  if (cadenceFull === 'semanal') {
    const daily = aggregateOperationalByDay(data.transactions, data.startDate, data.endDate, true);
    const corte = workbook.addWorksheet('Por día (totales)', { views: [{ state: 'frozen', ySplit: 1 }] });
    corte.addRow(['Fecha', 'Ingresos', 'Egresos', 'Neto del día', 'Movimientos']);
    corte.getRow(1).font = { bold: true };
    let si = 0,
      se = 0,
      sc = 0;
    for (const r of daily) {
      const row = corte.addRow([r.date, r.totalIncome, r.totalExpense, r.net, r.count]);
      row.getCell(2).numFmt = moneyFmtExcel;
      row.getCell(3).numFmt = moneyFmtExcel;
      row.getCell(4).numFmt = moneyFmtExcel;
      si += r.totalIncome;
      se += r.totalExpense;
      sc += r.count;
    }
    const trow = corte.addRow(['TOTAL SEMANA', si, se, si - se, sc]);
    trow.font = { bold: true };
    trow.getCell(2).numFmt = moneyFmtExcel;
    trow.getCell(3).numFmt = moneyFmtExcel;
    trow.getCell(4).numFmt = moneyFmtExcel;
  }
  if (cadenceFull === 'mensual') {
    const daily = aggregateOperationalByDay(data.transactions, data.startDate, data.endDate, true);
    const weeks = rollupSingleBookDailyToWeeks(daily);
    const corte = workbook.addWorksheet('Por semana (totales)', { views: [{ state: 'frozen', ySplit: 1 }] });
    corte.addRow(['Semana (lun–dom)', 'Ingresos', 'Egresos', 'Neto', 'Movimientos']);
    corte.getRow(1).font = { bold: true };
    let si = 0,
      se = 0,
      sc = 0;
    for (const w of weeks) {
      const row = corte.addRow([w.label, w.totalIncome, w.totalExpense, w.net, w.count]);
      row.getCell(2).numFmt = moneyFmtExcel;
      row.getCell(3).numFmt = moneyFmtExcel;
      row.getCell(4).numFmt = moneyFmtExcel;
      si += w.totalIncome;
      se += w.totalExpense;
      sc += w.count;
    }
    const trow = corte.addRow(['TOTAL MES', si, se, si - se, sc]);
    trow.font = { bold: true };
    trow.getCell(2).numFmt = moneyFmtExcel;
    trow.getCell(3).numFmt = moneyFmtExcel;
    trow.getCell(4).numFmt = moneyFmtExcel;
    corte.getColumn(1).width = 36;
  }

  // ─── Hoja 2: Movimientos ─────────────────────────────────────────────────
  const movSheet = workbook.addWorksheet('Movimientos', { views: [{ state: 'frozen', ySplit: 1 }] });
  movSheet.columns = [
    { header: 'Fecha y hora', key: 'date', width: 18 },
    { header: 'Tipo de movimiento', key: 'type', width: 18 },
    { header: 'Concepto', key: 'concept', width: 32 },
    { header: 'Categoría', key: 'category', width: 22 },
    { header: 'Método de pago', key: 'payment', width: 16 },
    { header: 'Monto', key: 'amount', width: 14 },
    { header: 'Usuario', key: 'user', width: 22 },
    { header: 'Observaciones', key: 'notes', width: 28 },
  ];
  movSheet.getRow(1).font = { bold: true };
  movSheet.getRow(1).alignment = { horizontal: 'left' };

  const sortedTransactions = [...data.transactions].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  for (const t of sortedTransactions) {
    const row = movSheet.addRow({
      date: formatDateForExport(t.created_at),
      type: t.type === 'income' ? 'Ingreso' : 'Egreso',
      concept: t.concept,
      category: categoryLabel(t),
      payment: PAYMENT_METHOD_LABELS[t.payment_method] ?? t.payment_method,
      amount: t.type === 'income' ? Number(t.amount) : -Number(t.amount),
      user: t.created_by_name ?? '',
      notes: t.notes ?? '',
    });
    const amountCell = row.getCell(6);
    amountCell.numFmt = '"$"#,##0.00';
    if (t.type === 'income') amountCell.font = { color: { argb: 'FF059669' } };
    else amountCell.font = { color: { argb: 'FFDC2626' } };
  }

  if (data.internalTransfers.length > 0) {
    movSheet.addRow([]);
    const sep = movSheet.addRow({
      date: '—',
      type: 'Transferencias internas',
      concept: '(No suman a ingresos/egresos operativos; ajuste de balance entre libros)',
      category: '',
      payment: '',
      amount: '',
      user: '',
      notes: '',
    });
    sep.getCell(1).font = { bold: true };
    sep.getCell(3).font = { italic: true, size: 9 };
    for (const t of data.internalTransfers) {
      const row = movSheet.addRow({
        date: formatDateForExport(t.created_at),
        type: internalTransferExportTypeLabel(t),
        concept: t.concept,
        category: categoryLabel(t),
        payment: internalTransferPaymentExportLabel(t),
        amount: Number(t.amount),
        user: t.created_by_name ?? '',
        notes: t.notes ?? '',
      });
      row.getCell(6).numFmt = '"$"#,##0.00';
      row.getCell(6).font = { color: { argb: 'FF64748B' } };
    }
  }

  movSheet.getColumn(6).numFmt = '"$"#,##0.00';

  // Fila totales finales
  movSheet.addRow([]);
  const totalIngresosMovRow = movSheet.addRow({
    date: 'TOTAL INGRESOS:',
    type: '',
    concept: '',
    category: '',
    payment: '',
    amount: data.totalIncome,
    user: '',
    notes: '',
  });
  totalIngresosMovRow.getCell(1).font = { bold: true };
  totalIngresosMovRow.getCell(6).numFmt = '"$"#,##0.00';
  totalIngresosMovRow.getCell(6).font = { bold: true, color: { argb: 'FF059669' } };
  const totalEgresosMovRow = movSheet.addRow({
    date: 'TOTAL EGRESOS:',
    type: '',
    concept: '',
    category: '',
    payment: '',
    amount: -data.totalExpense,
    user: '',
    notes: '',
  });
  totalEgresosMovRow.getCell(1).font = { bold: true };
  totalEgresosMovRow.getCell(6).numFmt = '"$"#,##0.00';
  totalEgresosMovRow.getCell(6).font = { bold: true, color: { argb: 'FFDC2626' } };

  const totalEfectivoMovRow = movSheet.addRow({
    date: 'TOTAL EN EFECTIVO:',
    type: '',
    concept: '',
    category: '',
    payment: '',
    amount: data.totalEfectivo ?? 0,
    user: '',
    notes: '',
  });
  totalEfectivoMovRow.getCell(1).font = { bold: true };
  totalEfectivoMovRow.getCell(6).numFmt = '"$"#,##0.00';
  totalEfectivoMovRow.getCell(6).font = { bold: true };

  const totalTransferenciasMovRow = movSheet.addRow({
    date: 'TOTAL TRANSFERENCIAS:',
    type: '',
    concept: '',
    category: '',
    payment: '',
    amount: data.totalTransferencia ?? 0,
    user: '',
    notes: '',
  });
  totalTransferenciasMovRow.getCell(1).font = { bold: true };
  totalTransferenciasMovRow.getCell(6).numFmt = '"$"#,##0.00';
  totalTransferenciasMovRow.getCell(6).font = { bold: true };

  const totalTarjetaMovRow = movSheet.addRow({
    date: 'TOTAL TARJETA:',
    type: '',
    concept: '',
    category: '',
    payment: '',
    amount: data.totalTarjeta ?? 0,
    user: '',
    notes: '',
  });
  totalTarjetaMovRow.getCell(1).font = { bold: true };
  totalTarjetaMovRow.getCell(6).numFmt = '"$"#,##0.00';
  totalTarjetaMovRow.getCell(6).font = { bold: true };

  const balanceFinalRow = movSheet.addRow({
    date: data.balanceDescription.toUpperCase() + ':',
    type: '',
    concept: '',
    category: '',
    payment: '',
    amount: data.balance,
    user: '',
    notes: '',
  });
  balanceFinalRow.getCell(1).font = { bold: true, size: 11 };
  balanceFinalRow.getCell(6).numFmt = '"$"#,##0.00';
  balanceFinalRow.getCell(6).font = { bold: true, size: 11 };
  balanceFinalRow.getCell(6).fill = data.balance >= 0 ? greenFill : redFill;
  balanceFinalRow.height = 22;

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Opciones de página: A4 horizontal para todo el reporte */
const PDF_PAGE_OPTIONS = { margin: 45, size: 'A4' as const, layout: 'landscape' as const };

/** Genera PDF del reporte de caja — horizontal, sin pie de página para evitar páginas en blanco */
export async function buildCashReportPdf(
  data: CashReportExportData,
  reportType: string,
  generatedAt: string,
  generatedBy: string
): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  const doc = new PDFDocument(PDF_PAGE_OPTIONS);
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finish = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const margin = PDF_PAGE_OPTIONS.margin;
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const contentW = pageW - margin * 2;
  const minSpaceForResumen = 340;

  const primary = '#0f172a';
  const secondary = '#64748b';
  const green = '#059669';
  const red = '#dc2626';
  const headerBg = '#1e293b';
  const rowAlt = '#f8fafc';
  const rowHeader = '#e2e8f0';
  const boxBg = '#f1f5f9';
  const accent = '#3b82f6';
  const rowH = 22;
  const colW = [62, 30, 165, 50, 56, 58, 58, 165];
  const tableW = colW.reduce((a, b) => a + b, 0);
  const tableX = margin + (contentW - tableW) / 2;

  function sectionTitle(title: string) {
    doc.moveDown(0.4);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(primary).text(title, { align: 'left' });
    doc.moveDown(0.35);
  }

  doc.moveDown(0.8);
  doc.fontSize(22).font('Helvetica-Bold').fillColor(headerBg).text('REPORTE DE CAJA', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(12).font('Helvetica').fillColor(secondary).text(SCHOOL_NAME, { align: 'center' });
  doc.moveDown(0.35);
  doc.fontSize(10).fillColor(primary).text(`Libro: ${data.bookTitle}`, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor(primary).text(`Tipo: ${reportType}  ·  Rango: ${data.startDate} a ${data.endDate}`, { align: 'center' });
  doc.text(`Generado: ${generatedAt}  ·  Por: ${generatedBy}`, { align: 'center' });
  doc.moveDown(0.5);
  (doc as any).strokeColor(accent).lineWidth(1.5).moveTo(margin + contentW * 0.15, doc.y).lineTo(pageW - margin - contentW * 0.15, doc.y).stroke();
  doc.moveDown(0.8);

  sectionTitle('Resumen ejecutivo');
  const summaryBoxW = 320;
  const summaryBoxX = margin + (contentW - summaryBoxW) / 2;
  const summaryY0 = doc.y;
  const lineH = 18;
  const summaryLines = [
    { label: 'Total movimientos', value: String(data.transactionCount), color: primary },
    { label: 'Total ingresos', value: `$ ${data.totalIncome.toFixed(2)}`, color: green },
    { label: 'Total egresos', value: `$ ${data.totalExpense.toFixed(2)}`, color: red },
    { label: 'TOTAL EN EFECTIVO', value: `$ ${(data.totalEfectivo ?? 0).toFixed(2)}`, color: primary },
    { label: 'TOTAL TRANSFERENCIAS', value: `$ ${(data.totalTransferencia ?? 0).toFixed(2)}`, color: primary },
    { label: 'TOTAL TARJETA', value: `$ ${(data.totalTarjeta ?? 0).toFixed(2)}`, color: primary },
    { label: data.balanceDescription, value: `$ ${data.balance.toFixed(2)}`, color: accent },
    { label: 'Cant. ingresos / egresos', value: `${data.countIncome} / ${data.countExpense}`, color: secondary },
  ];
  const summaryBoxH = summaryLines.length * lineH + 24;
  (doc as any).roundedRect(summaryBoxX, summaryY0, summaryBoxW, summaryBoxH, 4).fillAndStroke(boxBg, primary);
  doc.font('Helvetica').fontSize(9);
  const valueBlockW = 115;
  const labelBlockW = summaryBoxW - 28 - valueBlockW;
  summaryLines.forEach((line, i) => {
    const y = summaryY0 + 14 + i * lineH;
    doc.fillColor(secondary).text(line.label, summaryBoxX + 14, y, { width: labelBlockW });
    doc.fillColor(line.color).text(line.value, summaryBoxX + summaryBoxW - 14 - valueBlockW, y, { width: valueBlockW, align: 'right' });
  });
  doc.y = summaryY0 + summaryBoxH + 14;
  doc.fillColor(primary);

  const cadencePdf1 = reportCadenceFromLabel(reportType);
  if (cadencePdf1 === 'semanal' || cadencePdf1 === 'mensual') {
    const corteYMax = pageH - 88;
    const srh = 16;
    const scw = [100, 78, 78, 78, 36];
    const stw = scw.reduce((a, b) => a + b, 0);
    const stx = margin + (contentW - stw) / 2;
    const daily1 = aggregateOperationalByDay(data.transactions, data.startDate, data.endDate, true);
    let si = 0,
      se = 0,
      sc = 0;
    for (const r of daily1) {
      si += r.totalIncome;
      se += r.totalExpense;
      sc += r.count;
    }
    const rows1: { cells: string[] }[] =
      cadencePdf1 === 'semanal'
        ? daily1.map((r) => ({
            cells: [r.date, r.totalIncome.toFixed(2), r.totalExpense.toFixed(2), r.net.toFixed(2), String(r.count)],
          }))
        : rollupSingleBookDailyToWeeks(daily1).map((w) => ({
            cells: [w.label, w.totalIncome.toFixed(2), w.totalExpense.toFixed(2), w.net.toFixed(2), String(w.count)],
          }));
    const hdr1 = cadencePdf1 === 'semanal' ? ['Fecha', 'Ingresos', 'Egresos', 'Neto día', 'Movs.'] : ['Semana', 'Ingresos', 'Egresos', 'Neto', 'Movs.'];
    const drawHdr1 = (yy: number) => {
      let sx = stx;
      hdr1.forEach((h, i) => {
        doc.rect(sx, yy, scw[i], srh).fill(rowHeader).stroke();
        doc.font('Helvetica-Bold').fontSize(7).fillColor(primary).text(h, sx + 4, yy + 5, { width: scw[i] - 8 });
        sx += scw[i];
      });
      return yy + srh;
    };
    if (doc.y + 36 > corteYMax) {
      (doc as { addPage: (o: object) => void }).addPage(PDF_PAGE_OPTIONS);
      doc.y = margin + 18;
    }
    sectionTitle(cadencePdf1 === 'semanal' ? 'Corte por día (totales semana)' : 'Corte por semana (totales mes)');
    let sy = drawHdr1(doc.y);
    doc.font('Helvetica').fontSize(7).fillColor(primary);
    rows1.forEach((row, idx) => {
      if (sy + srh > corteYMax) {
        (doc as { addPage: (o: object) => void }).addPage(PDF_PAGE_OPTIONS);
        sy = margin + 18;
        sy = drawHdr1(sy);
        doc.font('Helvetica').fontSize(7).fillColor(primary);
      }
      if (idx % 2 === 1) doc.rect(stx, sy, stw, srh).fill(rowAlt);
      let sx = stx;
      row.cells.forEach((cell, i) => {
        doc.rect(sx, sy, scw[i], srh).stroke();
        doc.fillColor(primary).text(cell, sx + 4, sy + 5, { width: scw[i] - 8, align: i >= 1 && i <= 3 ? 'right' : 'left' });
        sx += scw[i];
      });
      sy += srh;
    });
    if (sy + srh > corteYMax) {
      (doc as { addPage: (o: object) => void }).addPage(PDF_PAGE_OPTIONS);
      sy = margin + 18;
    }
    const tot1 = [
      cadencePdf1 === 'semanal' ? 'TOTAL SEMANA' : 'TOTAL MES',
      si.toFixed(2),
      se.toFixed(2),
      (si - se).toFixed(2),
      String(sc),
    ];
    let sx = stx;
    tot1.forEach((cell, i) => {
      doc.rect(sx, sy, scw[i], srh).fill(rowHeader).stroke();
      doc.font('Helvetica-Bold').fontSize(7).fillColor(primary).text(cell, sx + 4, sy + 5, {
        width: scw[i] - 8,
        align: i >= 1 && i <= 3 ? 'right' : 'left',
      });
      sx += scw[i];
    });
    sy += srh;
    doc.y = sy + 12;
    doc.fillColor(primary);
  }

  sectionTitle('Detalle de movimientos');
  const tableTop = doc.y;
  const headers = ['Fecha', 'Tipo', 'Concepto', 'Categoría', 'Método', 'Monto', 'Usuario', 'Observaciones'];
  doc.font('Helvetica-Bold').fontSize(8).fillColor(primary);
  let x = tableX;
  const headerPad = 3;
  headers.forEach((h, i) => {
    doc.rect(x, tableTop, colW[i], rowH).fill(rowHeader).stroke();
    doc.fillColor(primary).text(h, x + headerPad, tableTop + 6, { width: colW[i] - headerPad * 2 });
    x += colW[i];
  });
  let y = tableTop + rowH;
  const tableBreakY = pageH - 90;
  doc.font('Helvetica').fontSize(8);
  data.transactions.forEach((t, rowIndex) => {
    x = tableX;
    const amountStr = (t.type === 'income' ? '+' : '-') + ' $ ' + Number(t.amount).toFixed(2);
    const row: string[] = [
      formatDateForExport(t.created_at),
      t.type === 'income' ? 'Ingreso' : 'Egreso',
      t.concept ?? '',
      categoryLabel(t),
      PAYMENT_METHOD_LABELS[t.payment_method] ?? t.payment_method,
      amountStr,
      t.created_by_name ?? '',
      t.notes ?? '',
    ];
    let cellHeight = rowH;
    for (let i = 0; i < row.length; i++) {
      const w = colW[i] - 8;
      const h = (doc as unknown as { heightOfString: (text: string, opts?: { width?: number }) => number }).heightOfString(row[i], { width: w });
      cellHeight = Math.max(cellHeight, Math.ceil(h) + 10);
    }
    if (y + cellHeight > tableBreakY) {
      (doc as unknown as { addPage: (opts?: object) => void }).addPage(PDF_PAGE_OPTIONS);
      doc.y = margin + 18;
      y = doc.y;
      x = tableX;
      doc.font('Helvetica-Bold').fontSize(8).fillColor(primary);
      headers.forEach((h, i) => {
        doc.rect(x, y - rowH, colW[i], rowH).fill(rowHeader).stroke();
        doc.text(h, x + headerPad, y - rowH + 6, { width: colW[i] - headerPad * 2 });
        x += colW[i];
      });
      y += rowH;
      doc.font('Helvetica').fontSize(8);
    }
    x = tableX;
    const isAlt = rowIndex % 2 === 1;
    if (isAlt) doc.rect(tableX, y, tableW, cellHeight).fill(rowAlt);
    row.forEach((cell, i) => {
      doc.rect(x, y, colW[i], cellHeight).stroke();
      if (i === 5) doc.fillColor(t.type === 'income' ? green : red);
      else doc.fillColor(primary);
      const cellPad = 4;
      const cellWidth = colW[i] - cellPad * 2;
      const align = i === 5 ? 'right' : 'left';
      doc.text(cell, x + cellPad, y + 6, { width: cellWidth, align });
      x += colW[i];
    });
    doc.fillColor(primary);
    y += cellHeight;
  });

  if (data.internalTransfers.length > 0) {
    doc.y = y + 14;
    if (doc.y > tableBreakY - 80) {
      (doc as unknown as { addPage: (opts?: object) => void }).addPage(PDF_PAGE_OPTIONS);
      doc.y = margin + 18;
      y = doc.y;
    }
    sectionTitle('Transferencias internas (detalle; no son ingreso/egreso operativo)');
    doc.font('Helvetica').fontSize(8).fillColor(secondary).text(
      'Movimientos entre caja Escuela y DRA que ajustan balance pero no figuran como egreso operativo.',
      margin,
      doc.y,
      { width: contentW }
    );
    doc.moveDown(0.6);
    y = doc.y;
    data.internalTransfers.forEach((t, rowIndex) => {
      x = tableX;
      const amountStr = '$ ' + Number(t.amount).toFixed(2);
      const row: string[] = [
        formatDateForExport(t.created_at),
        internalTransferExportTypeLabel(t),
        t.concept ?? '',
        categoryLabel(t),
        internalTransferPaymentExportLabel(t),
        amountStr,
        t.created_by_name ?? '',
        t.notes ?? '',
      ];
      let cellHeight = rowH;
      for (let i = 0; i < row.length; i++) {
        const w = colW[i] - 8;
        const h = (doc as unknown as { heightOfString: (text: string, opts?: { width?: number }) => number }).heightOfString(row[i], { width: w });
        cellHeight = Math.max(cellHeight, Math.ceil(h) + 10);
      }
      if (y + cellHeight > tableBreakY) {
        (doc as unknown as { addPage: (opts?: object) => void }).addPage(PDF_PAGE_OPTIONS);
        doc.y = margin + 18;
        y = doc.y;
      }
      x = tableX;
      const isAlt = rowIndex % 2 === 1;
      if (isAlt) doc.rect(tableX, y, tableW, cellHeight).fill(rowAlt);
      row.forEach((cell, i) => {
        doc.rect(x, y, colW[i], cellHeight).stroke();
        if (i === 5) doc.fillColor(secondary);
        else doc.fillColor(primary);
        const cellPad = 4;
        const cellWidth = colW[i] - cellPad * 2;
        const align = i === 5 ? 'right' : 'left';
        doc.text(cell, x + cellPad, y + 6, { width: cellWidth, align });
        x += colW[i];
      });
      doc.fillColor(primary);
      y += cellHeight;
    });
  }

  doc.y = y + 18;
  if (doc.y > pageH - minSpaceForResumen) {
    (doc as unknown as { addPage: (opts?: object) => void }).addPage(PDF_PAGE_OPTIONS);
    doc.y = margin + 18;
  }

  const leftColX = margin + 20;
  const labelW = 240;
  const valueW = 100;

  sectionTitle('Resumen por categoría');
  doc.font('Helvetica').fontSize(9);
  let cy = doc.y + 4;
  data.byCategory.forEach((r) => {
    doc.fillColor(secondary).text(r.label, leftColX, cy, { width: labelW });
    doc.fillColor(primary).text(`$ ${r.total.toFixed(2)} (${r.count})`, leftColX + labelW, cy, { width: valueW, align: 'right' });
    cy += 16;
  });
  doc.y = cy + 8;
  sectionTitle('Resumen por método de pago');
  let py = doc.y + 4;
  const methodDisplay = [
    { method: 'Efectivo', total: data.totalEfectivo ?? 0, count: data.byPaymentMethod.find((p) => p.method === 'Efectivo')?.count ?? 0 },
    { method: 'Transferencia', total: data.totalTransferencia ?? 0, count: data.byPaymentMethod.find((p) => p.method === 'Transferencia')?.count ?? 0 },
    { method: 'Tarjeta', total: data.totalTarjeta ?? 0, count: data.byPaymentMethod.find((p) => p.method === 'Tarjeta')?.count ?? 0 },
  ];
  methodDisplay.forEach((r) => {
    doc.fillColor(secondary).text(r.method, leftColX, py, { width: labelW });
    doc.fillColor(primary).text(`$ ${r.total.toFixed(2)} (${r.count})`, leftColX + labelW, py, { width: valueW, align: 'right' });
    py += 16;
  });
  doc.y = py + 12;

  const finalBoxW = 380;
  const finalBoxX = margin + (contentW - finalBoxW) / 2;
  const finalBoxPad = 18;
  const finalValueW = 95;
  const finalLabelX = finalBoxX + finalBoxPad;
  const finalValueX = finalBoxX + finalBoxW - finalBoxPad - finalValueW;
  const finalY0 = doc.y;
  const finalH = 118;
  (doc as any).roundedRect(finalBoxX, finalY0, finalBoxW, finalH, 4).fillAndStroke(boxBg, accent);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(primary).text('Resumen final del período', finalLabelX, finalY0 + 12, { width: finalBoxW - finalBoxPad * 2 });
  doc.font('Helvetica').fontSize(9);
  doc.fillColor(green).text(`Ingreso total: $ ${data.totalIncome.toFixed(2)}`, finalLabelX, finalY0 + 30);
  doc.fillColor(red).text(`Egreso total: $ ${data.totalExpense.toFixed(2)}`, finalLabelX, finalY0 + 46);
  doc.fillColor(secondary).text('TOTAL EN EFECTIVO:', finalLabelX, finalY0 + 62, { width: finalValueX - finalLabelX - 6 });
  doc.fillColor(primary).text(`$ ${(data.totalEfectivo ?? 0).toFixed(2)}`, finalValueX, finalY0 + 62, { width: finalValueW, align: 'right' });
  doc.fillColor(secondary).text('TOTAL TRANSFERENCIAS:', finalLabelX, finalY0 + 78, { width: finalValueX - finalLabelX - 6 });
  doc.fillColor(primary).text(`$ ${(data.totalTransferencia ?? 0).toFixed(2)}`, finalValueX, finalY0 + 78, { width: finalValueW, align: 'right' });
  doc.fillColor(secondary).text('TOTAL TARJETA:', finalLabelX, finalY0 + 94, { width: finalValueX - finalLabelX - 6 });
  doc.fillColor(primary).text(`$ ${(data.totalTarjeta ?? 0).toFixed(2)}`, finalValueX, finalY0 + 94, { width: finalValueW, align: 'right' });
  doc
    .font('Helvetica-Bold')
    .fillColor(accent)
    .text(`${data.balanceDescription}: $ ${data.balance.toFixed(2)}`, finalLabelX, finalY0 + 102, {
      width: finalBoxW - finalBoxPad * 2,
    });

  doc.end();
  return finish;
}

/** Excel: Escuela + DRA + movimientos unificados en un solo archivo. */
export async function buildCashReportExcelCombined(
  data: CashReportCombinedExportData,
  reportType: string,
  generatedAt: string,
  generatedBy: string
): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = SCHOOL_NAME;
  const greenFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD1FAE5' } };
  const redFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFEE2E2' } };

  const sum = workbook.addWorksheet('Resumen integral', { views: [{ state: 'frozen', ySplit: 1 }] });
  sum.columns = [{ key: 'k', width: 38 }, { key: 'v', width: 22 }];
  sum.addRow(['REPORTE DE CAJA — COMPLETO (Escuela + DRA)', '']).font = { bold: true, size: 14 };
  sum.addRow(['Institución', SCHOOL_NAME]);
  sum.addRow(['Tipo de reporte', reportType]);
  sum.addRow(['Período', `${data.startDate} → ${data.endDate}`]);
  sum.addRow(['Generado', generatedAt]);
  sum.addRow(['Usuario', generatedBy]);
  sum.addRow([]);

  const addBlock = (title: string, d: CashReportExportData) => {
    const h = sum.addRow([title, '']);
    h.getCell(1).font = { bold: true, size: 11 };
    sum.addRow(['Total movimientos (incl. internas en detalle)', d.transactionCount]);
    sum.addRow(['Total ingresos operativos', d.totalIncome]);
    sum.addRow(['Total egresos operativos', d.totalExpense]);
    sum.addRow(['Total efectivo (neto período)', d.totalEfectivo ?? 0]);
    sum.addRow(['Total transferencias (neto período)', d.totalTransferencia ?? 0]);
    sum.addRow(['Total tarjeta (neto período)', d.totalTarjeta ?? 0]);
    const b = sum.addRow([d.balanceDescription, d.balance]);
    b.getCell(2).numFmt = '"$"#,##0.00';
    b.getCell(2).font = { bold: true };
    b.getCell(2).fill = d.balance >= 0 ? greenFill : redFill;
    sum.addRow([]);
  };

  addBlock('── Caja Escuela ──', data.escuela);
  addBlock('── Caja DRA ──', data.dra);
  const ih = sum.addRow(['── Transferencias internas (consolidado) ──', '']);
  ih.getCell(1).font = { bold: true };
  sum.addRow(['Cantidad de registros', data.allInternalTransfers.length]);
  sum.addRow([
    'Nota',
    'No forman parte del ingreso/egreso operativo; reflejan traspasos entre libros.',
  ]);

  sum.getColumn(2).eachCell((cell, rowNumber) => {
    if (rowNumber > 6 && typeof cell.value === 'number') cell.numFmt = '"$"#,##0.00';
  });

  const cadenceX = reportCadenceFromLabel(reportType);
  if (cadenceX === 'semanal') {
    const daily = buildCombinedDailyTable(data, true);
    const ws = workbook.addWorksheet('Por día (totales semana)', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.addRow([
      'Fecha',
      'Esc. ingresos',
      'Esc. egresos',
      'Esc. neto',
      'DRA ingresos',
      'DRA egresos',
      'DRA neto',
      'Total ingresos',
      'Total egresos',
      'Neto combinado',
      'Movs.',
    ]);
    ws.getRow(1).font = { bold: true };
    let sEi = 0,
      sEe = 0,
      sDi = 0,
      sDe = 0,
      sTi = 0,
      sTe = 0,
      sCnt = 0;
    for (const r of daily) {
      const tIng = r.escuelaIncome + r.draIncome;
      const tEgr = r.escuelaExpense + r.draExpense;
      const row = ws.addRow([
        r.date,
        r.escuelaIncome,
        r.escuelaExpense,
        r.escuelaIncome - r.escuelaExpense,
        r.draIncome,
        r.draExpense,
        r.draIncome - r.draExpense,
        tIng,
        tEgr,
        tIng - tEgr,
        r.count,
      ]);
      for (const c of [2, 3, 4, 5, 6, 7, 8, 9, 10]) row.getCell(c).numFmt = moneyFmtExcel;
      sEi += r.escuelaIncome;
      sEe += r.escuelaExpense;
      sDi += r.draIncome;
      sDe += r.draExpense;
      sTi += tIng;
      sTe += tEgr;
      sCnt += r.count;
    }
    const tot = ws.addRow([
      'TOTAL SEMANA',
      sEi,
      sEe,
      sEi - sEe,
      sDi,
      sDe,
      sDi - sDe,
      sTi,
      sTe,
      sTi - sTe,
      sCnt,
    ]);
    tot.font = { bold: true };
    for (const c of [2, 3, 4, 5, 6, 7, 8, 9, 10]) tot.getCell(c).numFmt = moneyFmtExcel;
    ws.getColumn(1).width = 12;
  }
  if (cadenceX === 'mensual') {
    const daily = buildCombinedDailyTable(data, true);
    const weeks = rollupCombinedDailyToWeeks(daily);
    const ws = workbook.addWorksheet('Por semana (totales mes)', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.addRow([
      'Semana (lun–dom)',
      'Esc. ingresos',
      'Esc. egresos',
      'Esc. neto',
      'DRA ingresos',
      'DRA egresos',
      'DRA neto',
      'Total ingresos',
      'Total egresos',
      'Neto combinado',
      'Movs.',
    ]);
    ws.getRow(1).font = { bold: true };
    let sEi = 0,
      sEe = 0,
      sDi = 0,
      sDe = 0,
      sTi = 0,
      sTe = 0,
      sCnt = 0;
    for (const w of weeks) {
      const tIng = w.escuelaIncome + w.draIncome;
      const tEgr = w.escuelaExpense + w.draExpense;
      const row = ws.addRow([
        w.label,
        w.escuelaIncome,
        w.escuelaExpense,
        w.escuelaIncome - w.escuelaExpense,
        w.draIncome,
        w.draExpense,
        w.draIncome - w.draExpense,
        tIng,
        tEgr,
        tIng - tEgr,
        w.count,
      ]);
      for (const c of [2, 3, 4, 5, 6, 7, 8, 9, 10]) row.getCell(c).numFmt = moneyFmtExcel;
      sEi += w.escuelaIncome;
      sEe += w.escuelaExpense;
      sDi += w.draIncome;
      sDe += w.draExpense;
      sTi += tIng;
      sTe += tEgr;
      sCnt += w.count;
    }
    const tot = ws.addRow([
      'TOTAL MES',
      sEi,
      sEe,
      sEi - sEe,
      sDi,
      sDe,
      sDi - sDe,
      sTi,
      sTe,
      sTi - sTe,
      sCnt,
    ]);
    tot.font = { bold: true };
    for (const c of [2, 3, 4, 5, 6, 7, 8, 9, 10]) tot.getCell(c).numFmt = moneyFmtExcel;
    ws.getColumn(1).width = 38;
  }

  const makeBookMovSheet = (name: string, txs: CashTransactionWithCreator[]) => {
    const ws = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
      { header: 'Fecha y hora', key: 'date', width: 18 },
      { header: 'Tipo', key: 'type', width: 14 },
      { header: 'Concepto', key: 'concept', width: 30 },
      { header: 'Categoría / detalle', key: 'category', width: 30 },
      { header: 'Cuenta / banco', key: 'bank', width: 26 },
      { header: 'Método', key: 'payment', width: 16 },
      { header: 'Monto', key: 'amount', width: 14 },
      { header: 'Usuario', key: 'user', width: 18 },
      { header: 'Observaciones', key: 'notes', width: 28 },
    ];
    ws.getRow(1).font = { bold: true };
    const sorted = [...txs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    for (const t of sorted) {
      const row = ws.addRow({
        date: formatDateForExport(t.created_at),
        type: t.type === 'income' ? 'Ingreso' : 'Egreso',
        concept: t.concept,
        category: categoryLabel(t),
        bank: fundsDestDisplay(t),
        payment: PAYMENT_METHOD_LABELS[t.payment_method] ?? t.payment_method,
        amount: t.type === 'income' ? Number(t.amount) : -Number(t.amount),
        user: t.created_by_name ?? '',
        notes: t.notes ?? '',
      });
      row.getCell(7).numFmt = '"$"#,##0.00';
      row.getCell(7).font = { color: { argb: t.type === 'income' ? 'FF059669' : 'FFDC2626' } };
    }
  };
  makeBookMovSheet('Movimientos Escuela', data.escuela.transactions);
  makeBookMovSheet('Movimientos DRA', data.dra.transactions);

  const internalWs = workbook.addWorksheet('Transferencias internas', { views: [{ state: 'frozen', ySplit: 1 }] });
  internalWs.columns = [
    { header: 'Fecha y hora', key: 'date', width: 18 },
    { header: 'Tipo', key: 'type', width: 18 },
    { header: 'Concepto', key: 'concept', width: 32 },
    { header: 'Detalle', key: 'category', width: 36 },
    { header: 'Cuenta / banco', key: 'bank', width: 26 },
    { header: 'Método', key: 'payment', width: 24 },
    { header: 'Monto', key: 'amount', width: 14 },
    { header: 'Usuario', key: 'user', width: 18 },
    { header: 'Observaciones', key: 'notes', width: 28 },
  ];
  internalWs.getRow(1).font = { bold: true };
  for (const t of data.allInternalTransfers) {
    const row = internalWs.addRow({
      date: formatDateForExport(t.created_at),
      type: internalTransferExportTypeLabel(t),
      concept: t.concept,
      category: categoryLabel(t),
      bank: t.funds_destination ? fundsDestDisplay(t) : '—',
      payment: internalTransferPaymentExportLabel(t),
      amount: Number(t.amount),
      user: t.created_by_name ?? '',
      notes: t.notes ?? '',
    });
    row.getCell(7).numFmt = '"$"#,##0.00';
    row.getCell(7).font = { color: { argb: 'FF64748B' } };
  }

  const intSheet = workbook.addWorksheet('Por libro (detalle)', { views: [{ state: 'frozen', ySplit: 1 }] });
  intSheet.columns = [{ key: 'a', width: 14 }, { key: 'b', width: 40 }];
  intSheet.addRow(['Escuela — resumen ejecutivo', '']).getCell(1).font = { bold: true };
  intSheet.addRow(['Ingresos', data.escuela.totalIncome]);
  intSheet.addRow(['Egresos', data.escuela.totalExpense]);
  intSheet.addRow(['Balance indicado', data.escuela.balance]);
  intSheet.addRow([]);
  intSheet.addRow(['DRA — resumen ejecutivo', '']).getCell(1).font = { bold: true };
  intSheet.addRow(['Ingresos', data.dra.totalIncome]);
  intSheet.addRow(['Egresos', data.dra.totalExpense]);
  intSheet.addRow(['Balance indicado', data.dra.balance]);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** PDF horizontal: resumen dual + tabla unificada con columna Libro. */
export async function buildCashReportPdfCombined(
  data: CashReportCombinedExportData,
  reportType: string,
  generatedAt: string,
  generatedBy: string
): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  const doc = new PDFDocument(PDF_PAGE_OPTIONS);
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finish = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const margin = PDF_PAGE_OPTIONS.margin;
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const contentW = pageW - margin * 2;
  const primary = '#0f172a';
  const secondary = '#64748b';
  const green = '#059669';
  const red = '#dc2626';
  const headerBg = '#1e293b';
  const rowAlt = '#f8fafc';
  const rowHeader = '#e2e8f0';
  const boxBg = '#f1f5f9';
  const accent = '#0f766e';
  const rowH = 20;
  const colW = [44, 56, 26, 128, 72, 44, 52, 128];
  const tableW = colW.reduce((a, b) => a + b, 0);
  const tableX = margin + (contentW - tableW) / 2;

  doc.fontSize(20).font('Helvetica-Bold').fillColor(headerBg).text('REPORTE DE CAJA — COMPLETO', { align: 'center' });
  doc.moveDown(0.35);
  doc.fontSize(10).font('Helvetica').fillColor(secondary).text(SCHOOL_NAME, { align: 'center' });
  doc.moveDown(0.4);
  doc.fillColor(primary).text(`${reportType}  ·  ${data.startDate} a ${data.endDate}`, { align: 'center' });
  doc.text(`Generado: ${generatedAt}  ·  ${generatedBy}`, { align: 'center' });
  doc.moveDown(0.8);

  const boxHalf = (contentW - 16) / 2;
  const y0 = doc.y;
  (doc as any).roundedRect(margin, y0, boxHalf, 92, 4).fillAndStroke(boxBg, primary);
  (doc as any).roundedRect(margin + boxHalf + 16, y0, boxHalf, 92, 4).fillAndStroke(boxBg, primary);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(primary).text('Caja Escuela', margin + 10, y0 + 8);
  doc.text('Caja DRA', margin + boxHalf + 26, y0 + 8);
  doc.font('Helvetica').fontSize(8).fillColor(secondary);
  let ly = y0 + 24;
  doc.text(`Ingresos: $ ${data.escuela.totalIncome.toFixed(2)}`, margin + 10, ly);
  doc.text(`Egresos: $ ${data.escuela.totalExpense.toFixed(2)}`, margin + 10, ly + 12);
  doc.fillColor(accent).text(`${data.escuela.balanceDescription}`, margin + 10, ly + 28, { width: boxHalf - 20 });
  doc.fillColor(primary).text(`$ ${data.escuela.balance.toFixed(2)}`, margin + 10, ly + 40);
  ly = y0 + 24;
  doc.fillColor(secondary).text(`Ingresos: $ ${data.dra.totalIncome.toFixed(2)}`, margin + boxHalf + 26, ly);
  doc.text(`Egresos: $ ${data.dra.totalExpense.toFixed(2)}`, margin + boxHalf + 26, ly + 12);
  doc.fillColor(accent).text(`${data.dra.balanceDescription}`, margin + boxHalf + 26, ly + 28, { width: boxHalf - 20 });
  doc.fillColor(primary).text(`$ ${data.dra.balance.toFixed(2)}`, margin + boxHalf + 26, ly + 40);
  doc.fontSize(7).fillColor(secondary).text(`Internas: ${data.allInternalTransfers.length} registro(s)`, margin + 10, y0 + 78);
  doc.y = y0 + 102;

  const cadencePdfC = reportCadenceFromLabel(reportType);
  if (cadencePdfC === 'semanal' || cadencePdfC === 'mensual') {
    const corteBreakY = pageH - 76;
    const crh = 14;
    const ccw = [48, 40, 40, 40, 40, 40, 40, 42, 42, 46, 22];
    const ctw = ccw.reduce((a, b) => a + b, 0);
    const ctx = margin + Math.max(0, (contentW - ctw) / 2);
    const dailyCorte = buildCombinedDailyTable(data, true);
    let tEi = 0,
      tEe = 0,
      tDi = 0,
      tDe = 0,
      tCnt = 0;
    for (const r of dailyCorte) {
      tEi += r.escuelaIncome;
      tEe += r.escuelaExpense;
      tDi += r.draIncome;
      tDe += r.draExpense;
      tCnt += r.count;
    }
    const tTi = tEi + tDi;
    const tTe = tEe + tDe;
    const corteRows: { cells: string[] }[] =
      cadencePdfC === 'semanal'
        ? dailyCorte.map((r) => {
            const tIng = r.escuelaIncome + r.draIncome;
            const tEgr = r.escuelaExpense + r.draExpense;
            return {
              cells: [
                r.date,
                r.escuelaIncome.toFixed(2),
                r.escuelaExpense.toFixed(2),
                (r.escuelaIncome - r.escuelaExpense).toFixed(2),
                r.draIncome.toFixed(2),
                r.draExpense.toFixed(2),
                (r.draIncome - r.draExpense).toFixed(2),
                tIng.toFixed(2),
                tEgr.toFixed(2),
                (tIng - tEgr).toFixed(2),
                String(r.count),
              ],
            };
          })
        : rollupCombinedDailyToWeeks(dailyCorte).map((w) => {
            const tIng = w.escuelaIncome + w.draIncome;
            const tEgr = w.escuelaExpense + w.draExpense;
            return {
              cells: [
                w.label,
                w.escuelaIncome.toFixed(2),
                w.escuelaExpense.toFixed(2),
                (w.escuelaIncome - w.escuelaExpense).toFixed(2),
                w.draIncome.toFixed(2),
                w.draExpense.toFixed(2),
                (w.draIncome - w.draExpense).toFixed(2),
                tIng.toFixed(2),
                tEgr.toFixed(2),
                (tIng - tEgr).toFixed(2),
                String(w.count),
              ],
            };
          });
    const drawCorteHdr = (yy: number) => {
      const hdrs = ['Fecha / semana', 'E +', 'E −', 'E net', 'D +', 'D −', 'D net', 'Σ ing.', 'Σ egr.', 'Neto', '#'];
      let cx = ctx;
      hdrs.forEach((h, i) => {
        doc.rect(cx, yy, ccw[i], crh).fill(rowHeader).stroke();
        doc.font('Helvetica-Bold').fontSize(5).fillColor(primary).text(h, cx + 1, yy + 4, { width: ccw[i] - 2 });
        cx += ccw[i];
      });
      return yy + crh;
    };
    if (doc.y + 48 > corteBreakY) {
      (doc as { addPage: (o: object) => void }).addPage(PDF_PAGE_OPTIONS);
      doc.y = margin + 12;
    }
    doc.font('Helvetica-Bold').fontSize(9).fillColor(primary).text(
      cadencePdfC === 'semanal'
        ? 'Totales por día (operativo: Escuela y DRA; sin transferencias internas)'
        : 'Totales por semana (lun–dom; operativo combinado)',
      margin,
      doc.y,
      { width: contentW }
    );
    doc.moveDown(0.3);
    let cy = drawCorteHdr(doc.y);
    doc.font('Helvetica').fontSize(5).fillColor(primary);
    corteRows.forEach((row, idx) => {
      if (cy + crh > corteBreakY) {
        (doc as { addPage: (o: object) => void }).addPage(PDF_PAGE_OPTIONS);
        cy = margin + 12;
        cy = drawCorteHdr(cy);
        doc.font('Helvetica').fontSize(5).fillColor(primary);
      }
      if (idx % 2 === 1) doc.rect(ctx, cy, ctw, crh).fill(rowAlt);
      let cx = ctx;
      row.cells.forEach((cell, i) => {
        doc.rect(cx, cy, ccw[i], crh).stroke();
        doc.fillColor(primary).text(cell, cx + 2, cy + 3, {
          width: ccw[i] - 4,
          align: i >= 1 && i <= 9 ? 'right' : 'left',
        });
        cx += ccw[i];
      });
      cy += crh;
    });
    if (cy + crh > corteBreakY) {
      (doc as { addPage: (o: object) => void }).addPage(PDF_PAGE_OPTIONS);
      cy = margin + 12;
    }
    const totCells = [
      cadencePdfC === 'semanal' ? 'TOTAL SEMANA' : 'TOTAL MES',
      tEi.toFixed(2),
      tEe.toFixed(2),
      (tEi - tEe).toFixed(2),
      tDi.toFixed(2),
      tDe.toFixed(2),
      (tDi - tDe).toFixed(2),
      tTi.toFixed(2),
      tTe.toFixed(2),
      (tTi - tTe).toFixed(2),
      String(tCnt),
    ];
    let cx = ctx;
    totCells.forEach((cell, i) => {
      doc.rect(cx, cy, ccw[i], crh).fill(rowHeader).stroke();
      doc.font('Helvetica-Bold').fontSize(5).fillColor(primary).text(cell, cx + 2, cy + 3, {
        width: ccw[i] - 4,
        align: i >= 1 && i <= 9 ? 'right' : 'left',
      });
      cx += ccw[i];
    });
    cy += crh;
    doc.y = cy + 10;
  }

  doc.font('Helvetica-Bold').fontSize(10).fillColor(primary).text('Movimientos por libro', margin, doc.y);
  doc.moveDown(0.4);
  const headers = ['Fecha', 'Tipo', 'Concepto', 'Banco/Cuenta', 'Método', 'Monto', 'Usuario', 'Notas'];
  let y = doc.y;
  doc.font('Helvetica').fontSize(7);
  const tableBreakY = pageH - 72;
  let x = tableX;
  const headerPad = 2;

  const drawHeader = () => {
    x = tableX;
    doc.font('Helvetica-Bold').fontSize(7).fillColor(primary);
    headers.forEach((h, i) => {
      doc.rect(x, y, colW[i], rowH).fill(rowHeader).stroke();
      doc.fillColor(primary).text(h, x + headerPad, y + 5, { width: colW[i] - 4 });
      x += colW[i];
    });
    y += rowH;
    doc.font('Helvetica').fontSize(7).fillColor(primary);
  };

  const drawBookRows = (title: string, txs: CashTransactionWithCreator[]) => {
    if (y > tableBreakY - 80) {
      (doc as unknown as { addPage: (opts?: object) => void }).addPage(PDF_PAGE_OPTIONS);
      y = margin + 14;
    }
    doc.font('Helvetica-Bold').fontSize(9).fillColor(primary).text(title, margin, y);
    y += 14;
    drawHeader();
    const sorted = [...txs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    sorted.forEach((t, rowIndex) => {
      const row = {
        cells: [
          formatDateForExport(t.created_at),
          t.type === 'income' ? 'Ing.' : 'Egr.',
          t.concept ?? '',
          fundsDestDisplay(t),
          PAYMENT_METHOD_LABELS[t.payment_method] ?? t.payment_method,
          (t.type === 'income' ? '+' : '−') + ' $' + Number(t.amount).toFixed(2),
          t.created_by_name ?? '',
          (t.notes ?? '').slice(0, 90),
        ],
        income: t.type === 'income',
      };
      x = tableX;
      let cellHeight = rowH;
      for (let i = 0; i < row.cells.length; i++) {
        const w = colW[i] - 6;
        const h = (doc as unknown as { heightOfString: (text: string, opts?: { width?: number }) => number }).heightOfString(
          row.cells[i],
          { width: w }
        );
        cellHeight = Math.max(cellHeight, Math.ceil(h) + 8);
      }
      if (y + cellHeight > tableBreakY) {
        (doc as unknown as { addPage: (opts?: object) => void }).addPage(PDF_PAGE_OPTIONS);
        y = margin + 14;
        drawHeader();
      }
      x = tableX;
      if (rowIndex % 2 === 1) doc.rect(tableX, y, tableW, cellHeight).fill(rowAlt);
      row.cells.forEach((cell, i) => {
        doc.rect(x, y, colW[i], cellHeight).stroke();
        if (i === 5) doc.fillColor(row.income ? green : red);
        else doc.fillColor(primary);
        doc.text(cell, x + 3, y + 4, { width: colW[i] - 6, align: i === 5 ? 'right' : 'left' });
        x += colW[i];
      });
      doc.fillColor(primary);
      y += cellHeight;
    });
    y += 10;
  };

  drawBookRows('Movimientos Caja Escuela', data.escuela.transactions);
  drawBookRows('Movimientos Caja DRA', data.dra.transactions);

  if (data.allInternalTransfers.length > 0) {
    doc.y = y + 2;
    if (doc.y > tableBreakY - 40) {
      (doc as unknown as { addPage: (opts?: object) => void }).addPage(PDF_PAGE_OPTIONS);
      doc.y = margin + 14;
      y = doc.y;
    } else {
      y = doc.y;
    }
    doc.font('Helvetica-Bold').fontSize(9).fillColor(primary).text('Transferencias internas (no operativas)', margin, y);
    y += 14;
    drawHeader();
    doc.font('Helvetica').fontSize(7);
    data.allInternalTransfers.forEach((t, rowIndex) => {
      const row = {
        cells: [
          formatDateForExport(t.created_at),
          internalTransferExportTypeLabel(t),
          t.concept ?? '',
          t.funds_destination ? fundsDestDisplay(t) : categoryLabel(t),
          internalTransferPaymentExportLabel(t),
          '$ ' + Number(t.amount).toFixed(2),
          t.created_by_name ?? '',
          (t.notes ?? '').slice(0, 90),
        ],
        income: false as boolean,
      };
      x = tableX;
      let cellHeight = rowH;
      for (let i = 0; i < row.cells.length; i++) {
        const w = colW[i] - 6;
        const h = (doc as unknown as { heightOfString: (text: string, opts?: { width?: number }) => number }).heightOfString(
          row.cells[i],
          { width: w }
        );
        cellHeight = Math.max(cellHeight, Math.ceil(h) + 8);
      }
      if (y + cellHeight > tableBreakY) {
        (doc as unknown as { addPage: (opts?: object) => void }).addPage(PDF_PAGE_OPTIONS);
        y = margin + 14;
        drawHeader();
      }
      x = tableX;
      if (rowIndex % 2 === 1) doc.rect(tableX, y, tableW, cellHeight).fill(rowAlt);
      row.cells.forEach((cell, i) => {
        doc.rect(x, y, colW[i], cellHeight).stroke();
        doc.fillColor(i === 5 ? secondary : primary);
        doc.text(cell, x + 3, y + 4, { width: colW[i] - 6, align: i === 5 ? 'right' : 'left' });
        x += colW[i];
      });
      doc.fillColor(primary);
      y += cellHeight;
    });
  }

  doc.end();
  return finish;
}
