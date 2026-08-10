'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import type { HeatmapDay } from './attendance-heatmap';

const AttendanceHeatmap = dynamic(() => import('./attendance-heatmap'), {
  ssr: false,
  loading: () => <Skeleton className="h-32 w-full" />,
});

export default function LazyAttendanceHeatmap({ days }: { days: HeatmapDay[] }) {
  return <AttendanceHeatmap days={days} />;
}
