'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FadeIn } from '@/components/motion/fade-in';

type ClassRow = { id: string; name: string };
type MeetingRow = {
  id: string;
  title: string;
  meet_url: string;
  join_code: string;
  scheduled_start: string;
  status: string;
};

export default function MeetingsPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [classId, setClassId] = useState('');
  const [title, setTitle] = useState('');
  const [meetUrl, setMeetUrl] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    const [classesRes, meetingsRes] = await Promise.all([
      fetch('/api/classes'),
      fetch('/api/meetings'),
    ]);
    const classesData = await classesRes.json();
    const meetingsData = await meetingsRes.json();
    if (classesRes.ok) setClasses(classesData.classes);
    if (meetingsRes.ok) setMeetings(meetingsData.meetings);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classId,
        title,
        meetUrl,
        scheduledStart: new Date(scheduledStart).toISOString(),
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setTitle('');
    setMeetUrl('');
    setScheduledStart('');
    loadData();
  }

  async function handleEndMeeting(id: string) {
    await fetch(`/api/meetings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ended' }),
    });
    loadData();
  }

  const statusVariant: Record<string, 'default' | 'success' | 'muted' | 'destructive'> = {
    scheduled: 'default',
    live: 'success',
    ended: 'muted',
    cancelled: 'destructive',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Meetings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Schedule a meeting</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSchedule} className="grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              required
            >
              <option value="">Select class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Input placeholder="Meeting title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Input
              className="sm:col-span-2"
              placeholder="Google Meet link (paste from Calendar/Meet)"
              value={meetUrl}
              onChange={(e) => setMeetUrl(e.target.value)}
              required
            />
            <Input
              type="datetime-local"
              value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)}
              required
            />
            {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
            <Button type="submit" disabled={loading} className="sm:col-span-2">
              {loading ? 'Scheduling…' : 'Schedule meeting'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {meetings.map((m, i) => (
          <FadeIn key={m.id} delay={i * 0.03}>
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{m.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(m.scheduled_start).toLocaleString()} · Join code:{' '}
                    <span className="font-mono">{m.join_code}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant[m.status] ?? 'muted'}>{m.status}</Badge>
                  {m.status === 'live' && (
                    <Button size="sm" variant="outline" onClick={() => handleEndMeeting(m.id)}>
                      End meeting
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        ))}
        {meetings.length === 0 && (
          <p className="text-sm text-muted-foreground">No meetings scheduled yet.</p>
        )}
      </div>
    </div>
  );
}
