'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import type { TrendPoint } from './attendance-trend-chart';

const AttendanceTrendChart = dynamic(() => import('./attendance-trend-chart'), {
  ssr: false,
  loading: () => <Skeleton className="h-[280px] w-full" />,
});

export default function LazyAttendanceTrendChart({ data }: { data: TrendPoint[] }) {
  return <AttendanceTrendChart data={data} />;
}
