'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function ClassRangeToggle({ current }: { current: 'weekly' | 'monthly' }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex gap-1 rounded-md border border-border p-1 text-sm">
      <Button
        variant={current === 'weekly' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => router.push(`${pathname}?range=weekly`)}
      >
        Weekly
      </Button>
      <Button
        variant={current === 'monthly' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => router.push(`${pathname}?range=monthly`)}
      >
        Monthly
      </Button>
    </div>
  );
}
