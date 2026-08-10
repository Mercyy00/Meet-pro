-- ============================================================================
-- Storage setup for Phase 5 (Reports & Exports) — run after policies.sql.
-- Creates a private 'reports' bucket and scopes access by institution_id,
-- which we encode as the first path segment of every uploaded file
-- (see app/api/reports/route.ts: `${institution_id}/${classId}/${ts}.ext`).
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

create policy "staff read reports in their institution"
  on storage.objects for select
  using (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = auth_institution_id()::text
    and auth_role() in ('admin', 'teacher')
  );

create policy "staff upload reports for their institution"
  on storage.objects for insert
  with check (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = auth_institution_id()::text
    and auth_role() in ('admin', 'teacher')
  );

create policy "staff delete reports for their institution"
  on storage.objects for delete
  using (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = auth_institution_id()::text
    and auth_role() in ('admin', 'teacher')
  );
