'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Clock, Loader2, AlertTriangle } from 'lucide-react';
import type { SubmissionEvent } from '@/lib/ws';

type Tab = 'tests' | 'console' | 'ai';

export function ConsolePanel({
  events,
  submittingId,
}: {
  events: SubmissionEvent[];
  submittingId: string | null;
}) {
  const [tab, setTab] = useState<Tab>('tests');

  const tests = useMemo(
    () =>
      events.filter(
        (e): e is Extract<SubmissionEvent, { type: 'test' }> => e.type === 'test',
      ),
    [events],
  );

  const result = events.find((e): e is Extract<SubmissionEvent, { type: 'result' }> => e.type === 'result');
  const failed = events.find((e): e is Extract<SubmissionEvent, { type: 'failed' }> => e.type === 'failed');
  const logs = events.filter((e): e is Extract<SubmissionEvent, { type: 'log' }> => e.type === 'log');
  const aiReady = events.some((e) => e.type === 'ai_review_done');

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-1 border-b border-border px-3 py-1.5 text-xs">
        <TabButton active={tab === 'tests'} onClick={() => setTab('tests')}>
          Tests {tests.length > 0 && <CountBadge n={tests.length} />}
        </TabButton>
        <TabButton active={tab === 'console'} onClick={() => setTab('console')}>
          Console
        </TabButton>
        <TabButton active={tab === 'ai'} onClick={() => setTab('ai')}>
          AI Review {aiReady && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />}
        </TabButton>

        <div className="ml-auto text-[11px] text-muted-foreground">
          {submittingId ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Running…
            </span>
          ) : result ? (
            <span>
              Score: <b className="text-foreground">{result.score}</b> · {result.passed}/{result.total} · {result.runtime_ms}ms
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 text-sm">
        {failed && (
          <div className="mb-2 flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-2 text-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">{failed.error}</div>
              {failed.stderr && <pre className="mt-1 whitespace-pre-wrap text-xs opacity-80">{failed.stderr}</pre>}
            </div>
          </div>
        )}

        {tab === 'tests' && <TestList tests={tests} />}
        {tab === 'console' && <LogStream logs={logs} />}
        {tab === 'ai' && <AIReviewView ready={aiReady} />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded px-2 py-1 ${
        active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function CountBadge({ n }: { n: number }) {
  return <span className="rounded bg-muted px-1.5 text-[10px]">{n}</span>;
}

function TestList({ tests }: { tests: Extract<SubmissionEvent, { type: 'test' }>[] }) {
  if (tests.length === 0) {
    return <div className="text-muted-foreground">Click Run or Submit to see results.</div>;
  }
  return (
    <ul className="space-y-1">
      <AnimatePresence initial={false}>
        {tests.map((t) => (
          <motion.li
            key={t.test_id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2 rounded-md border border-border px-2 py-1.5 font-mono text-xs"
          >
            <StatusIcon status={t.status} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span>{t.name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{t.runtime_ms}ms</span>
              </div>
              {t.diff && (
                <pre className="mt-1 whitespace-pre-wrap rounded bg-muted/40 p-1.5 text-[11px] text-rose-200/90">
                  {t.diff}
                </pre>
              )}
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'passed') return <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />;
  if (status === 'failed') return <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />;
  if (status === 'timeout') return <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />;
  return <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />;
}

function LogStream({ logs }: { logs: Extract<SubmissionEvent, { type: 'log' }>[] }) {
  if (logs.length === 0) return <div className="text-muted-foreground">No console output.</div>;
  return (
    <pre className="font-mono text-xs leading-relaxed">
      {logs.map((l, i) => (
        <div key={i} className={l.stream === 'stderr' ? 'text-rose-300' : ''}>
          {l.line}
        </div>
      ))}
    </pre>
  );
}

function AIReviewView({ ready }: { ready: boolean }) {
  if (!ready) {
    return <div className="text-muted-foreground">AI review will appear here once it completes (~20s).</div>;
  }
  // TODO: fetch ai_review by id once API exists, render dimensions + comments
  return <div className="text-muted-foreground">AI review ready. (Renderer wired in §V2.)</div>;
}
