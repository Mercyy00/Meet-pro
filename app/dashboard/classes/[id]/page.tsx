import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getClassAttendanceSummary } from '@/lib/attendance-stats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import LazyAttendanceTrendChart from '@/components/charts/lazy-attendance-trend-chart';
import type { TrendPoint } from '@/components/charts/attendance-trend-chart';
import ClassRangeToggle from './range-toggle';
import NotificationSettings from './notification-settings';

export default async function ClassAnalyticsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { range?: string };
}) {
  const supabase = createClient();
  const range = searchParams.range === 'monthly' ? 'monthly' : 'weekly';

  const { data: klass } = await supabase
    .from('classes')
    .select('name, subject, notify_threshold_percent, weekly_digest_enabled')
    .eq('id', params.id)
    .single();

  const since = new Date();
  since.setDate(since.getDate() - (range === 'weekly' ? 8 * 7 : 6 * 30)); // 8 weeks or 6 months back

  const { meetings, students } = await getClassAttendanceSummary(supabase, params.id, since);

  // Build trend points by bucketing meetings into weeks or months, and
  // computing the % of enrolled students who attended each bucket's
  // meetings (average across meetings in that bucket).
  const buckets = new Map<string, { attended: number; total: number }>();

  for (const meeting of meetings) {
    const d = new Date(meeting.scheduled_start);
    const label =
      range === 'weekly'
        ? `Wk of ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
        : d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });

    if (!buckets.has(label)) buckets.set(label, { attended: 0, total: 0 });
  }

  // Re-fetch per-meeting attendance counts to populate buckets (small query,
  // fine at this scale — avoids overcomplicating attendance-stats.ts).
  const { data: allRecords } = meetings.length
    ? await supabase
        .from('attendance_records')
        .select('meeting_id, total_duration_seconds')
        .in(
          'meeting_id',
          meetings.map((m) => m.id)
        )
    : { data: [] };

  const { count: enrollmentCount } = await supabase
    .from('class_enrollments')
    .select('student_id', { count: 'exact', head: true })
    .eq('class_id', params.id);
  const enrolledCount = enrollmentCount ?? students.length;

  for (const meeting of meetings) {
    const d = new Date(meeting.scheduled_start);
    const label =
      range === 'weekly'
        ? `Wk of ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
        : d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });

    const presentCount = (allRecords ?? []).filter(
      (r: any) => r.meeting_id === meeting.id && r.total_duration_seconds >= 300
    ).length;

    const bucket = buckets.get(label)!;
    bucket.attended += presentCount;
    bucket.total += Math.max(enrolledCount, 1);
  }

  const trendData: TrendPoint[] = Array.from(buckets.entries()).map(([label, v]) => ({
    label,
    attendancePercent: v.total > 0 ? Math.round((v.attended / v.total) * 100) : 0,
  }));

  const sortedStudents = [...students].sort((a, b) => b.attendancePercent - a.attendancePercent);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/classes" className="text-sm text-muted-foreground hover:underline">
            ← All classes
          </Link>
          <h1 className="text-2xl font-semibold">{klass?.name ?? 'Class'}</h1>
          <p className="text-sm text-muted-foreground">{klass?.subject}</p>
        </div>
        <ClassRangeToggle current={range} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance trend</CardTitle>
        </CardHeader>
        <CardContent>
          {trendData.length > 0 ? (
            <LazyAttendanceTrendChart data={trendData} />
          ) : (
            <p className="text-sm text-muted-foreground">No meetings held yet in this window.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-student attendance</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Student</th>
                <th className="py-2 pr-4 font-medium">Attendance %</th>
                <th className="py-2 pr-4 font-medium">Attended / Held</th>
                <th className="py-2 pr-4 font-medium">Late arrivals</th>
              </tr>
            </thead>
            <tbody>
              {sortedStudents.map((s) => (
                <tr key={s.studentId} className="border-b border-border last:border-0">
                  <td className="py-2 pr-4">
                    <Link
                      href={`/dashboard/classes/${params.id}/students/${s.studentId}`}
                      className="hover:underline"
                    >
                      {s.fullName}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">
                    <Badge variant={s.attendancePercent < 75 ? 'destructive' : 'success'}>
                      {s.attendancePercent}%
                    </Badge>
                  </td>
                  <td className="py-2 pr-4">
                    {s.meetingsAttended} / {s.meetingsHeld}
                  </td>
                  <td className="py-2 pr-4">{s.lateCount}</td>
                </tr>
              ))}
              {sortedStudents.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-muted-foreground">
                    No enrolled students yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <NotificationSettings
        classId={params.id}
        initialThreshold={klass?.notify_threshold_percent ?? 75}
        initialDigestEnabled={klass?.weekly_digest_enabled ?? false}
      />
    </div>
  );
}
