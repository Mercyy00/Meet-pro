import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const nextStatus = body.status === 'cancelled' ? 'cancelled' : 'ended';

  const { error } = await supabase
    .from('meetings')
    .update({ status: nextStatus })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Any student sessions still "active" for this meeting are closed out too,
  // so the attendance summary email reflects final durations.
  await supabase
    .from('attendance_records')
    .update({ status: 'left', left_at: new Date().toISOString() })
    .eq('meeting_id', params.id)
    .eq('status', 'active');

  return NextResponse.json({ ok: true });
}
