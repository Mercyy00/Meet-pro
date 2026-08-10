-- ============================================================================
-- Phase 6 additions — run after schema.sql/policies.sql.
-- Adds per-class notification config and a summary_sent flag so the
-- post-meeting email sweep doesn't double-send.
-- ============================================================================

alter table classes
  add column if not exists notify_threshold_percent int not null default 75,
  add column if not exists weekly_digest_enabled boolean not null default false;

alter table meetings
  add column if not exists summary_sent boolean not null default false;

create index if not exists idx_meetings_pending_summary
  on meetings (status)
  where status = 'ended' and summary_sent = false;
