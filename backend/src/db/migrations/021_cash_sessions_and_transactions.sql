-- Módulo Caja: sesiones diarias y movimientos (ingresos/egresos)
-- Ejecutar en Supabase SQL Editor después de 020.

-- Sesiones de caja (una por día; apertura/cierre)
CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  opening_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
  closing_amount DECIMAL(12,2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_date ON public.cash_sessions(date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON public.cash_sessions(status);

-- Movimientos de caja (ingresos y egresos)
CREATE TABLE IF NOT EXISTS public.cash_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cash_session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  concept TEXT NOT NULL,
  category TEXT,
  income_type TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('efectivo', 'transferencia', 'tarjeta')),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_session ON public.cash_transactions(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_created_at ON public.cash_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_type ON public.cash_transactions(type);

COMMENT ON TABLE public.cash_sessions IS 'Apertura/cierre de caja por día';
COMMENT ON TABLE public.cash_transactions IS 'Ingresos y egresos registrados en una sesión de caja';
