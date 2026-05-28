'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { problems, type Problem } from '@/lib/api';

const CATEGORIES = [
  { id: '', label: 'All' },
  { id: 'lld', label: 'LLD' },
  { id: 'machine-coding', label: 'Machine coding' },
  { id: 'distsys', label: 'Distributed' },
  { id: 'api-design', label: 'API design' },
];

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export default function ProblemsList() {
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['problems', { category, difficulty, q }],
    queryFn: () => problems.list({ category: category || undefined, difficulty: difficulty || undefined, q: q || undefined }),
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center px-6 py-5">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
          <h1 className="ml-6 text-xl font-medium">Problems</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search problems…"
              className="w-64 rounded-md border border-border bg-muted/20 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-foreground/40"
            />
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
                <th className="px-4 py-2.5 font-medium">Problem</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Difficulty</th>
                <th className="px-4 py-2.5 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && data?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No problems match.
                  </td>
                </tr>
              )}
              {data?.map((p: Problem) => (
                <tr key={p.slug} className="border-t border-border hover:bg-muted/10">
                  <td className="px-4 py-2.5">
                    <Link href={`/problems/${p.slug}`} className="hover:underline">
                      {p.title}
                      {p.is_premium && <span className="ml-2 text-xs text-amber-400">PRO</span>}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.category}</td>
                  <td className={`px-4 py-2.5 capitalize ${
                    p.difficulty === 'easy' ? 'text-emerald-400' :
                    p.difficulty === 'medium' ? 'text-amber-400' : 'text-rose-400'
                  }`}>{p.difficulty}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.time_limit_minutes}m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
