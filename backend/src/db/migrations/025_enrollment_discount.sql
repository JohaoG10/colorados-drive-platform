-- Descuentos en inscripción: precio original, descuento aplicado y total final
-- Ejecutar en Supabase SQL Editor.

-- user_profiles: guardar precio original del curso y descuento aplicado al inscribir
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS original_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS discount_applied DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_note TEXT;

-- payments: opcional guardar descuento en el pago inicial para historial claro
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS discount_applied DECIMAL(10,2);

COMMENT ON COLUMN public.user_profiles.original_price IS 'Precio original del curso al momento de inscribir';
COMMENT ON COLUMN public.user_profiles.discount_applied IS 'Descuento en dólares aplicado al inscribir';
COMMENT ON COLUMN public.user_profiles.discount_note IS 'Motivo o descripción del descuento (opcional, para promociones futuras)';
COMMENT ON COLUMN public.payments.discount_applied IS 'Descuento aplicado en este pago (p. ej. pago inicial con descuento)';
