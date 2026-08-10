import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Called via navigator.sendBeacon on beforeunload/visibilitychange-hidden,
// so the browser can fire it reliably even as the tab is closing. This is
// the "clean" leave path; the sweep cron (see
// supabase/functions/sweep-stale-sessions) is the fallback for laptops that
// close/lose network without firing this at all.
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
  const now = new Date();

  const { error } = await supabase
    .from('attendance_records')
    .update({ status: 'left', left_at: now.toISOString() })
    .eq('meeting_id', meetingId)
    .eq('student_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
