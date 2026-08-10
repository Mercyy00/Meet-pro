// Deno/Edge-Function-compatible: plain functions, no external template lib
// (keeps the function's bundle small and cold-start fast).

export function attendanceSummaryEmail(opts: {
  studentName: string;
  className: string;
  meetingTitle: string;
  attendancePercent: number;
  threshold: number;
}): { subject: string; html: string } {
  return {
    subject: `Attendance alert: ${opts.studentName} — ${opts.className}`,
    html: `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="margin-bottom: 4px;">Attendance summary</h2>
        <p style="color: #666; margin-top: 0;">${opts.className} — ${opts.meetingTitle}</p>
        <p>
          ${opts.studentName}'s attendance is currently
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
  return {
    subject: `Weekly attendance digest — ${opts.className}`,
    html: `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="margin-bottom: 4px;">Weekly attendance digest</h2>
        <p style="color: #666; margin-top: 0;">${opts.className} — ${opts.weekLabel}</p>
        <p>
          ${opts.studentName} attended ${opts.meetingsAttended} of
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
