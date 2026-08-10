import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Handles the redirect back from Google OAuth, exchanges the code for a
// session, then sends the user on to the dashboard. If this is their very
// first login (no profiles row yet), send them to a short onboarding step
// instead of straight to the dashboard so they can pick a role/institution.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!profile) {
        return NextResponse.redirect(`${origin}/signup?complete=1`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
