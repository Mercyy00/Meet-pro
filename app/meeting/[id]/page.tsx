'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const HEARTBEAT_INTERVAL_MS = 30_000;

export default function MeetingJoinPage() {
  const params = useParams<{ id: string }>();
  const [joinCode, setJoinCode] = useState('');
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [meetUrl, setMeetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'joining' | 'in-session'>('idle');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setStatus('joining');
    setError(null);

    const res = await fetch('/api/attendance/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ joinCode }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setStatus('idle');
      return;
    }

    setMeetingId(data.meetingId);
    setMeetUrl(data.meetUrl);
    setStatus('in-session');
    window.open(data.meetUrl, '_blank', 'noopener,noreferrer');
  }

  // Heartbeat loop: only runs while this tab is open. If the tab loses
  // focus/visibility we still ping — the requirement is "tab open", not
  // "tab focused", since students legitimately tab over to Meet itself.
  // (Swap the condition below if you want focus-strict tracking instead.)
  useEffect(() => {
    if (status !== 'in-session' || !meetingId) return;

    async function sendHeartbeat() {
      try {
        await fetch('/api/attendance/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meetingId }),
        });
      } catch {
        // Network hiccup — the next tick will retry; the server-side sweep
        // is the real safety net if pings stop entirely.
      }
    }

    sendHeartbeat();
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    function handleUnload() {
      if (!meetingId) return;
      const blob = new Blob([JSON.stringify({ meetingId })], { type: 'application/json' });
      navigator.sendBeacon('/api/attendance/leave', blob);
    }
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [status, meetingId]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Join class</CardTitle>
          <CardDescription>Enter the code your teacher shared.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status !== 'in-session' ? (
            <form onSubmit={handleJoin} className="space-y-3">
              <Input
                placeholder="Join code (e.g. K7QX-3P)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                required
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={status === 'joining'}>
                {status === 'joining' ? 'Joining…' : 'Join class'}
              </Button>
            </form>
          ) : (
            <div className="space-y-3 text-center">
              <Badge variant="success">Attendance tracking active</Badge>
              <p className="text-sm text-muted-foreground">
                Your Meet tab opened in a new window. Keep this tab open too — it's how we track
                your attendance.
              </p>
              {meetUrl && (
                <a
                  href={meetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 w-full items-center justify-center rounded-md border border-border text-sm font-medium hover:bg-muted"
                >
                  Reopen Meet link
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
