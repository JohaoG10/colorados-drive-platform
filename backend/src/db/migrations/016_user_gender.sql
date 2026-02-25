-- Género del usuario (Masculino/Femenino) para reportes y descargas.
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS gender VARCHAR(20);

COMMENT ON COLUMN public.user_profiles.gender IS 'masculino o femenino; se usa en descargas (ej. SEXO en Legalización permisos)';
