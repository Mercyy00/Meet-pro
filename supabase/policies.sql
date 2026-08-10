-- ============================================================================
-- Row Level Security — run AFTER schema.sql
-- Rule of thumb: teachers/admins see everything within their institution;
-- students see only their own enrollments/attendance; nobody crosses
-- institution_id boundaries.
-- ============================================================================

alter table institutions enable row level security;
alter table profiles enable row level security;
alter table classes enable row level security;
alter table class_enrollments enable row level security;
alter table meetings enable row level security;
alter table attendance_records enable row level security;
alter table reports enable row level security;

-- Helper: current user's institution_id and role, without recursive RLS
-- lookups on profiles (security definer avoids infinite recursion).
create or replace function auth_institution_id()
returns uuid
language sql security definer stable
as $$
  select institution_id from profiles where id = auth.uid();
$$;

create or replace function auth_role()
returns text
language sql security definer stable
as $$
  select user_role from profiles where id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- institutions: readable by any authenticated member of that institution.
-- ----------------------------------------------------------------------------
create policy "institution members can read their institution"
  on institutions for select
  using (id = auth_institution_id());

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create policy "users can read their own profile"
  on profiles for select
  using (id = auth.uid());

create policy "staff can read profiles in their institution"
  on profiles for select
  using (
    institution_id = auth_institution_id()
    and auth_role() in ('admin', 'teacher')
  );

create policy "users can update their own profile"
  on profiles for update
  using (id = auth.uid());

create policy "users can insert their own profile on signup"
  on profiles for insert
  with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- classes: teachers manage their own classes; students only read classes
-- they're enrolled in.
-- ----------------------------------------------------------------------------
create policy "teachers manage own classes"
  on classes for all
  using (
    institution_id = auth_institution_id()
    and (auth_role() = 'admin' or teacher_id = auth.uid())
  )
  with check (
    institution_id = auth_institution_id()
    and (auth_role() = 'admin' or teacher_id = auth.uid())
  );

create policy "students read classes they're enrolled in"
  on classes for select
  using (
    id in (
      select class_id from class_enrollments where student_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- class_enrollments
-- ----------------------------------------------------------------------------
create policy "teachers manage enrollments for their classes"
  on class_enrollments for all
  using (
    class_id in (
      select id from classes
      where institution_id = auth_institution_id()
        and (auth_role() = 'admin' or teacher_id = auth.uid())
    )
  )
  with check (
    class_id in (
      select id from classes
      where institution_id = auth_institution_id()
        and (auth_role() = 'admin' or teacher_id = auth.uid())
    )
  );

create policy "students read their own enrollments"
  on class_enrollments for select
  using (student_id = auth.uid());

-- ----------------------------------------------------------------------------
-- meetings: scoped through the parent class.
-- ----------------------------------------------------------------------------
create policy "teachers manage meetings for their classes"
  on meetings for all
  using (
    class_id in (
      select id from classes
      where institution_id = auth_institution_id()
        and (auth_role() = 'admin' or teacher_id = auth.uid())
    )
  )
  with check (
    class_id in (
      select id from classes
      where institution_id = auth_institution_id()
        and (auth_role() = 'admin' or teacher_id = auth.uid())
    )
  );

create policy "students read meetings for classes they're enrolled in"
  on meetings for select
  using (
    class_id in (
      select class_id from class_enrollments where student_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- attendance_records: students see + create only their own rows; teachers
-- see all rows for meetings under their classes.
-- ----------------------------------------------------------------------------
create policy "students read their own attendance"
  on attendance_records for select
  using (student_id = auth.uid());

create policy "students insert their own attendance session"
  on attendance_records for insert
  with check (
    student_id = auth.uid()
    and meeting_id in (
      select m.id from meetings m
      join class_enrollments ce on ce.class_id = m.class_id
      where ce.student_id = auth.uid()
    )
  );

create policy "students update their own attendance session"
  on attendance_records for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "teachers read attendance for their classes"
  on attendance_records for select
  using (
    meeting_id in (
      select m.id from meetings m
      join classes c on c.id = m.class_id
      where c.institution_id = auth_institution_id()
        and (auth_role() = 'admin' or c.teacher_id = auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- reports
-- ----------------------------------------------------------------------------
create policy "staff manage reports in their institution"
  on reports for all
  using (
    institution_id = auth_institution_id()
    and auth_role() in ('admin', 'teacher')
  )
  with check (
    institution_id = auth_institution_id()
    and auth_role() in ('admin', 'teacher')
  );

-- ============================================================================
-- NOTE on the ping route: because a student's own UPDATE policy only lets
-- them touch their own row, the heartbeat endpoint can safely run with the
-- regular (anon/user) Supabase client — no service role key needed there.
-- The service role key is only used server-side for the "sweep stale
-- sessions to 'left'" job, which must update rows across students.
-- ============================================================================
