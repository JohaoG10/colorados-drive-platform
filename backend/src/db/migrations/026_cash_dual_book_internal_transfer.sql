-- Caja dual: Escuela + DRA, destino de fondos y transferencias internas (no son egresos operativos).
-- Ejecutar después de 022_cash_anulado_and_audit.sql

-- 1) Sesiones: una por (fecha, libro)
ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS cash_book TEXT NOT NULL DEFAULT 'escuela'
  CHECK (cash_book IN ('escuela', 'dra'));

ALTER TABLE public.cash_sessions DROP CONSTRAINT IF EXISTS cash_sessions_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_sessions_date_book ON public.cash_sessions (date, cash_book);

COMMENT ON COLUMN public.cash_sessions.cash_book IS 'escuela | dra: caja separada por entidad';

-- 2) Movimientos: libro, destino de fondos, transferencias internas
ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS cash_book TEXT NOT NULL DEFAULT 'escuela'
  CHECK (cash_book IN ('escuela', 'dra'));

ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS funds_destination TEXT NULL;

ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS internal_from_book TEXT NULL
  CHECK (internal_from_book IS NULL OR internal_from_book IN ('escuela', 'dra'));

ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS internal_to_book TEXT NULL
  CHECK (internal_to_book IS NULL OR internal_to_book IN ('escuela', 'dra'));

ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS internal_channel TEXT NULL
  CHECK (internal_channel IS NULL OR internal_channel IN ('efectivo', 'transferencia'));

ALTER TABLE public.cash_transactions DROP CONSTRAINT IF EXISTS cash_transactions_type_check;

ALTER TABLE public.cash_transactions
  ADD CONSTRAINT cash_transactions_type_check
  CHECK (type IN ('income', 'expense', 'internal_transfer'));

ALTER TABLE public.cash_transactions
  ADD CONSTRAINT cash_tx_internal_transfer_fields CHECK (
    type <> 'internal_transfer'
    OR (
      internal_from_book IS NOT NULL
      AND internal_to_book IS NOT NULL
      AND internal_channel IS NOT NULL
      AND internal_from_book <> internal_to_book
    )
  );

ALTER TABLE public.cash_transactions
  ADD CONSTRAINT cash_tx_non_internal_no_internal_fields CHECK (
    type = 'internal_transfer'
    OR (
      internal_from_book IS NULL
      AND internal_to_book IS NULL
      AND internal_channel IS NULL
    )
  );

COMMENT ON COLUMN public.cash_transactions.cash_book IS 'Libro contable del movimiento (sesión del mismo libro salvo reglas de transferencia interna)';
COMMENT ON COLUMN public.cash_transactions.funds_destination IS 'Cuenta/bolsillo: trans_* / efectivo_* (tarjeta = NULL, siempre escuela)';
COMMENT ON COLUMN public.cash_transactions.internal_from_book IS 'Solo type=internal_transfer: origen';
COMMENT ON COLUMN public.cash_transactions.internal_to_book IS 'Solo type=internal_transfer: destino';
COMMENT ON COLUMN public.cash_transactions.internal_channel IS 'Solo type=internal_transfer: efectivo o transferencia movida';
