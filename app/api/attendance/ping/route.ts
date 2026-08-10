import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Called every 30s by the client while the meeting tab is open and focused.
// Runs under the normal user client — RLS's "students update their own
// attendance session" policy is exactly what makes this safe without a
// service-role key.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const meetingId = body?.meetingId;
  if (!meetingId || typeof meetingId !== 'string') {
    return NextResponse.json({ error: 'Meeting ID is required.' }, { status: 400 });
  }

  const { data: record } = await supabase
    .from('attendance_records')
    .select('first_joined_at, total_duration_seconds, last_heartbeat_at, status')
    .eq('meeting_id', meetingId)
    .eq('student_id', user.id)
    .maybeSingle();

  if (!record) {
    return NextResponse.json({ error: 'No active session. Call /join first.' }, { status: 400 });
  }

  const now = new Date();
  const lastHeartbeat = new Date(record.last_heartbeat_at);
  const gapSeconds = (now.getTime() - lastHeartbeat.getTime()) / 1000;

  // Only add to the duration total if the gap looks like a normal 30s tick
  // (guards against a laptop waking from sleep and firing one huge ping).
  const increment = gapSeconds > 0 && gapSeconds < 120 ? Math.round(gapSeconds) : 30;

  const { error } = await supabase
    .from('attendance_records')
    .update({
      last_heartbeat_at: now.toISOString(),
      total_duration_seconds: record.total_duration_seconds + increment,
      status: 'active',
    })
    .eq('meeting_id', meetingId)
    .eq('student_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
