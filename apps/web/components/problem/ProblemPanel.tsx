'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronRight, ExternalLink, Loader2, MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';
import type { Problem } from '@/lib/api';

type Tab = 'description' | 'examples' | 'hints' | 'discussion' | 'editorial';

const TABS: { id: Tab; label: string }[] = [
  { id: 'description', label: 'Description' },
  { id: 'examples',   label: 'Examples' },
  { id: 'hints',      label: 'Hints' },
  { id: 'discussion', label: 'Discussion' },
  { id: 'editorial',  label: 'Editorial' },
];

const GITHUB_DISCUSSIONS = 'https://github.com/GauthamPrabhuM/SystemDesignCode/discussions';

export function ProblemPanel({ problem }: { problem: Problem }) {
  const [tab, setTab] = useState<Tab>('description');

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 border-b border-border px-2 py-1 text-xs overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded px-2.5 py-1 ${
              tab === t.id ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-5 py-4">
        {tab === 'description' && <DescriptionTab problem={problem} />}
        {tab === 'examples'    && <MarkdownTab slug={problem.slug} endpoint="examples" emptyMsg="No examples written yet." />}
        {tab === 'hints'       && <HintsTab slug={problem.slug} />}
        {tab === 'discussion'  && <DiscussionTab slug={problem.slug} />}
        {tab === 'editorial'   && <MarkdownTab slug={problem.slug} endpoint="editorial" emptyMsg="Editorial coming soon." />}
      </div>
    </div>
  );
}

// ---------- Description ----------
function DescriptionTab({ problem }: { problem: Problem }) {
  return (
    <article className="prose prose-invert prose-sm max-w-none
      prose-headings:text-foreground prose-headings:font-semibold
      prose-p:text-muted-foreground prose-li:text-muted-foreground
      prose-strong:text-foreground prose-code:text-foreground
      prose-code:bg-muted/40 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
      prose-pre:bg-muted/20 prose-pre:border prose-pre:border-border
      prose-table:text-sm prose-th:text-foreground prose-td:text-muted-foreground
      prose-a:text-blue-400">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{problem.statement_md}</ReactMarkdown>
    </article>
  );
}

// ---------- Generic markdown tab (examples / editorial) ----------
function MarkdownTab({ slug, endpoint, emptyMsg }: { slug: string; endpoint: string; emptyMsg: string }) {
  const { data, isLoading } = useQuery({
    queryKey: [slug, endpoint],
    queryFn: () => api<{ content: string }>(`/problems/${slug}/${endpoint}`),
    staleTime: Infinity,
  });

  if (isLoading) return <Spinner />;
  if (!data?.content) return <Empty msg={emptyMsg} />;

  return (
    <article className="prose prose-invert prose-sm max-w-none
      prose-headings:text-foreground prose-headings:font-semibold
      prose-p:text-muted-foreground prose-li:text-muted-foreground
      prose-strong:text-foreground prose-code:text-foreground
      prose-code:bg-muted/40 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
      prose-pre:bg-muted/20 prose-pre:border prose-pre:border-border
      prose-table:text-sm prose-th:text-foreground prose-td:text-muted-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.content}</ReactMarkdown>
    </article>
  );
}

// ---------- Hints tab — reveal one at a time ----------
interface Hint { title: string; text: string; }

function HintsTab({ slug }: { slug: string }) {
  const [revealed, setRevealed] = useState(0);

  const { data: hints, isLoading } = useQuery({
    queryKey: [slug, 'hints'],
    queryFn: () => api<Hint[]>(`/problems/${slug}/hints`),
    staleTime: Infinity,
  });

  if (isLoading) return <Spinner />;
  if (!hints?.length) return <Empty msg="No hints for this problem yet." />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Stuck? Reveal hints one at a time. Try to solve it before looking.
      </p>

      {hints.map((hint, i) => (
        <div key={i} className="rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => { if (i <= revealed) setRevealed(Math.max(revealed, i + 1)); }}
            disabled={i > revealed}
            className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium transition-colors ${
              i < revealed
                ? 'bg-muted/20 text-foreground'
                : i === revealed
                ? 'bg-accent/30 text-foreground hover:bg-accent/50 cursor-pointer'
                : 'text-muted-foreground/40 cursor-not-allowed'
            }`}
          >
            <span className={`text-xs font-mono rounded px-1.5 py-0.5 shrink-0 ${
              i < revealed ? 'bg-emerald-500/20 text-emerald-400'
              : i === revealed ? 'bg-amber-500/20 text-amber-400'
              : 'bg-muted/20 text-muted-foreground/40'
            }`}>
              {i + 1}
            </span>
            <span className="flex-1">{hint.title}</span>
            {i < revealed ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            ) : i === revealed ? (
              <ChevronRight className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            ) : null}
          </button>

          {i < revealed && (
            <div className="border-t border-border bg-muted/5 px-4 py-3 text-sm text-muted-foreground leading-relaxed">
              {hint.text}
            </div>
          )}
        </div>
      ))}

      {revealed >= hints.length && (
        <p className="text-xs text-emerald-400 text-center pt-2">
          All hints revealed. Check the Editorial tab for the full solution.
        </p>
      )}
    </div>
  );
}

// ---------- Discussion ----------
function DiscussionTab({ slug }: { slug: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
      <div>
        <p className="text-sm font-medium">Discuss this problem</p>
        <p className="mt-1 text-xs text-muted-foreground max-w-xs">
          Share your approach, ask questions, and help others in the GitHub Discussion for this problem.
        </p>
      </div>
      <a
        href={`${GITHUB_DISCUSSIONS}/new?category=problems&title=${encodeURIComponent(`[${slug}] `)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-xs hover:bg-accent"
      >
        <ExternalLink className="h-3.5 w-3.5" /> Open Discussion on GitHub
      </a>
      <a
        href={`${GITHUB_DISCUSSIONS}?discussions_q=${encodeURIComponent(slug)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
      >
        Browse existing discussions →
      </a>
    </div>
  );
}

// ---------- Shared helpers ----------
function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{msg}</p>;
}
