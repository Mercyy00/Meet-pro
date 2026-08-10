import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requireSupabaseConfig, getSupabaseUrl } from './env';

export function createClient() {
  const cookieStore = cookies();

  const { url, anonKey } = requireSupabaseConfig();

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component — safe to ignore because
            // middleware refreshes the session on every request.
          }
        },
      },
    }
  );
}

// Service-role client — server-only, bypasses RLS. Used exclusively by the
// stale-session sweep (marking abandoned heartbeats as "left") or system state updates. Never import
// this from a Client Component.
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createServiceRoleClient() {
  const url = getSupabaseUrl();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createSupabaseClient(
    url,
    serviceKey,
    { auth: { persistSession: false } }
  );
}
