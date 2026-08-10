-- ============================================================================
-- Meet Attendance Pro — Core Schema
-- Lightweight in-app heartbeat attendance tracking (no Google Workspace
-- Meet API dependency — works with any personal Google account).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- institutions: top-level tenant. Every other table hangs off this so RLS
-- can enforce "you only ever see your own institution's data."
-- ----------------------------------------------------------------------------
create table institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- profiles: 1:1 extension of auth.users. Holds role + institution binding.
-- role is a simple enum kept in a check constraint (cheaper than a full
-- lookup table for an MVP with 2 roles).
-- ----------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  institution_id uuid not null references institutions (id) on delete cascade,
  full_name text not null,
  email text not null,
  user_role text not null check (user_role in ('admin', 'teacher', 'student')),
  parent_email text, -- optional, used for student notification digests
  created_at timestamptz not null default now()
);

create index idx_profiles_institution on profiles (institution_id);
create index idx_profiles_role on profiles (institution_id, user_role);

-- ----------------------------------------------------------------------------
-- classes: a batch/section owned by one teacher within an institution.
-- ----------------------------------------------------------------------------
create table classes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions (id) on delete cascade,
  teacher_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  subject text,
  created_at timestamptz not null default now()
);

create index idx_classes_institution on classes (institution_id);
create index idx_classes_teacher on classes (teacher_id);

-- ----------------------------------------------------------------------------
-- class_enrollments: composite-PK join table, student <-> class.
-- ----------------------------------------------------------------------------
create table class_enrollments (
  class_id uuid not null references classes (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create index idx_enrollments_student on class_enrollments (student_id);

-- ----------------------------------------------------------------------------
-- meetings: a scheduled or instant class session. The actual Meet link is
-- pasted in by the teacher (created manually in Google Calendar/Meet).
-- join_code is a short internal code students type into our app — separate
-- from the Meet URL itself, and how we gate the heartbeat session.
-- ----------------------------------------------------------------------------
create table meetings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes (id) on delete cascade,
  title text not null,
  meet_url text not null,
  join_code text not null unique,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz,
  actual_start timestamptz, -- set when the first student/teacher checks in
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'ended', 'cancelled')),
  late_threshold_minutes int not null default 5,
  created_at timestamptz not null default now()
);

create index idx_meetings_class on meetings (class_id);
create index idx_meetings_status on meetings (status);
create index idx_meetings_join_code on meetings (join_code);

-- ----------------------------------------------------------------------------
-- attendance_records: the heartbeat-tracked session per student per meeting.
-- Composite PK keeps it simple — one row per (meeting, student), continually
-- updated as pings arrive rather than inserting a new row per ping (keeps
-- the table small and free-tier-friendly).
-- ----------------------------------------------------------------------------
create table attendance_records (
  meeting_id uuid not null references meetings (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  first_joined_at timestamptz not null,
  last_heartbeat_at timestamptz not null,
  left_at timestamptz,
  total_duration_seconds int not null default 0,
  is_late boolean not null default false,
  status text not null default 'active'
    check (status in ('active', 'left', 'disconnected')),
  primary key (meeting_id, student_id)
);

create index idx_attendance_student on attendance_records (student_id);
create index idx_attendance_meeting on attendance_records (meeting_id);
-- Powers the "mark as left after 90s of silence" sweep efficiently.
create index idx_attendance_active_heartbeat
  on attendance_records (last_heartbeat_at)
  where status = 'active';

-- ----------------------------------------------------------------------------
-- reports: metadata for generated exports (PDF/Excel), file stored in
-- Supabase Storage; this row just tracks the signed-URL-able path.
-- ----------------------------------------------------------------------------
create table reports (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions (id) on delete cascade,
  class_id uuid references classes (id) on delete set null,
  generated_by uuid not null references profiles (id) on delete cascade,
  range_start date not null,
  range_end date not null,
  file_path text not null, -- path within the 'reports' storage bucket
  file_type text not null check (file_type in ('pdf', 'xlsx')),
  created_at timestamptz not null default now()
);

create index idx_reports_institution on reports (institution_id);
