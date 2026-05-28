'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Code2, Loader2 } from 'lucide-react';
import { auth, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/store/auth';

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAuth((s) => s.setUser);
  const [form, setForm] = useState({ email: '', password: '', username: '', display_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await auth.register(form.email, form.password, form.username, form.display_name || undefined);
      await auth.login(form.email, form.password);
      const me = await auth.me();
      setUser(me);
      router.push('/problems');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed. Try again.');
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

        <h1 className="text-xl font-semibold">Create account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Already have one?{' '}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Sign in
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
              value={form.email}
              onChange={set('email')}
              className="w-full rounded-md border border-border bg-muted/20 px-3 py-2 text-sm outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              minLength={3}
              maxLength={40}
              pattern="^[a-zA-Z0-9_-]+$"
              value={form.username}
              onChange={set('username')}
              className="w-full rounded-md border border-border bg-muted/20 px-3 py-2 text-sm outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20"
              placeholder="yourhandle"
            />
            <p className="mt-1 text-xs text-muted-foreground">Letters, numbers, _ and - only.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="display_name">
              Display name <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              id="display_name"
              type="text"
              autoComplete="name"
              value={form.display_name}
              onChange={set('display_name')}
              className="w-full rounded-md border border-border bg-muted/20 px-3 py-2 text-sm outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20"
              placeholder="Your Name"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={form.password}
              onChange={set('password')}
              className="w-full rounded-md border border-border bg-muted/20 px-3 py-2 text-sm outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20"
              placeholder="At least 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create account
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Free forever. No credit card.
          </p>
        </form>
      </div>
    </div>
  );
}
