-- ============================================================================
-- Phase 7 / Audit RLS Fixes
-- Run this in your Supabase SQL editor to update an existing database.
--
-- 1. Fixes teacher signup (INSERT on institutions was denied by default).
-- 2. Fixes student signup (SELECT on institutions returned NULL before profile
--    creation).
-- 3. Secures helper functions against Postgres search_path hijacking.
-- ============================================================================

-- 1. Secure helper functions with explicit search_path
create or replace function auth_institution_id()
returns uuid
language sql security definer stable
set search_path = public, pg_temp
as $$
  select institution_id from profiles where id = auth.uid();
$$;

create or replace function auth_role()
returns text
language sql security definer stable
set search_path = public, pg_temp
as $$
  select user_role from profiles where id = auth.uid();
$$;

-- 2. Allow anyone to read institutions by name (necessary for student signup
--    institution check before their profile is created).
drop policy if exists "institution members can read their institution" on institutions;
drop policy if exists "institution members or onboarding users can read institutions" on institutions;
drop policy if exists "anyone can read institutions" on institutions;

create policy "anyone can read institutions"
  on institutions for select
  using (true);

-- 3. Allow anyone to create an institution during teacher/admin signup.
drop policy if exists "authenticated users can create an institution on signup" on institutions;
drop policy if exists "anyone can create an institution on signup" on institutions;

create policy "anyone can create an institution on signup"
  on institutions for insert
  with check (true);
