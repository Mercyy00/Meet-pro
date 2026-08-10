'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FadeIn } from '@/components/motion/fade-in';

type ClassRow = { id: string; name: string; subject: string | null; created_at: string };

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [emails, setEmails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadClasses() {
    const res = await fetch('/api/classes');
    const data = await res.json();
    if (res.ok) setClasses(data.classes);
  }

  useEffect(() => {
    loadClasses();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const studentEmails = emails
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    const res = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, subject, studentEmails }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setName('');
    setSubject('');
    setEmails('');
    loadClasses();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Classes</h1>

      <Card>
        <CardHeader>
          <CardTitle>New class</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Class name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input placeholder="Subject (optional)" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <Input
              className="sm:col-span-2"
              placeholder="Student emails, comma-separated"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
            />
            {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
            <Button type="submit" disabled={loading} className="sm:col-span-2">
              {loading ? 'Creating…' : 'Create class'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((c, i) => (
          <FadeIn key={c.id} delay={i * 0.04}>
            <Link href={`/dashboard/classes/${c.id}`}>
              <Card className="transition-colors hover:border-primary/50">
                <CardHeader>
                  <CardTitle>{c.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{c.subject || 'No subject set'}</p>
                </CardContent>
              </Card>
            </Link>
          </FadeIn>
        ))}
        {classes.length === 0 && (
          <p className="text-sm text-muted-foreground">No classes yet — create one above.</p>
        )}
      </div>
    </div>
  );
}
