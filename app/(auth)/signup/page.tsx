'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// NOTE: for the MVP, a teacher/admin signing up creates a brand-new
// institution by name. A student signing up must enter the EXACT name of an
// institution a teacher already created. A production build should replace
// this with proper invite links/codes — flagged here intentionally so it's
// easy to swap out later.
export default function SignupPage() {
  const router = useRouter();
  const supabaseRef = useRef<any>(null);

  const [existingUser, setExistingUser] = useState<any>(null);

  useEffect(() => {
    // initialize Supabase client only in the browser
    try {
      const supabase = createClient();
      supabaseRef.current = supabase;
      supabase.auth.getUser().then(({ data }: { data: any }) => {
        if (data?.user) {
          setExistingUser(data.user);
          if (data.user.email) setEmail(data.user.email);
        }
      });
    } catch (e) {
      // ignore during prerender/build — handlers will only run in the browser
      // and will rethrow if configuration is missing at runtime
      // console.warn(e);
    }
  }, []);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'teacher' | 'student'>('teacher');
  const [institutionName, setInstitutionName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = supabaseRef.current;
    if (!supabase) {
      setError('Supabase client is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      setLoading(false);
      return;
    }

    let userId = existingUser?.id;

    if (!userId) {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError || !authData.user) {
        setError(signUpError?.message ?? 'Sign up failed.');
        setLoading(false);
        return;
      }
      userId = authData.user.id;
    }

    let institutionId: string;

    if (role === 'teacher') {
      const { data: institution, error: instError } = await supabase
        .from('institutions')
        .insert({ name: institutionName })
        .select('id')
        .single();

      if (instError || !institution) {
        setError(instError?.message ?? 'Could not create institution.');
        setLoading(false);
        return;
      }
      institutionId = institution.id;
    } else {
      const { data: institution, error: lookupError } = await supabase
        .from('institutions')
        .select('id')
        .eq('name', institutionName)
        .single();

      if (lookupError || !institution) {
        setError('No institution found with that exact name. Ask your teacher.');
        setLoading(false);
        return;
      }
      institutionId = institution.id;
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      institution_id: institutionId,
      full_name: fullName,
      email,
      user_role: role,
    });

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Set up Meet Attendance Pro</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-3">
            <Input
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {!existingUser && (
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            )}

            <div className="flex gap-2 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={role === 'teacher'}
                  onChange={() => setRole('teacher')}
                />
                Teacher / Admin
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={role === 'student'}
                  onChange={() => setRole('student')}
                />
                Student
              </label>
            </div>

            <Input
              placeholder={role === 'teacher' ? 'Your institution name (new)' : 'Your institution name (exact)'}
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              required
            />

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          <p className="pt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
