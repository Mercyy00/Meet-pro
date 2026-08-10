import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { MobileNav } from '@/components/dashboard/mobile-nav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, user_role')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <MobileNav />
      <aside className="hidden w-56 shrink-0 border-r border-border p-4 md:flex md:flex-col">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-lg font-semibold">Attendance Pro</p>
          <ThemeToggle />
        </div>
        <nav className="space-y-1 text-sm">
          <Link href="/dashboard" className="block rounded-md px-3 py-2 hover:bg-muted">
            Overview
          </Link>
          <Link href="/dashboard/classes" className="block rounded-md px-3 py-2 hover:bg-muted">
            Classes
          </Link>
          <Link href="/dashboard/meetings" className="block rounded-md px-3 py-2 hover:bg-muted">
            Meetings
          </Link>
          <Link href="/dashboard/reports" className="block rounded-md px-3 py-2 hover:bg-muted">
            Reports
          </Link>
        </nav>
        {profile && (
          <div className="mt-auto pt-8 text-xs text-muted-foreground">
            <p>{profile.full_name}</p>
            <p className="capitalize">{profile.user_role}</p>
          </div>
        )}
      </aside>
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
