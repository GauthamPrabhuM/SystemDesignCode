'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Send, Clock, Code2, ArrowRight } from 'lucide-react';
import { useProgress, type RecentSubmission } from '@/lib/store/progress';

// Persisted stores rehydrate on the client only — gate reads to avoid hydration mismatch
function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Consecutive days of activity ending today or yesterday
function computeStreak(activity: Record<string, number>): number {
  let streak = 0;
  const cursor = new Date();
  if (!activity[dayKey(cursor)]) cursor.setDate(cursor.getDate() - 1); // today not yet active → count from yesterday
  while (activity[dayKey(cursor)]) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

export default function Dashboard() {
  const hydrated = useHydrated();
  const { problems, recent, activity } = useProgress();

  const solvedCount = useMemo(
    () => Object.values(problems).filter((p) => p.status === 'solved').length,
    [problems],
  );
  const streak = useMemo(() => computeStreak(activity), [activity]);
  const totalSubmissions = useMemo(
    () => Object.values(activity).reduce((sum, n) => sum + n, 0),
    [activity],
  );
  const inProgress = useMemo(
    () =>
      Object.entries(problems)
        .filter(([, p]) => p.status === 'attempted')
        .sort(([, a], [, b]) => b.lastSubmittedAt.localeCompare(a.lastSubmittedAt))
        .slice(0, 5),
    [problems],
  );

  const stats = [
    { label: 'Problems solved', value: solvedCount, icon: <Code2 className="h-4 w-4" /> },
    { label: 'Current streak', value: streak === 1 ? '1 day' : `${streak} days`, icon: <Flame className="h-4 w-4" /> },
    { label: 'Submissions', value: totalSubmissions, icon: <Send className="h-4 w-4" /> },
    { label: 'In progress', value: inProgress.length, icon: <Clock className="h-4 w-4" /> },
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
              <div className="mt-2 text-2xl font-semibold tabular-nums">
                {hydrated ? s.value : '—'}
              </div>
            </motion.div>
          ))}
        </div>

        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Activity</h2>
          <Heatmap activity={hydrated ? activity : {}} />
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <Card title="Recent submissions">
            <RecentSubmissions recent={hydrated ? recent : []} />
          </Card>
          <Card title="Continue solving">
            {hydrated && inProgress.length > 0 ? (
              <div className="space-y-2">
                {inProgress.map(([slug, p]) => (
                  <Link
                    key={slug}
                    href={`/problems/${slug}`}
                    className="flex items-center justify-between rounded-md border border-border bg-muted/10 px-3 py-2 hover:bg-muted/30"
                  >
                    <span className="text-sm capitalize">{slug.replace(/-/g, ' ')}</span>
                    <span className="text-xs text-muted-foreground">
                      best {p.bestScore}% · {timeAgo(p.lastSubmittedAt)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                msg="Nothing in progress."
                cta="Pick a problem"
                href="/problems"
              />
            )}
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

function EmptyState({ msg, cta, href }: { msg: string; cta: string; href: '/problems' }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <p className="text-xs text-muted-foreground">{msg}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
      >
        {cta} <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

// 53 weeks × 7 days grid ending today, colored by submissions per day
function Heatmap({ activity }: { activity: Record<string, number> }) {
  const cells = useMemo(() => {
    const days = 53 * 7;
    const out: { key: string; count: number }[] = [];
    const d = new Date();
    d.setDate(d.getDate() - (days - 1));
    for (let i = 0; i < days; i++) {
      const key = dayKey(d);
      out.push({ key, count: activity[key] ?? 0 });
      d.setDate(d.getDate() + 1);
    }
    return out;
  }, [activity]);

  return (
    <div className="mt-4 overflow-x-auto">
      <div className="grid grid-flow-col grid-rows-7 gap-[2px]">
        {cells.map((c) => {
          const bg =
            c.count === 0 ? 'bg-muted/40'
            : c.count === 1 ? 'bg-emerald-900'
            : c.count <= 3 ? 'bg-emerald-700'
            : c.count <= 6 ? 'bg-emerald-500'
            : 'bg-emerald-400';
          return (
            <div
              key={c.key}
              title={`${c.key} · ${c.count} submission${c.count !== 1 ? 's' : ''}`}
              className={`h-2.5 w-2.5 rounded-[2px] ${bg}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function RecentSubmissions({ recent }: { recent: RecentSubmission[] }) {
  if (recent.length === 0) {
    return <EmptyState msg="No submissions yet." cta="Start solving" href="/problems" />;
  }
  return (
    <ul className="space-y-1.5 text-sm">
      {recent.slice(0, 8).map((s, i) => (
        <li key={i} className="flex items-center justify-between border-b border-border/50 pb-1.5 last:border-0">
          <Link href={`/problems/${s.slug}`} className="hover:underline">{s.title}</Link>
          <span className="flex items-center gap-3 text-xs">
            <span className={s.score === 100 ? 'text-emerald-400' : 'text-amber-400'}>
              {s.passed}/{s.total} passed
            </span>
            <span className="tabular-nums text-muted-foreground">{s.score}%</span>
            <span className="text-muted-foreground">{timeAgo(s.at)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
