'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Problem } from '@/lib/api';

type Tab = 'description' | 'examples' | 'hints' | 'discussion' | 'editorial';

export function ProblemPanel({ problem }: { problem: Problem }) {
  const [tab, setTab] = useState<Tab>('description');

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-1 border-b border-border px-3 py-1.5 text-xs">
        {(['description', 'examples', 'hints', 'discussion', 'editorial'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-2 py-1 capitalize ${
              tab === t ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
            {t === 'editorial' && problem.is_premium && <span className="ml-1 text-amber-400">🔒</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto px-5 py-4">
        {tab === 'description' && (
          <article className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{problem.statement_md}</ReactMarkdown>
          </article>
        )}
        {tab === 'examples' && (
          <div className="text-sm text-muted-foreground">Examples are embedded in the description.</div>
        )}
        {tab === 'hints' && (
          <div className="text-sm text-muted-foreground">
            Hints unlock progressively after 15, 30, 45 minutes.
          </div>
        )}
        {tab === 'discussion' && (
          <div className="text-sm text-muted-foreground">Discussion threads load once you submit.</div>
        )}
        {tab === 'editorial' && (
          <div className="text-sm text-muted-foreground">
            {problem.is_premium ? 'Editorial available with Pro.' : 'Editorial coming soon.'}
          </div>
        )}
      </div>
    </div>
  );
}
