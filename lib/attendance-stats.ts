import type { SupabaseClient } from '@supabase/supabase-js';

// A session "counts" as present if it wasn't abandoned before roughly half
// the meeting happened. Meetings without a scheduled_end fall back to a
// flat 10-minute minimum so a 2-second accidental join doesn't count.
const FALLBACK_MIN_SECONDS = 600;

export type AttendanceRow = {
  meeting_id: string;
  student_id: string;
  total_duration_seconds: number;
  is_late: boolean;
  status: string;
};

export type MeetingRow = {
  id: string;
  class_id: string;
  scheduled_start: string;
  scheduled_end: string | null;
};

function requiredSeconds(meeting: MeetingRow): number {
  if (!meeting.scheduled_end) return FALLBACK_MIN_SECONDS;
  const durationSeconds =
    (new Date(meeting.scheduled_end).getTime() - new Date(meeting.scheduled_start).getTime()) /
    1000;
  return Math.max(durationSeconds * 0.5, FALLBACK_MIN_SECONDS / 2);
}

export function wasPresent(record: AttendanceRow, meeting: MeetingRow): boolean {
  return record.total_duration_seconds >= requiredSeconds(meeting);
}

export type StudentAttendanceSummary = {
  studentId: string;
  fullName: string;
  email: string;
  meetingsHeld: number;
  meetingsAttended: number;
  attendancePercent: number;
  lateCount: number;
  avgDurationSeconds: number;
};

/**
 * Computes per-student attendance % for a class over a window of already-
 * held meetings (scheduled_start in the past). Pulls the three small
 * tables it needs directly rather than a giant join, since the free-tier
 * Postgres instance handles a few small queries better than one heavy one
 * at this data scale.
 */
export async function getClassAttendanceSummary(
  supabase: SupabaseClient,
  classId: string,
  since?: Date,
  until?: Date
): Promise<{ meetings: MeetingRow[]; students: StudentAttendanceSummary[] }> {
  let meetingsQuery = supabase
    .from('meetings')
    .select('id, class_id, scheduled_start, scheduled_end')
    .eq('class_id', classId)
    .lte('scheduled_start', new Date().toISOString())
    .order('scheduled_start', { ascending: true });

  if (since) meetingsQuery = meetingsQuery.gte('scheduled_start', since.toISOString());
  if (until) {
    const endOfDay = new Date(until);
    endOfDay.setHours(23, 59, 59, 999);
    meetingsQuery = meetingsQuery.lte('scheduled_start', endOfDay.toISOString());
  }

  const { data: meetings } = await meetingsQuery;
  const meetingList = (meetings ?? []) as MeetingRow[];

  const { data: enrollments } = await supabase
    .from('class_enrollments')
    .select('student_id, profiles(full_name, email)')
    .eq('class_id', classId);

  const meetingIds = meetingList.map((m) => m.id);
  const { data: records } = meetingIds.length
    ? await supabase
        .from('attendance_records')
        .select('meeting_id, student_id, total_duration_seconds, is_late, status')
        .in('meeting_id', meetingIds)
    : { data: [] as AttendanceRow[] };

  const recordList = (records ?? []) as AttendanceRow[];
  const meetingById = new Map(meetingList.map((m) => [m.id, m]));

  const students: StudentAttendanceSummary[] = (enrollments ?? []).map((e: any) => {
    const studentId = e.student_id;
    const studentRecords = recordList.filter((r) => r.student_id === studentId);

    const attended = studentRecords.filter((r) => {
      const meeting = meetingById.get(r.meeting_id);
      return meeting ? wasPresent(r, meeting) : false;
    });

    const lateCount = studentRecords.filter((r) => r.is_late).length;
    const totalDuration = studentRecords.reduce((sum, r) => sum + r.total_duration_seconds, 0);

    return {
      studentId,
      fullName: e.profiles?.full_name ?? 'Unknown',
      email: e.profiles?.email ?? '',
      meetingsHeld: meetingList.length,
      meetingsAttended: attended.length,
      attendancePercent:
        meetingList.length > 0 ? Math.round((attended.length / meetingList.length) * 100) : 0,
      lateCount,
      avgDurationSeconds:
        studentRecords.length > 0 ? Math.round(totalDuration / studentRecords.length) : 0,
    };
  });

  return { meetings: meetingList, students };
}
