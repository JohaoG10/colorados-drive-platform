import { supabaseAdmin } from '../config/supabase';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const BUCKET = 'colorados-drive';

/** Tipo de archivo subido por Multer (compatible con @types/multer) */
export type MulterFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

/**
 * Upload file to Supabase Storage and return public URL.
 * Create bucket "colorados-drive" in Supabase Dashboard (Storage) with public access.
 */
export async function uploadFile(
  file: MulterFile,
  folder: 'contents' | 'questions'
): Promise<string> {
  const ext = path.extname(file.originalname) || '.bin';
  const filename = `${folder}/${uuidv4()}${ext}`;

  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(filename, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });

  if (error) throw new Error(error.message);

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filename);
  return publicUrl;
}
