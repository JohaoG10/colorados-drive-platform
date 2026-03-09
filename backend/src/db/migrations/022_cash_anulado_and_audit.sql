-- Anulación de movimientos (soft delete) y auditoría de cambios en caja
-- Ejecutar después de 021_cash_sessions_and_transactions.sql

-- Columnas de anulación en movimientos (soft delete)
ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS anulado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anulado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS anulado_reason TEXT;

COMMENT ON COLUMN public.cash_transactions.anulado_at IS 'Si no es NULL, el movimiento está anulado y no cuenta en balances';
COMMENT ON COLUMN public.cash_transactions.anulado_reason IS 'Motivo de anulación (obligatorio al anular)';

-- Tabla de auditoría para cambios sensibles en caja
CREATE TABLE IF NOT EXISTS public.cash_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES public.cash_transactions(id) ON DELETE CASCADE,
  cash_session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('edit', 'anulate', 'reopen')),
  data_before JSONB,
  data_after JSONB,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  admin_code_used BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_cash_audit_transaction ON public.cash_audit(transaction_id);
CREATE INDEX IF NOT EXISTS idx_cash_audit_session ON public.cash_audit(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_cash_audit_created_at ON public.cash_audit(created_at DESC);

COMMENT ON TABLE public.cash_audit IS 'Registro de ediciones, anulaciones y cambios autorizados en movimientos de caja';
