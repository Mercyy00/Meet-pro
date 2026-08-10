import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

// Student submits the meeting's internal join code. We look up the meeting,
// verify the student is enrolled in its class, then upsert an
// attendance_records row with first_joined_at = now(). If they already have
// a row (rejoining after a refresh), we don't overwrite first_joined_at —
// only last_heartbeat_at gets bumped, matching "handle refresh" from the
// edge-case list.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const joinCode = body?.joinCode;
  if (!joinCode || typeof joinCode !== 'string') {
    return NextResponse.json({ error: 'Join code is required.' }, { status: 400 });
  }

  const { data: meeting, error: meetingError } = await supabase
    .from('meetings')
    .select('id, class_id, meet_url, scheduled_start, late_threshold_minutes, status')
    .eq('join_code', joinCode.trim().toUpperCase())
    .maybeSingle();

  if (meetingError || !meeting) {
    return NextResponse.json({ error: 'Invalid join code.' }, { status: 404 });
  }

  const { data: enrollment } = await supabase
    .from('class_enrollments')
    .select('student_id')
    .eq('class_id', meeting.class_id)
    .eq('student_id', user.id)
    .maybeSingle();

  if (!enrollment) {
    return NextResponse.json(
      { error: "You're not enrolled in this meeting's class." },
      { status: 403 }
    );
  }

  const { data: existing } = await supabase
    .from('attendance_records')
    .select('meeting_id, first_joined_at')
    .eq('meeting_id', meeting.id)
    .eq('student_id', user.id)
    .maybeSingle();

  const now = new Date();

  if (existing) {
    // Rejoin (refresh/double-open): just refresh the heartbeat, keep original join time.
    await supabase
      .from('attendance_records')
      .update({ last_heartbeat_at: now.toISOString(), status: 'active', left_at: null })
      .eq('meeting_id', meeting.id)
      .eq('student_id', user.id);
  } else {
    const minutesLate =
      (now.getTime() - new Date(meeting.scheduled_start).getTime()) / 60000;
    const isLate = minutesLate > meeting.late_threshold_minutes;

    await supabase.from('attendance_records').insert({
      meeting_id: meeting.id,
      student_id: user.id,
      first_joined_at: now.toISOString(),
      last_heartbeat_at: now.toISOString(),
      is_late: isLate,
      status: 'active',
    });
  }

  // Mark the meeting live + stamp actual_start on the very first check-in.
  // Using service role client because normal students do not have UPDATE
  // permissions on meetings table via RLS.
  if (meeting.status === 'scheduled') {
    const serviceRoleClient = createServiceRoleClient();
    await serviceRoleClient
      .from('meetings')
      .update({ status: 'live', actual_start: now.toISOString() })
      .eq('id', meeting.id)
      .is('actual_start', null);
  }

  return NextResponse.json({ meetUrl: meeting.meet_url, meetingId: meeting.id });
}
