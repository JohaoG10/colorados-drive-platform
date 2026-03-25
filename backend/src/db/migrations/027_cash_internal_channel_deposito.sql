-- Canal interno "deposito": sale efectivo del libro origen y se acredita en cuenta bancaria del libro destino.
-- Ejecutar después de 026_cash_dual_book_internal_transfer.sql

ALTER TABLE public.cash_transactions DROP CONSTRAINT IF EXISTS cash_transactions_internal_channel_check;

ALTER TABLE public.cash_transactions
  ADD CONSTRAINT cash_transactions_internal_channel_check
  CHECK (internal_channel IS NULL OR internal_channel IN ('efectivo', 'transferencia', 'deposito'));

COMMENT ON COLUMN public.cash_transactions.internal_channel IS
  'Solo type=internal_transfer: efectivo (caja↔caja), transferencia (cuenta origen), deposito (efectivo origen → banco destino)';
