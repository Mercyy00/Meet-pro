// Supabase Edge Function: send-weekly-digest
//
// Run once a week via pg_cron (e.g. Monday 07:00). Sends a per-student
// weekly summary for every class with weekly_digest_enabled = true.
//
// Schedule:
//
//   select cron.schedule(
//     'send-weekly-digest',
//     '0 7 * * 1', -- 07:00 every Monday
//     $$
//     select net.http_post(
//       url := 'https://YOUR-PROJECT.functions.supabase.co/send-weekly-digest',
//       headers := jsonb_build_object('Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY')
//     );
//     $$
//   );

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { weeklyDigestEmail } from '../_shared/email-templates.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM_ADDRESS = Deno.env.get('NOTIFICATIONS_FROM') ?? 'attendance@yourdomain.com';

async function sendEmail(to: string, subject: string, html: string) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
  });
}

function getRequiredSeconds(m: { scheduled_start: string; scheduled_end?: string | null }): number {
  if (!m.scheduled_end) return 300;
  const durationSeconds = (new Date(m.scheduled_end).getTime() - new Date(m.scheduled_start).getTime()) / 1000;
  return Math.max(durationSeconds * 0.5, 300);
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  const expectedKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');
  if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekLabel = `${weekAgo.toLocaleDateString()} — ${new Date().toLocaleDateString()}`;

  const { data: digestClasses } = await supabase
    .from('classes')
    .select('id, name')
    .eq('weekly_digest_enabled', true);

  let sent = 0;

  for (const klass of digestClasses ?? []) {
    const { data: heldMeetings } = await supabase
      .from('meetings')
      .select('id, scheduled_start, scheduled_end')
      .eq('class_id', klass.id)
      .gte('scheduled_start', weekAgo.toISOString())
      .lte('scheduled_start', new Date().toISOString());

    const heldList = heldMeetings ?? [];
    const heldIds = heldList.map((m) => m.id);
    const meetingMap = new Map(heldList.map((m) => [m.id, m]));
    if (heldIds.length === 0) continue;

    const { data: enrollments } = await supabase
      .from('class_enrollments')
      .select('student_id, profiles(full_name, parent_email, email)')
      .eq('class_id', klass.id);

    const { data: records } = await supabase
      .from('attendance_records')
      .select('student_id, meeting_id, total_duration_seconds')
      .in('meeting_id', heldIds);

    for (const enrollment of enrollments ?? []) {
      const profile = (enrollment as any).profiles;
      const recipient = profile?.parent_email || profile?.email;
      if (!recipient) continue;

      const studentRecords = (records ?? []).filter((r) => r.student_id === enrollment.student_id);
      const attended = studentRecords.filter((r) => {
        const m = meetingMap.get(r.meeting_id);
        return m && r.total_duration_seconds >= getRequiredSeconds(m);
      }).length;
      const percent = Math.round((attended / heldIds.length) * 100);

      const { subject, html } = weeklyDigestEmail({
        studentName: profile.full_name,
        className: klass.name,
        weekLabel,
        meetingsHeld: heldIds.length,
        meetingsAttended: attended,
        attendancePercent: percent,
      });
      await sendEmail(recipient, subject, html);
      sent++;
    }
  }

  return new Response(JSON.stringify({ classesProcessed: digestClasses?.length ?? 0, emailsSent: sent }), {
    status: 200,
  });
});
