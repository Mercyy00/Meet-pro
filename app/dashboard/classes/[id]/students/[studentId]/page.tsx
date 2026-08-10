import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import LazyAttendanceHeatmap from '@/components/charts/lazy-attendance-heatmap';
import type { HeatmapDay } from '@/components/charts/attendance-heatmap';
import { wasPresent } from '@/lib/attendance-stats';

export default async function StudentDetailPage({
  params,
}: {
  params: { id: string; studentId: string };
}) {
  const supabase = createClient();

  const { data: student } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', params.studentId)
    .single();

  const { data: meetings } = await supabase
    .from('meetings')
    .select('id, scheduled_start, scheduled_end')
    .eq('class_id', params.id)
    .lte('scheduled_start', new Date().toISOString())
    .order('scheduled_start', { ascending: true });

  const meetingList = meetings ?? [];
  const meetingIds = meetingList.map((m) => m.id);

  const { data: records } = meetingIds.length
    ? await supabase
        .from('attendance_records')
        .select('meeting_id, total_duration_seconds')
        .eq('student_id', params.studentId)
        .in('meeting_id', meetingIds)
    : { data: [] };

  const recordByMeeting = new Map((records ?? []).map((r) => [r.meeting_id, r]));

  const heatmapDays: HeatmapDay[] = meetingList.map((m) => {
    const record = recordByMeeting.get(m.id);
    return {
      date: new Date(m.scheduled_start).toLocaleDateString(),
      attended: record ? wasPresent(record as any, m as any) : false,
    };
  });

  const durations = (records ?? []).map((r) => r.total_duration_seconds).filter((d) => d > 0);
  const avgDurationMinutes =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60)
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/classes/${params.id}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to class
        </Link>
        <h1 className="text-2xl font-semibold">{student?.full_name ?? 'Student'}</h1>
        <p className="text-sm text-muted-foreground">{student?.email}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Average session duration</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{avgDurationMinutes} min</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Meetings tracked</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{meetingList.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance history</CardTitle>
        </CardHeader>
        <CardContent>
          {heatmapDays.length > 0 ? (
            <LazyAttendanceHeatmap days={heatmapDays} />
          ) : (
            <p className="text-sm text-muted-foreground">No meetings held yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
