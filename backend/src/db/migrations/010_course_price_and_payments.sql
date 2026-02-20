-- Precio por tipo de curso y pagos/abonos por alumno
-- Ejecutar en Supabase SQL Editor después de 009.

-- 1) Precio del curso (por tipo: CURSO TIPO A, CURSO TIPO B)
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) NOT NULL DEFAULT 0;

-- 2) Por alumno: total a pagar (fijado al inscribir según curso) y lo ya abonado
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0;

-- 3) Historial de pagos (cada abono)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments(paid_at DESC);
