# Deployment Checklist — Meet Attendance Pro

## 1. Environment variables (Vercel → Project Settings → Environment Variables)

| Variable | Where it's used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Public, safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Public, RLS protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | server only (`lib/supabase/server.ts` service client, edge functions) | **Never** prefix with `NEXT_PUBLIC_`, never send to the browser |
| Google OAuth Client ID/Secret | Supabase Auth → Providers → Google, not this app directly | Set in the Supabase dashboard, not Vercel |
| `RESEND_API_KEY` | Supabase Edge Functions only (Phase 6) | Set via `supabase secrets set`, not Vercel |
| `NOTIFICATIONS_FROM` | Edge Functions | e.g. `attendance@yourdomain.com`, must be a Resend-verified sender |

Set each for Production, Preview, and Development environments in Vercel — a
mismatched anon key between Preview and Production is the most common
"works locally, breaks on deploy" bug with Supabase apps.

## 2. Supabase production setup

- [ ] Run `supabase/schema.sql`, then `supabase/policies.sql`, then
      `supabase/storage-setup.sql`, then
      `supabase/migrations/phase6_notifications.sql`, in that order, in the
      SQL editor of your **production** Supabase project (not just the dev
      one you built against).
- [ ] **RLS policy review**: confirm RLS is enabled on all 7 tables (schema
      shows `alter table ... enable row level security` per table — verify
      in Database → Tables → each table's RLS toggle is on). A table with
      no RLS enabled is world-readable via the anon key.
- [ ] Confirm the `reports` Storage bucket exists and is **private**
      (`public: false` — already set in `storage-setup.sql`).
- [ ] Deploy the two Edge Functions:
  ```bash
  supabase functions deploy sweep-stale-sessions
  supabase functions deploy send-attendance-summary
  supabase functions deploy send-weekly-digest
  supabase secrets set RESEND_API_KEY=your_key SERVICE_ROLE_KEY=your_service_role_key
  ```
- [ ] Schedule all three with `pg_cron` (SQL snippets are in each function's
      header comment) — without this, stale sessions never close and
      notification emails never send.
- [ ] **Connection pooling**: this app talks to Supabase entirely through
      the REST/PostgREST layer (`@supabase/supabase-js`), not raw Postgres
      connections, so Vercel's serverless functions don't need PgBouncer
      configuration — this is only a concern if you later add direct
      `pg`/Prisma connections from a route handler.

## 3. Vercel deployment

1. Import the repo, framework preset auto-detects Next.js.
2. Build command: `next build` (default). Output: `.next` (default).
3. `next.config.js` already sets a 256kb body size limit for Server
   Actions, appropriate for the small JSON payloads this app sends
   (heartbeat pings, form submits) — no change needed for cold-start
   performance beyond that.
4. After first deploy, add your production URL to Supabase Auth →
   URL Configuration → Redirect URLs (needed for the Google OAuth
   callback at `/auth/callback` to work).
5. Bundle-size note: `jspdf`/`jspdf-autotable`/`xlsx` are only imported
   inside `app/api/reports/route.ts` (a server route), and `recharts` is
   only loaded via the `next/dynamic` wrappers in `components/charts/` — so
   none of these inflate the client bundle for pages that don't use them.

## 4. Free-tier-friendly monitoring

- [ ] Vercel → Project → Observability tab: built-in, no setup, shows
      function errors and latency for free.
- [ ] Supabase → Project → Logs & Reports: free tier includes API request
      logs and a basic error rate view — check here first if attendance
      pings start failing.
- [ ] Supabase → Database → Cron: confirm the three scheduled jobs show
      recent successful runs (a silently-failing sweep job is the most
      likely "attendance numbers look wrong" root cause).
- [ ] Optional: a free [UptimeRobot](https://uptimerobot.com) monitor on
      your production URL for basic up/down alerting.
