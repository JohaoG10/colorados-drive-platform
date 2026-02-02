/**
 * Seed script: creates initial courses (Tipo A, Tipo B).
 * Run after applying schema.sql in Supabase.
 *
 * To create initial admin user, use Supabase Dashboard or run:
 * npx tsx -e "
 *   const { createClient } = require('@supabase/supabase-js');
 *   const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
 *   supabase.auth.admin.createUser({ email: 'admin@coloradosdrive.com', password: 'ChangeMe123!', email_confirm: true })
 *     .then(r => console.log(r));
 * "
 * Then insert into user_profiles: id (from auth.users), email, full_name, role='admin', course_id=null
 */

import 'dotenv/config';
import { supabaseAdmin } from '../config/supabase';

async function seed() {
  const { data: existing } = await supabaseAdmin.from('courses').select('id');
  if (existing && existing.length > 0) {
    console.log('Courses already exist, skipping seed.');
    return;
  }

  await supabaseAdmin.from('courses').insert([
    { name: 'Curso Tipo A', code: 'MOTO' },
    { name: 'Curso Tipo B', code: 'AUTO' },
  ]);

  console.log('Seeded: Curso Tipo A (MOTO), Curso Tipo B (AUTO)');
}

seed().catch(console.error);
