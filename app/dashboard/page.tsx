import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getClassAttendanceSummary } from '@/lib/attendance-stats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FadeIn } from '@/components/motion/fade-in';
import { CountUp } from '@/components/motion/count-up';

export default async function DashboardOverviewPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_role, institution_id')
    .eq('id', user!.id)
    .single();

  const isStaff = profile?.user_role === 'admin' || profile?.user_role === 'teacher';

  const { count: classCount } = await supabase
    .from('classes')
    .select('*', { count: 'exact', head: true });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data: todaysMeetings } = await supabase
    .from('meetings')
    .select('id, title, scheduled_start, status')
    .gte('scheduled_start', todayStart.toISOString())
    .lte('scheduled_start', todayEnd.toISOString())
    .order('scheduled_start', { ascending: true });

  // At-risk students (< 75% over the last 30 days) + overall attendance %,
  // computed across every class this teacher/admin owns. Kept server-side
  // and simple: fine at the data volumes a free-tier app like this expects.
  let overallPercent: number | null = null;
  let atRiskStudents: { studentId: string; classId: string; className: string; fullName: string; attendancePercent: number }[] = [];

  if (isStaff) {
    const { data: myClasses } = await supabase.from('classes').select('id, name');
    const since = new Date();
    since.setDate(since.getDate() - 30);

    let totalHeld = 0;
    let totalAttended = 0;

    for (const klass of myClasses ?? []) {
      const { students } = await getClassAttendanceSummary(supabase, klass.id, since);
      for (const s of students) {
        totalHeld += s.meetingsHeld;
        totalAttended += s.meetingsAttended;
        if (s.meetingsHeld > 0 && s.attendancePercent < 75) {
          atRiskStudents.push({
            studentId: s.studentId,
            classId: klass.id,
            className: klass.name,
            fullName: s.fullName,
            attendancePercent: s.attendancePercent,
          });
        }
      }
    }

    overallPercent = totalHeld > 0 ? Math.round((totalAttended / totalHeld) * 100) : null;
    atRiskStudents.sort((a, b) => a.attendancePercent - b.attendancePercent);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">
          {isStaff ? "Here's what's happening across your classes today." : 'Your attendance snapshot.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FadeIn delay={0}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Total classes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">
                <CountUp value={classCount ?? 0} />
              </p>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.05}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Today&apos;s meetings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">
                <CountUp value={todaysMeetings?.length ?? 0} />
              </p>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.1}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Overall attendance %</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">
                {overallPercent !== null ? <CountUp value={overallPercent} suffix="%" /> : '—'}
              </p>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <FadeIn delay={0.15}>
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s meetings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todaysMeetings && todaysMeetings.length > 0 ? (
              todaysMeetings.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.scheduled_start).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <Badge variant={m.status === 'live' ? 'success' : 'muted'}>{m.status}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No meetings scheduled for today.</p>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {isStaff && (
        <FadeIn delay={0.2}>
          <Card>
            <CardHeader>
              <CardTitle>At-risk students</CardTitle>
              <p className="text-sm text-muted-foreground">Below 75% attendance over the last 30 days.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {atRiskStudents.length > 0 ? (
                atRiskStudents.map((s) => (
                  <Link
                    key={`${s.classId}-${s.studentId}`}
                    href={`/dashboard/classes/${s.classId}/students/${s.studentId}`}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 hover:bg-muted"
                  >
                    <div>
                      <p className="font-medium">{s.fullName}</p>
                      <p className="text-xs text-muted-foreground">{s.className}</p>
                    </div>
                    <Badge variant="destructive">{s.attendancePercent}%</Badge>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No at-risk students right now.</p>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}
