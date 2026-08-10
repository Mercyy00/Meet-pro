// Supabase Edge Function: sweep-stale-sessions
//
// WHY AN EDGE FUNCTION + pg_cron INSTEAD OF A CLIENT-SIDE TIMEOUT:
// The client can't be trusted to reliably tell the server "I've gone dark"
// — a laptop that loses power or network mid-class never gets to fire that
// signal. A server-side sweep is the only reliable way to close out those
// sessions. Two free-tier-friendly options exist:
//   1. pg_cron (built into Supabase Postgres) calling this function every
//      minute via `net.http_post` — simplest, no external scheduler needed.
//   2. A separate always-on cron service (e.g. GitHub Actions on a schedule)
//      hitting this function's URL.
// Option 1 is recommended here: it's one SQL statement to wire up (see
// below) and needs no extra infra beyond what Supabase already gives you
// for free.
//
// Schedule with (run once in the Supabase SQL editor, after deploying this
// function):
//
//   select cron.schedule(
//     'sweep-stale-attendance',
//     '* * * * *', -- every minute
//     $$
//     select net.http_post(
//       url := 'https://YOUR-PROJECT.functions.supabase.co/sweep-stale-sessions',
//       headers := jsonb_build_object('Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY')
//     );
//     $$
//   );

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STALE_THRESHOLD_SECONDS = 90;

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('SERVICE_ROLE_KEY')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const cutoff = new Date(Date.now() - STALE_THRESHOLD_SECONDS * 1000).toISOString();

  const { data: stale, error: fetchError } = await supabase
    .from('attendance_records')
    .select('meeting_id, student_id, last_heartbeat_at')
    .eq('status', 'active')
    .lt('last_heartbeat_at', cutoff);

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }

  if (!stale || stale.length === 0) {
    return new Response(JSON.stringify({ swept: 0 }), { status: 200 });
  }

  const { error: updateError } = await supabase
    .from('attendance_records')
    .update({ status: 'disconnected', left_at: new Date().toISOString() })
    .eq('status', 'active')
    .lt('last_heartbeat_at', cutoff);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ swept: stale.length }), { status: 200 });
});
