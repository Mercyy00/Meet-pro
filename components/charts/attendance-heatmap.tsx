'use client';

export type HeatmapDay = { date: string; attended: boolean | null }; // null = no meeting that day

function colorFor(day: HeatmapDay): string {
  if (day.attended === null) return 'bg-muted';
  return day.attended ? 'bg-green-500/70' : 'bg-destructive/60';
}

export default function AttendanceHeatmap({ days }: { days: HeatmapDay[] }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(14px,1fr))] gap-1">
        {days.map((day) => (
          <div
            key={day.date}
            title={`${day.date}${day.attended === null ? '' : day.attended ? ' — attended' : ' — missed'}`}
            className={`aspect-square rounded-sm ${colorFor(day)}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-green-500/70" /> Attended
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-destructive/60" /> Missed
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-muted" /> No class
        </span>
      </div>
    </div>
  );
}
