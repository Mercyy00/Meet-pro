// Supabase Edge Function: send-attendance-summary
//
// Run on a schedule (every few minutes) via pg_cron, same pattern as
// sweep-stale-sessions. Finds meetings with status='ended' and
// summary_sent=false, computes each enrolled student's attendance % for
// that meeting's class over the trailing 30 days, and emails
// profiles.parent_email for anyone under the class's notify_threshold_percent.
//
// Schedule (run once in the SQL editor after deploying):
//
//   select cron.schedule(
//     'send-attendance-summaries',
//     '*/5 * * * *', -- every 5 minutes
//     $$
//     select net.http_post(
//       url := 'https://YOUR-PROJECT.functions.supabase.co/send-attendance-summary',
//       headers := jsonb_build_object('Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY')
//     );
//     $$
//   );
//
// Requires a RESEND_API_KEY secret set on the function
// (supabase secrets set RESEND_API_KEY=...).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { attendanceSummaryEmail } from '../_shared/email-templates.ts';

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

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('SERVICE_ROLE_KEY')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: pendingMeetings } = await supabase
    .from('meetings')
    .select('id, title, class_id, classes(name, notify_threshold_percent)')
    .eq('status', 'ended')
    .eq('summary_sent', false);

  let sent = 0;

  for (const meeting of pendingMeetings ?? []) {
    const klass = (meeting as any).classes;
    const threshold = klass?.notify_threshold_percent ?? 75;

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data: heldMeetings } = await supabase
      .from('meetings')
      .select('id')
      .eq('class_id', meeting.class_id)
      .gte('scheduled_start', since.toISOString())
      .lte('scheduled_start', new Date().toISOString());

    const heldIds = (heldMeetings ?? []).map((m) => m.id);

    const { data: enrollments } = await supabase
      .from('class_enrollments')
      .select('student_id, profiles(full_name, parent_email, email)')
      .eq('class_id', meeting.class_id);

    const { data: records } = heldIds.length
      ? await supabase
          .from('attendance_records')
          .select('student_id, meeting_id, total_duration_seconds')
          .in('meeting_id', heldIds)
      : { data: [] };

    for (const enrollment of enrollments ?? []) {
      const profile = (enrollment as any).profiles;
      const recipient = profile?.parent_email || profile?.email;
      if (!recipient) continue;

      const studentRecords = (records ?? []).filter((r) => r.student_id === enrollment.student_id);
      const attended = studentRecords.filter((r) => r.total_duration_seconds >= 300).length;
      const percent = heldIds.length > 0 ? Math.round((attended / heldIds.length) * 100) : 100;

      if (percent < threshold) {
        const { subject, html } = attendanceSummaryEmail({
          studentName: profile.full_name,
          className: klass?.name ?? 'Class',
          meetingTitle: meeting.title,
          attendancePercent: percent,
          threshold,
        });
        await sendEmail(recipient, subject, html);
        sent++;
      }
    }

    await supabase.from('meetings').update({ summary_sent: true }).eq('id', meeting.id);
  }

  return new Response(JSON.stringify({ meetingsProcessed: pendingMeetings?.length ?? 0, emailsSent: sent }), {
    status: 200,
  });
});
