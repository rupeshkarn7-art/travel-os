import { supabase } from './supabase';

/** Product analytics (PRD §42). Fire-and-forget; never blocks or breaks the UI. */
export function track(name: string, props: Record<string, unknown> = {}) {
  supabase.auth.getSession().then(({ data }) => {
    const uid = data.session?.user.id;
    if (!uid) return;
    supabase
      .from('analytics_events')
      .insert({ user_id: uid, name, props })
      .then(() => {}, () => {});
  }, () => {});
}
