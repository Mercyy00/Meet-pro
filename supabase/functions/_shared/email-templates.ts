// Deno/Edge-Function-compatible: plain functions, no external template lib
// (keeps the function's bundle small and cold-start fast).

function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function attendanceSummaryEmail(opts: {
  studentName: string;
  className: string;
  meetingTitle: string;
  attendancePercent: number;
  threshold: number;
}): { subject: string; html: string } {
  const studentName = escapeHtml(opts.studentName);
  const className = escapeHtml(opts.className);
  const meetingTitle = escapeHtml(opts.meetingTitle);

  return {
    subject: `Attendance alert: ${opts.studentName} — ${opts.className}`,
    html: `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="margin-bottom: 4px;">Attendance summary</h2>
        <p style="color: #666; margin-top: 0;">${className} — ${meetingTitle}</p>
        <p>
          ${studentName}&#039;s attendance is currently
          <strong>${opts.attendancePercent}%</strong>, below the
          ${opts.threshold}% threshold set for this class.
        </p>
        <p style="color: #666; font-size: 13px; margin-top: 24px;">
          Sent automatically by Meet Attendance Pro.
        </p>
      </div>
    `,
  };
}

export function weeklyDigestEmail(opts: {
  studentName: string;
  className: string;
  weekLabel: string;
  meetingsHeld: number;
  meetingsAttended: number;
  attendancePercent: number;
}): { subject: string; html: string } {
  const studentName = escapeHtml(opts.studentName);
  const className = escapeHtml(opts.className);
  const weekLabel = escapeHtml(opts.weekLabel);

  return {
    subject: `Weekly attendance digest — ${opts.className}`,
    html: `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="margin-bottom: 4px;">Weekly attendance digest</h2>
        <p style="color: #666; margin-top: 0;">${className} — ${weekLabel}</p>
        <p>
          ${studentName} attended ${opts.meetingsAttended} of
          ${opts.meetingsHeld} classes this week
          (<strong>${opts.attendancePercent}%</strong>).
        </p>
        <p style="color: #666; font-size: 13px; margin-top: 24px;">
          Sent automatically by Meet Attendance Pro.
        </p>
      </div>
    `,
  };
}
