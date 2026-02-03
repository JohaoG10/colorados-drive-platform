-- Add cedula (número de cédula) to user_profiles for identification and search
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS cedula VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_user_profiles_cedula ON user_profiles(cedula);
