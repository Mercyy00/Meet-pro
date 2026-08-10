'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type ClassRow = { id: string; name: string };
type ReportRow = {
  id: string;
  className: string;
  range_start: string;
  range_end: string;
  file_type: 'pdf' | 'xlsx';
  created_at: string;
  signedUrl: string | null;
};

export default function ReportsPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [classId, setClassId] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [fileType, setFileType] = useState<'pdf' | 'xlsx'>('pdf');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    const [classesRes, reportsRes] = await Promise.all([
      fetch('/api/classes'),
      fetch('/api/reports'),
    ]);
    const classesData = await classesRes.json();
    const reportsData = await reportsRes.json();
    if (classesRes.ok) setClasses(classesData.classes);
    if (reportsRes.ok) setReports(reportsData.reports);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, rangeStart, rangeEnd, fileType }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    if (data.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    loadData();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reports</h1>

      <Card>
        <CardHeader>
          <CardTitle>Generate a report</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="grid gap-3 sm:grid-cols-2">
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
            <select
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={fileType}
              onChange={(e) => setFileType(e.target.value as 'pdf' | 'xlsx')}
            >
              <option value="pdf">PDF</option>
              <option value="xlsx">Excel (.xlsx)</option>
            </select>
            <Input
              type="date"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              required
            />
            <Input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} required />
            {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
            <Button type="submit" disabled={loading} className="sm:col-span-2">
              {loading ? 'Generating…' : 'Generate report'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Past reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {reports.length > 0 ? (
            reports.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <div>
                  <p className="font-medium">{r.className}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.range_start} — {r.range_end}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="muted">{r.file_type.toUpperCase()}</Badge>
                  {r.signedUrl && (
                    <a
                      href={r.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Download
                    </a>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No reports generated yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
