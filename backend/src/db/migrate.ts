/**
 * Migration runner - for local development.
 * Production: run schema.sql directly in Supabase SQL Editor.
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { supabaseAdmin } from '../config/supabase';

async function migrate() {
  const schemaPath = join(__dirname, 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf-8');
  // Supabase JS client doesn't support raw SQL execution for DDL.
  // Use Supabase Dashboard SQL Editor or pg client.
  console.log('Run the following in Supabase SQL Editor:');
  console.log('---');
  console.log(sql);
  console.log('---');
}

migrate().catch(console.error);
