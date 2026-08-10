export function createClient() {
  // Only create the Supabase browser client in a browser environment.
  // During Next.js builds and server-side rendering the browser APIs
  // (like window) are not available and Supabase should not be initialized.
  if (typeof window === 'undefined') {
    throw new Error('createClient() must be called from the browser.');
  }

  // Defer importing @supabase/ssr until runtime in the browser so that
  // the module is not evaluated during server-side builds where env
  // variables may not be available.
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const { createBrowserClient } = require('@supabase/ssr');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
 
  if (!url || !anonKey) {
    // Provide a clearer error message in the browser if env vars are missing.
    throw new Error(
      '@supabase/ssr: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required to create a Supabase client.'
    );
  }

  return createBrowserClient(url, anonKey);
}
