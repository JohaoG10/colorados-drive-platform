import { supabaseAdmin } from '../config/supabase';

export async function upsertActivity(userId: string, data?: { totalTimeSeconds?: number; contentId?: string }) {
  const { data: existing } = await supabaseAdmin
    .from('user_activity')
    .select('id, total_time_seconds, contents_viewed')
    .eq('user_id', userId)
    .single();

  const totalSeconds = (existing?.total_time_seconds ?? 0) + (data?.totalTimeSeconds ?? 0);
  const contentsViewed = (existing?.contents_viewed as string[]) ?? [];
  const newViewed = data?.contentId && !contentsViewed.includes(data.contentId)
    ? [...contentsViewed, data.contentId]
    : contentsViewed;

  const { error } = await supabaseAdmin.from('user_activity').upsert(
    {
      user_id: userId,
      last_active_at: new Date().toISOString(),
      total_time_seconds: totalSeconds,
      contents_viewed: newViewed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) throw new Error(error.message);
}

export async function getActivity(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('user_activity')
    .select('last_active_at, total_time_seconds, contents_viewed')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data;
}
