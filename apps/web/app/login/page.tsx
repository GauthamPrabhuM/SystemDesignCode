'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Code2, Loader2 } from 'lucide-react';
import { auth, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/store/auth';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuth((s) => s.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await auth.login(email, password);
      const me = await auth.me();
      setUser(me);
      router.push('/problems');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium">
            <div className="grid h-6 w-6 place-items-center rounded-md bg-foreground text-background">
              <Code2 className="h-3.5 w-3.5" />
            </div>
            SystemDesignCode
          </Link>
        </div>

        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-foreground underline-offset-4 hover:underline">
            Register
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-muted/20 px-3 py-2 text-sm outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-muted/20 px-3 py-2 text-sm outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
