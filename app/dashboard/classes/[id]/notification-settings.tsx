'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function NotificationSettings({
  classId,
  initialThreshold,
  initialDigestEnabled,
}: {
  classId: string;
  initialThreshold: number;
  initialDigestEnabled: boolean;
}) {
  const [threshold, setThreshold] = useState(initialThreshold);
  const [digestEnabled, setDigestEnabled] = useState(initialDigestEnabled);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch(`/api/classes/${classId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notifyThresholdPercent: threshold,
        weeklyDigestEnabled: digestEnabled,
      }),
    });
    setSaving(false);
    setSaved(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="block text-sm">
          Alert parents when attendance drops below
          <div className="mt-1 flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-muted-foreground">%</span>
          </div>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={digestEnabled}
            onChange={(e) => setDigestEnabled(e.target.checked)}
          />
          Send a weekly digest email for this class
        </label>

        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save settings'}
        </Button>
      </CardContent>
    </Card>
  );
}
