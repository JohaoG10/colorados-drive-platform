import { supabaseAdmin } from '../config/supabase';

export type CashSessionStatus = 'open' | 'closed';
export type CashTransactionType = 'income' | 'expense';
export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta';

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
  type: CashTransactionType;
  concept: string;
  category: string | null;
  income_type: string | null;
  payment_method: PaymentMethod;
  amount: number;
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
  openingAmount: number;
  totalIncome: number;
  totalExpense: number;
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
  summary: CashSummary | null;
  last7Days: { date: string; totalIncome: number; totalExpense: number; balance: number; count: number }[];
  monthlyStats: MonthlyStat[];
  alerts: CashAlert[];
}

/** Datos completos para exportar reporte (PDF/Excel) */
export interface CashReportExportData {
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  totalEfectivo?: number;
  totalTransferencia?: number;
  totalTarjeta?: number;
  transactionCount: number;
  countIncome: number;
  countExpense: number;
  byCategory: { label: string; total: number; count: number }[];
  byPaymentMethod: { method: string; total: number; count: number }[];
  transactions: CashTransactionWithCreator[];
}

function getUserDisplayName(profile: { full_name?: string | null } | null): string | null {
  return profile?.full_name?.trim() || null;
}

export async function getOpenSessionForDate(dateStr?: string): Promise<CashSessionRow | null> {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from('cash_sessions')
    .select('*')
    .eq('date', date)
    .eq('status', 'open')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CashSessionRow) || null;
}

export async function getSessionByDate(dateStr: string): Promise<CashSessionRow | null> {
  const { data, error } = await supabaseAdmin
    .from('cash_sessions')
    .select('*')
    .eq('date', dateStr)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CashSessionRow) || null;
}

export async function openSession(params: {
  date: string;
  openingAmount: number;
  openedBy: string;
}): Promise<CashSessionRow> {
  if (params.openingAmount < 0) throw new Error('El monto inicial no puede ser negativo');
  const { data: existing } = await supabaseAdmin
    .from('cash_sessions')
    .select('id, status')
    .eq('date', params.date)
    .maybeSingle();
  if (existing) {
    if (existing.status === 'open') throw new Error('Ya existe una caja abierta para esta fecha');
    throw new Error('Ya existe una caja cerrada para esta fecha');
  }
  const { data, error } = await supabaseAdmin
    .from('cash_sessions')
    .insert({
      date: params.date,
      opening_amount: params.openingAmount,
      status: 'open',
      opened_by: params.openedBy,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as CashSessionRow;
}

export async function closeSession(params: {
  sessionId: string;
  closedBy: string;
}): Promise<CashSessionRow> {
  const { data: session, error: fetchErr } = await supabaseAdmin
    .from('cash_sessions')
    .select('*')
    .eq('id', params.sessionId)
    .single();
  if (fetchErr || !session) throw new Error('Sesión no encontrada');
  if ((session as CashSessionRow).status !== 'open') throw new Error('La caja ya está cerrada');

  const { totalIncome, totalExpense } = await getTotalsForSession(params.sessionId);
  const opening = Number((session as CashSessionRow).opening_amount);
  const closingAmount = opening + totalIncome - totalExpense;

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
  return updated as CashSessionRow;
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
    if (row.type === 'income') totalIncome += Number(row.amount);
    else totalExpense += Number(row.amount);
  });
  return { totalIncome, totalExpense };
}

export async function getTodaySummary(): Promise<CashSummary | null> {
  const today = new Date().toISOString().slice(0, 10);
  const session = await getOpenSessionForDate(today);
  if (!session) return null;
  const { totalIncome, totalExpense } = await getTotalsForSession(session.id);
  const opening = Number(session.opening_amount);
  const { count } = await supabaseAdmin
    .from('cash_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('cash_session_id', session.id);
  return {
    sessionId: session.id,
    date: session.date,
    openingAmount: opening,
    totalIncome,
    totalExpense,
    balance: opening + totalIncome - totalExpense,
    status: session.status,
    transactionCount: count ?? 0,
  };
}

export async function addIncome(params: {
  sessionId: string;
  concept: string;
  incomeType: IncomeType;
  amount: number;
  paymentMethod: PaymentMethod;
  notes?: string | null;
  createdBy: string | null;
}): Promise<CashTransactionRow> {
  if (params.amount <= 0) throw new Error('El monto debe ser mayor a 0');
  const { data: session } = await supabaseAdmin
    .from('cash_sessions')
    .select('status')
    .eq('id', params.sessionId)
    .single();
  if (!session || (session as { status: string }).status !== 'open') {
    throw new Error('La caja está cerrada o no existe. No se pueden agregar movimientos.');
  }
  const { data, error } = await supabaseAdmin
    .from('cash_transactions')
    .insert({
      cash_session_id: params.sessionId,
      type: 'income',
      concept: params.concept.trim(),
      income_type: params.incomeType,
      payment_method: params.paymentMethod,
      amount: params.amount,
      notes: params.notes?.trim() || null,
      created_by: params.createdBy,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as CashTransactionRow;
}

export async function addExpense(params: {
  sessionId: string;
  concept: string;
  category: ExpenseCategory;
  amount: number;
  paymentMethod: PaymentMethod;
  notes?: string | null;
  createdBy: string | null;
}): Promise<CashTransactionRow> {
  if (params.amount <= 0) throw new Error('El monto debe ser mayor a 0');
  const { data: session } = await supabaseAdmin
    .from('cash_sessions')
    .select('status')
    .eq('id', params.sessionId)
    .single();
  if (!session || (session as { status: string }).status !== 'open') {
    throw new Error('La caja está cerrada o no existe. No se pueden agregar movimientos.');
  }
  const { data, error } = await supabaseAdmin
    .from('cash_transactions')
    .insert({
      cash_session_id: params.sessionId,
      type: 'expense',
      concept: params.concept.trim(),
      category: params.category,
      payment_method: params.paymentMethod,
      amount: params.amount,
      notes: params.notes?.trim() || null,
      created_by: params.createdBy,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as CashTransactionRow;
}

export async function listTransactionsBySession(sessionId: string): Promise<CashTransactionWithCreator[]> {
  const { data: rows, error } = await supabaseAdmin
    .from('cash_transactions')
    .select('*')
    .eq('cash_session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  const transactions = (rows || []) as CashTransactionRow[];
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
    const sessionsQuery = supabaseAdmin.from('cash_sessions').select('id, date');
    if (params.fromDate) sessionsQuery.gte('date', params.fromDate);
    if (params.toDate) sessionsQuery.lte('date', params.toDate);
    const { data: sessions } = await sessionsQuery;
    const sessionIds = (sessions || []).map((s: { id: string }) => s.id);
    if (sessionIds.length === 0) return { transactions: [], total: 0 };
    query = query.in('cash_session_id', sessionIds);
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
  const transactions = (rows || []) as CashTransactionRow[];
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
  const withCreator = transactions.map((t) => {
    const sess = sessionMap.get(t.cash_session_id);
    return {
      ...t,
      created_by_name: t.created_by ? profiles.get(t.created_by) ?? null : null,
      session_date: sess?.date,
      session_status: sess?.status,
    };
  }) as CashTransactionWithSession[];
  return { transactions: withCreator, total: count ?? 0 };
}

export async function getSessionForClose(sessionId: string): Promise<{
  session: CashSessionWithDetails;
  totalIncome: number;
  totalExpense: number;
  balance: number;
} | null> {
  const { data: session, error } = await supabaseAdmin
    .from('cash_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
  if (error || !session) return null;
  if ((session as CashSessionRow).status !== 'open') return null;
  const { totalIncome, totalExpense } = await getTotalsForSession(sessionId);
  const opening = Number((session as CashSessionRow).opening_amount);
  const balance = opening + totalIncome - totalExpense;
  const { data: openedProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('full_name')
    .eq('id', (session as CashSessionRow).opened_by)
    .single();
  return {
    session: {
      ...(session as CashSessionRow),
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

export async function listSessions(params: {
  fromDate?: string;
  toDate?: string;
  status?: CashSessionStatus;
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
  const limit = Math.min(200, params.limit ?? 50);
  const offset = params.offset ?? 0;
  query = query.range(offset, offset + limit - 1);
  const { data: rows, error, count } = await query;
  if (error) throw new Error(error.message);
  const sessions = (rows || []) as CashSessionRow[];
  const withDetails: CashSessionWithDetails[] = [];
  for (const s of sessions) {
    const { totalIncome, totalExpense } = await getTotalsForSession(s.id);
    const { data: openedProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('full_name')
      .eq('id', s.opened_by)
      .single();
    const { data: closedProfile } = s.closed_by
      ? await supabaseAdmin.from('user_profiles').select('full_name').eq('id', s.closed_by).single()
      : { data: null };
    withDetails.push({
      ...s,
      opened_by_name: getUserDisplayName(openedProfile as { full_name?: string | null } | null),
      closed_by_name: s.closed_by ? getUserDisplayName(closedProfile as { full_name?: string | null } | null) : null,
      total_income: totalIncome,
      total_expense: totalExpense,
      transaction_count: 0,
    });
  }
  return { sessions: withDetails, total: count ?? 0 };
}

export async function getReportByPeriod(
  startDate: string,
  endDate: string
): Promise<CashReportPeriod> {
  const { sessions } = await listSessions({ fromDate: startDate, toDate: endDate, limit: 500 });
  let totalIncome = 0;
  let totalExpense = 0;
  let transactionCount = 0;
  const byDay: CashReportPeriod['sessions'] = [];
  for (const s of sessions) {
    const ti = Number(s.total_income ?? 0);
    const te = Number(s.total_expense ?? 0);
    totalIncome += ti;
    totalExpense += te;
    const { count } = await supabaseAdmin
      .from('cash_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('cash_session_id', s.id);
    transactionCount += count ?? 0;
    const opening = Number(s.opening_amount);
    byDay.push({
      date: s.date,
      totalIncome: ti,
      totalExpense: te,
      balance: opening + ti - te,
      count: count ?? 0,
    });
  }
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
  if (t.type === 'income') return t.income_type ? (INCOME_TYPE_LABELS[t.income_type] ?? t.income_type) : 'Otros';
  return t.category ? (EXPENSE_CATEGORY_LABELS[t.category] ?? t.category) : 'Otros';
}

/** Obtiene todos los datos necesarios para exportar reporte (transacciones + resúmenes). Excluye anulados. */
export async function getReportDataForExport(startDate: string, endDate: string): Promise<CashReportExportData> {
  const { transactions, total } = await listTransactions({
    fromDate: startDate,
    toDate: endDate,
    limit: 5000,
    offset: 0,
  });
  const active = transactions.filter((t) => !t.anulado_at);
  const sorted = [...active].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
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
    const methodKey = t.payment_method === 'efectivo' ? 'efectivo' : t.payment_method === 'transferencia' ? 'transferencia' : 'tarjeta';
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
    curMethod.total += amount;
    curMethod.count += 1;
    methodMap.set(method, curMethod);
  }
  const byCategory = Array.from(categoryMap.entries()).map(([label, v]) => ({ label, total: v.total, count: v.count }));
  const byPaymentMethod = Array.from(methodMap.entries()).map(([method, v]) => ({ method, total: v.total, count: v.count }));
  return {
    startDate,
    endDate,
    totalIncome,
    totalExpense,
    balance: byPaymentNet.efectivo,
    totalEfectivo: byPaymentNet.efectivo,
    totalTransferencia: byPaymentNet.transferencia,
    totalTarjeta: byPaymentNet.tarjeta,
    transactionCount: sorted.length,
    countIncome,
    countExpense,
    byCategory: byCategory.sort((a, b) => b.total - a.total),
    byPaymentMethod: byPaymentMethod.sort((a, b) => b.total - a.total),
    transactions: sorted,
  };
}

/** Estadísticas agregadas por mes (últimos N meses) */
export async function getMonthlyStats(monthsCount: number = 12): Promise<MonthlyStat[]> {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - monthsCount + 1, 1);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  const { sessions } = await listSessions({ fromDate: startStr, toDate: endStr, limit: 500 });
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
    const { count } = await supabaseAdmin
      .from('cash_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('cash_session_id', s.id);
    cur.transactionCount += count ?? 0;
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

/** Alertas de caja: balance negativo, caja de ayer no cerrada, etc. */
export async function getCashAlerts(): Promise<CashAlert[]> {
  const alerts: CashAlert[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);

  const todaySession = await getSessionByDate(today);
  if (!todaySession) {
    alerts.push({
      type: 'no_caja_today',
      severity: 'info',
      message: 'No hay caja abierta para hoy. Abre la caja para registrar movimientos.',
    });
  } else if (todaySession.status === 'open') {
    const { totalIncome, totalExpense } = await getTotalsForSession(todaySession.id);
    const opening = Number(todaySession.opening_amount);
    const balance = opening + totalIncome - totalExpense;
    if (balance < 0) {
      alerts.push({
        type: 'negative_balance',
        severity: 'error',
        message: `La caja de hoy tiene balance negativo. Revisa ingresos y egresos.`,
        date: today,
        sessionId: todaySession.id,
      });
    }
  }

  const yesterdaySession = await getSessionByDate(yesterday);
  if (yesterdaySession && yesterdaySession.status === 'open') {
    alerts.push({
      type: 'yesterday_not_closed',
      severity: 'warning',
      message: 'La caja de ayer no fue cerrada. Se recomienda cerrarla para mantener el control.',
      date: yesterday,
      sessionId: yesterdaySession.id,
    });
  }

  const { sessions: closedSessions } = await listSessions({
    fromDate: new Date(Date.now() - 31 * 864e5).toISOString().slice(0, 10),
    toDate: today,
    status: 'closed',
    limit: 31,
  });
  for (const s of closedSessions) {
    const closing = Number(s.closing_amount);
    if (closing != null && closing < 0) {
      alerts.push({
        type: 'session_negative_balance',
        severity: 'warning',
        message: `Sesión del ${s.date} cerró con balance negativo.`,
        date: s.date,
        sessionId: s.id,
      });
    }
  }

  return alerts;
}

/** Dashboard financiero: resumen del día, últimos 7 días, estadísticas mensuales y alertas */
export async function getFinancialDashboard(): Promise<FinancialDashboard> {
  const summary = await getTodaySummary();
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const report = await getReportByPeriod(sevenDaysAgo, today);
  const monthlyStats = await getMonthlyStats(12);
  const alerts = await getCashAlerts();
  return {
    summary,
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
  const { data: session, error: sessErr } = await supabaseAdmin
    .from('cash_sessions')
    .select('*')
    .eq('id', (tx as CashTransactionRow).cash_session_id)
    .single();
  if (sessErr || !session) return null;
  return { transaction: tx as CashTransactionRow, session: session as CashSessionRow };
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

  const dataBefore = {
    concept: transaction.concept,
    category: transaction.category,
    income_type: transaction.income_type,
    amount: transaction.amount,
    payment_method: transaction.payment_method,
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
  if (payload.payment_method !== undefined) updates.payment_method = payload.payment_method;
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

  return updated as CashTransactionRow;
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

  return updated as CashTransactionRow;
}

/** Genera un buffer Excel del reporte de caja para el período dado */
export async function buildCashReportExcel(startDate: string, endDate: string): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const report = await getReportByPeriod(startDate, endDate);
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
  summarySheet.addRow(['Tipo de reporte', reportType]);
  summarySheet.addRow(['Rango de fechas', `${data.startDate} - ${data.endDate}`]);
  summarySheet.addRow(['Fecha y hora de generación', generatedAt]);
  summarySheet.addRow(['Usuario que generó el reporte', generatedBy]);
  summarySheet.addRow([]);

  summarySheet.addRow(['RESUMEN EJECUTIVO', '']).font = { bold: true };
  summarySheet.addRow(['Total movimientos', data.transactionCount]);
  summarySheet.addRow(['Total ingresos', data.totalIncome]);
  summarySheet.addRow(['Total egresos', data.totalExpense]);
  const balanceRow = summarySheet.addRow(['Balance neto', data.balance]);

  summarySheet.getRow(1).font = { bold: true, size: 14 };
  summarySheet.getRow(10).font = { bold: true };
  summarySheet.getRow(12).getCell(2).numFmt = '#,##0';
  summarySheet.getRow(13).getCell(2).numFmt = '"$"#,##0.00';
  summarySheet.getRow(14).getCell(2).numFmt = '"$"#,##0.00';
  summarySheet.getRow(15).getCell(2).numFmt = '"$"#,##0.00';

  const balanceCell = balanceRow.getCell(2);
  balanceCell.numFmt = '"$"#,##0.00';
  balanceCell.font = { bold: true, size: 12 };
  balanceCell.fill = data.balance >= 0 ? greenFill : redFill;
  balanceRow.height = 24;

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

  movSheet.getColumn(6).numFmt = '"$"#,##0.00';

  // Fila totales finales
  movSheet.addRow([]);
  const totalIngresosRow = movSheet.addRow({
    date: 'TOTAL INGRESOS:',
    type: '',
    concept: '',
    category: '',
    payment: '',
    amount: data.totalIncome,
    user: '',
    notes: '',
  });
  totalIngresosRow.getCell(1).font = { bold: true };
  totalIngresosRow.getCell(6).numFmt = '"$"#,##0.00';
  totalIngresosRow.getCell(6).font = { bold: true, color: { argb: 'FF059669' } };
  const totalEgresosRow = movSheet.addRow({
    date: 'TOTAL EGRESOS:',
    type: '',
    concept: '',
    category: '',
    payment: '',
    amount: -data.totalExpense,
    user: '',
    notes: '',
  });
  totalEgresosRow.getCell(1).font = { bold: true };
  totalEgresosRow.getCell(6).numFmt = '"$"#,##0.00';
  totalEgresosRow.getCell(6).font = { bold: true, color: { argb: 'FFDC2626' } };
  const balanceFinalRow = movSheet.addRow({
    date: 'BALANCE FINAL DE CAJA:',
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
    { label: 'Balance de caja (solo efectivo)', value: `$ ${data.balance.toFixed(2)}`, color: accent },
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
  doc.font('Helvetica-Bold').fillColor(accent).text(`Balance de caja (solo efectivo): $ ${data.balance.toFixed(2)}`, finalLabelX, finalY0 + 102);

  doc.end();
  return finish;
}
