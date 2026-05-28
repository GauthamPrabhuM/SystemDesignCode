'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Flame, Trophy, Clock, Code2 } from 'lucide-react';

export default function Dashboard() {
  // In V1 these hydrate from /api/v1/users/me/stats — placeholder data for now
  const stats = [
    { label: 'Problems solved', value: 12, icon: <Code2 className="h-4 w-4" /> },
    { label: 'Current streak', value: '4 days', icon: <Flame className="h-4 w-4" /> },
    { label: 'Best contest rank', value: '#142', icon: <Trophy className="h-4 w-4" /> },
    { label: 'Avg. solve time', value: '38m', icon: <Clock className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center px-6 py-5">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
          <h1 className="ml-6 text-xl font-medium">Dashboard</h1>
          <Link
            href="/problems"
            className="ml-auto rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
          >
            Browse problems
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-lg border border-border bg-muted/10 p-4"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {s.icon} {s.label}
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">{s.value}</div>
            </motion.div>
          ))}
        </div>

        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Activity</h2>
          <Heatmap />
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <Card title="Recent submissions">
            <RecentSubmissions />
          </Card>
          <Card title="Continue solving">
            <div className="space-y-2">
              {[
                { slug: 'parking-lot', title: 'Parking Lot', status: 'In progress' },
                { slug: 'rate-limiter', title: 'Rate Limiter', status: 'Draft saved 2h ago' },
              ].map((d) => (
                <Link
                  key={d.slug}
                  href={`/problems/${d.slug}`}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/10 px-3 py-2 hover:bg-muted/30"
                >
                  <span className="text-sm">{d.title}</span>
                  <span className="text-xs text-muted-foreground">{d.status}</span>
                </Link>
              ))}
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/5 p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

function Heatmap() {
  // Simple 53x7 grid; in V1 we hydrate from `/api/v1/users/me/heatmap`
  const days = 53 * 7;
  return (
    <div className="mt-4 overflow-x-auto">
      <div className="grid grid-flow-col grid-rows-7 gap-[2px]">
        {Array.from({ length: days }).map((_, i) => {
          const intensity = (i * 31) % 5; // pseudo-random
          const bg =
            intensity === 0 ? 'bg-muted/40'
            : intensity === 1 ? 'bg-emerald-900'
            : intensity === 2 ? 'bg-emerald-700'
            : intensity === 3 ? 'bg-emerald-500'
            : 'bg-emerald-400';
          return <div key={i} className={`h-2.5 w-2.5 rounded-[2px] ${bg}`} />;
        })}
      </div>
    </div>
  );
}

function RecentSubmissions() {
  const subs = [
    { problem: 'Parking Lot', status: 'Accepted', score: 92, when: '2h ago' },
    { problem: 'LRU Cache',   status: 'Accepted', score: 100, when: 'yesterday' },
    { problem: 'Rate Limiter', status: 'Wrong answer', score: 60, when: '3d ago' },
  ];
  return (
    <ul className="space-y-1.5 text-sm">
      {subs.map((s, i) => (
        <li key={i} className="flex items-center justify-between border-b border-border/50 pb-1.5 last:border-0">
          <span>{s.problem}</span>
          <span className="flex items-center gap-3 text-xs">
            <span className={s.status === 'Accepted' ? 'text-emerald-400' : 'text-rose-400'}>{s.status}</span>
            <span className="tabular-nums text-muted-foreground">{s.score}</span>
            <span className="text-muted-foreground">{s.when}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
