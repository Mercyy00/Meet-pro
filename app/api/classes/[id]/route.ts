import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const update: Record<string, unknown> = {};
  if (typeof body.notifyThresholdPercent === 'number') {
    update.notify_threshold_percent = body.notifyThresholdPercent;
  }
  if (typeof body.weeklyDigestEnabled === 'boolean') {
    update.weekly_digest_enabled = body.weeklyDigestEnabled;
  }

  const { error } = await supabase.from('classes').update(update).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
