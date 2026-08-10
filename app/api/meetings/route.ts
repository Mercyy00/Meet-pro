import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function generateJoinCode(): string {
  // Short, human-typeable code, e.g. "K7QX-3P".
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${part()}-${part().slice(0, 2)}`;
}

export async function GET(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const classId = searchParams.get('classId');

  let query = supabase
    .from('meetings')
    .select('id, title, meet_url, join_code, scheduled_start, status, class_id')
    .order('scheduled_start', { ascending: false });

  if (classId) query = query.eq('class_id', classId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ meetings: data });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { classId, title, meetUrl, scheduledStart, scheduledEnd, lateThresholdMinutes } = body as {
    classId: string;
    title: string;
    meetUrl: string;
    scheduledStart: string;
    scheduledEnd?: string;
    lateThresholdMinutes?: number;
  };

  // Retry a couple times in the rare event of a join_code collision.
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from('meetings')
      .insert({
        class_id: classId,
        title,
        meet_url: meetUrl,
        join_code: generateJoinCode(),
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd ?? null,
        late_threshold_minutes: lateThresholdMinutes ?? 5,
      })
      .select('id, join_code')
      .single();

    if (!error && data) return NextResponse.json({ meeting: data });
    lastError = error?.message ?? 'Unknown error';
    if (!lastError.includes('duplicate')) break;
  }

  return NextResponse.json({ error: lastError }, { status: 400 });
}
