import Link from 'next/link';
import { Trophy, ArrowRight } from 'lucide-react';

export const metadata = { title: 'Contests' };

export default function Contests() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <div className="max-w-md text-center">
        <Trophy className="mx-auto h-10 w-10 text-amber-400/70" />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Contests are coming soon</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Timed machine-coding contests with live leaderboards are in the works.
          Until then, every problem has a built-in interview timer — practice under real conditions.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/problems"
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Practice now <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/"
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
          >
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
