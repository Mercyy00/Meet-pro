# Meet Attendance Pro

Lightweight Google Meet attendance tracker using an **in-app heartbeat
model** (no Google Workspace Meet API / admin access required — works with
personal Google accounts). Student checks in with a join code → app opens
the real Meet link → the app tab pings the server every 30s while it's open
→ server marks them "left" once pings stop.

All phases from the original roadmap are built out in this repo.

## Status

| Phase | Status | Where |
|---|---|---|
| 0 — Schema | ✅ | `supabase/schema.sql` |
| 1 — Auth + scaffold | ✅ | `app/(auth)/*`, `middleware.ts`, `supabase/policies.sql` |
| 2 — Meeting management | ✅ | `app/dashboard/classes`, `app/dashboard/meetings`, `app/api/classes`, `app/api/meetings` |
| 3 — Attendance capture | ✅ | `app/api/attendance/*`, `app/meeting/[id]`, `supabase/functions/sweep-stale-sessions` |
| 4 — Dashboard/analytics | ✅ | `app/dashboard/page.tsx` (at-risk list, overall %), `app/dashboard/classes/[id]` (trend chart, per-student table), `.../students/[studentId]` (heatmap) |
| 5 — Reports/exports | ✅ | `app/dashboard/reports`, `app/api/reports`, `lib/export/*`, `supabase/storage-setup.sql` |
| 6 — Notifications | ✅ | `supabase/functions/send-attendance-summary`, `supabase/functions/send-weekly-digest`, per-class settings in `app/dashboard/classes/[id]/notification-settings.tsx` |
| 7 — Design polish | ✅ | dark mode (`components/theme-toggle.tsx`), micro-animations (`components/motion/*`), loading skeletons (`**/loading.tsx`), mobile nav (`components/dashboard/mobile-nav.tsx`) |
| 8 — Deploy | ✅ | `DEPLOYMENT.md` |
| 9 — Face recognition | 🟥 Intentionally skipped | See note at the bottom |

## Setup

1. **Create a Supabase project.**
2. In the SQL editor, run in this exact order:
   1. `supabase/schema.sql`
   2. `supabase/policies.sql`
   3. `supabase/storage-setup.sql`
   4. `supabase/migrations/phase6_notifications.sql`
3. Enable Google as an OAuth provider under Authentication → Providers (optional — email/password works out of the box).
4. Copy `.env.example` to `.env.local` and fill in your Supabase URL, anon key, and service role key.
5. Install and run:
   ```bash
   npm install
   npm run dev
   ```
6. Sign up as a **Teacher/Admin** first (this creates a new institution). Then have students sign up using that exact institution name.
7. Deploy the three Edge Functions and schedule them with `pg_cron` — see the header comment in each function file, or the consolidated steps in `DEPLOYMENT.md`.
8. For notification emails (Phase 6), set `RESEND_API_KEY` and `NOTIFICATIONS_FROM` as Supabase Edge Function secrets.

When you're ready to ship it, `DEPLOYMENT.md` has the full production checklist.

## How the pieces fit together

**Attendance capture (Phase 3).** `attendance_records` uses a composite PK
on `(meeting_id, student_id)` — a refresh or duplicate join updates the
existing row's heartbeat instead of creating a duplicate session.
`sweep-stale-sessions` (Edge Function on a 1-minute `pg_cron` schedule)
marks anyone with no heartbeat in 90 seconds as `disconnected`, because a
dead client can never tell the server it died — only a server-side sweep
reliably closes those sessions.

**Analytics (Phase 4).** `lib/attendance-stats.ts` is the single source of
truth for "did this student attend this meeting" (present if their tracked
duration covers at least half the scheduled length, or a 10-minute floor
for undated/instant meetings) — the dashboard, class page, student page,
and PDF/Excel reports all call the same function so the numbers never
disagree with each other.

**Reports (Phase 5).** PDF/Excel generation happens **server-side** in
`app/api/reports/route.ts` — `jspdf` and `xlsx` never ship to the browser
bundle, they only run in that one API route.

**Notifications (Phase 6).** Two scheduled Edge Functions:
`send-attendance-summary` fires after a meeting is marked `ended` (via the
"End meeting" button or your own status update) and checks each enrolled
student's trailing-30-day attendance % against the class's configurable
threshold; `send-weekly-digest` runs weekly for any class with the digest
toggle on. Both read `parent_email` first, falling back to the student's
own email if none is set.

**Design (Phase 7).** Charts (`recharts`) and the heatmap are wrapped in
`next/dynamic` with skeleton fallbacks, so the dashboard shell paints
before the analytics libraries load. Dark mode is a plain `.dark` class
toggle persisted to `localStorage`, applied via an inline script in
`app/layout.tsx` before hydration to avoid a flash.

## Notes on face recognition (Phase 9, still a stretch goal)

Unchanged from the original plan: skip it. It's a heavy model download,
unreliable on laptop webcams during a live call, and raises privacy/consent
issues for student-facing software. Only revisit once there's real demand
for it on top of the working heartbeat-based core.
