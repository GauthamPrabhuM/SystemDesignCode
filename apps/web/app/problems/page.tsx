'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CircleDashed, Search } from 'lucide-react';
import { problems, type Problem } from '@/lib/api';
import { useProgress } from '@/lib/store/progress';

const CATEGORIES = [
  { id: '', label: 'All' },
  { id: 'lld', label: 'LLD' },
  { id: 'machine-coding', label: 'Machine coding' },
  { id: 'distsys', label: 'Distributed' },
  { id: 'api-design', label: 'API design' },
];

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

// Persisted stores rehydrate on the client only — gate reads to avoid hydration mismatch
function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

export default function ProblemsList() {
  const router = useRouter();
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [q, setQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const hydrated = useHydrated();
  const progress = useProgress((s) => s.problems);

  // "/" focuses search from anywhere on the page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['problems', { category, difficulty, q }],
    queryFn: () => problems.list({ category: category || undefined, difficulty: difficulty || undefined, q: q || undefined }),
  });

  const solvedCount = hydrated
    ? Object.values(progress).filter((p) => p.status === 'solved').length
    : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center px-6 py-5">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
          <h1 className="ml-6 text-xl font-medium">Problems</h1>
          {hydrated && solvedCount > 0 && (
            <span className="ml-3 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-400">
              {solvedCount} solved
            </span>
          )}
          <Link
            href="/dashboard"
            className="ml-auto rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search problems…"
              className="w-64 rounded-md border border-border bg-muted/20 py-1.5 pl-8 pr-8 text-sm outline-none focus:border-foreground/40"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border px-1 text-[10px] text-muted-foreground">/</kbd>
          </div>
          <div className="flex gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  category === c.id ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-1">
            <button
              onClick={() => setDifficulty('')}
              className={`rounded-md px-2.5 py-1 text-xs ${
                difficulty === '' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Any
            </button>
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`rounded-md px-2.5 py-1 text-xs capitalize ${
                  difficulty === d ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-2.5 font-medium" aria-label="Status" />
                <th className="px-4 py-2.5 font-medium">Problem</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Difficulty</th>
                <th className="px-4 py-2.5 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-t border-border">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="h-4 w-full animate-pulse rounded bg-muted/30" />
                      </td>
                    </tr>
                  ))}
                </>
              )}
              {!isLoading && data?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No problems match — try clearing the filters.
                  </td>
                </tr>
              )}
              {data?.map((p: Problem) => {
                const prog = hydrated ? progress[p.slug] : undefined;
                return (
                  <tr
                    key={p.slug}
                    onClick={() => router.push(`/problems/${p.slug}`)}
                    className="cursor-pointer border-t border-border transition-colors hover:bg-muted/10"
                  >
                    <td className="px-4 py-2.5">
                      {prog?.status === 'solved' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-label="Solved" />
                      ) : prog?.status === 'attempted' ? (
                        <CircleDashed className="h-4 w-4 text-amber-400" aria-label={`Attempted · best ${prog.bestScore}%`} />
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/problems/${p.slug}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline"
                      >
                        {p.title}
                        {p.is_premium && <span className="ml-2 text-xs text-amber-400">PRO</span>}
                      </Link>
                      {prog?.status === 'attempted' && (
                        <span className="ml-2 text-xs text-muted-foreground">best {prog.bestScore}%</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.category}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${
                        p.difficulty === 'easy' ? 'bg-emerald-500/10 text-emerald-400' :
                        p.difficulty === 'medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>{p.difficulty}</span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.time_limit_minutes}m</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!isLoading && !!data?.length && (
          <p className="mt-3 text-xs text-muted-foreground">
            {data.length} problem{data.length !== 1 ? 's' : ''} · press <kbd className="rounded border border-border px-1">/</kbd> to search
          </p>
        )}
      </main>
    </div>
  );
}
