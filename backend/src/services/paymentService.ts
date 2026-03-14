import { supabaseAdmin } from '../config/supabase';

export interface PaymentRow {
  id: string;
  user_id: string;
  amount: number;
  paid_at: string;
  note: string | null;
  discount_applied?: number | null;
  created_by: string | null;
  created_at: string;
}

export async function listPaymentsByUser(userId: string): Promise<PaymentRow[]> {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('id, user_id, amount, paid_at, note, discount_applied, created_by, created_at')
    .eq('user_id', userId)
    .order('paid_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as PaymentRow[];
}

export async function addPayment(params: {
  userId: string;
  amount: number;
  note?: string | null;
  createdBy?: string | null;
}): Promise<PaymentRow> {
  if (params.amount <= 0) throw new Error('El monto debe ser mayor a 0');

  const { data: payment, error: payError } = await supabaseAdmin
    .from('payments')
    .insert({
      user_id: params.userId,
      amount: params.amount,
      note: params.note?.trim() || null,
      created_by: params.createdBy ?? null,
    })
    .select()
    .single();
  if (payError) throw new Error(payError.message);

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('amount_paid, total_amount')
    .eq('id', params.userId)
    .single();

  const currentPaid = profile?.amount_paid != null ? Number(profile.amount_paid) : 0;
  const totalAmount = profile?.total_amount != null ? Number(profile.total_amount) : 0;
  const newPaid = Math.min(currentPaid + params.amount, totalAmount || currentPaid + params.amount);

  const { error: updateError } = await supabaseAdmin
    .from('user_profiles')
    .update({ amount_paid: newPaid })
    .eq('id', params.userId);
  if (updateError) throw new Error(updateError.message);

  return payment as PaymentRow;
}
