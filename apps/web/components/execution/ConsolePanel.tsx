'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Clock, Loader2, AlertTriangle, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
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

  // A new run started → jump to the Tests tab so results are visible immediately
  useEffect(() => {
    if (submittingId) setTab('tests');
  }, [submittingId]);

  const tests = useMemo(
    () => events.filter((e): e is Extract<SubmissionEvent, { type: 'test' }> => e.type === 'test'),
    [events],
  );
  const logs = useMemo(
    () => events.filter((e): e is Extract<SubmissionEvent, { type: 'log' }> => e.type === 'log'),
    [events],
  );
  const result = events.find((e): e is Extract<SubmissionEvent, { type: 'result' }> => e.type === 'result');
  const failed = events.find((e): e is Extract<SubmissionEvent, { type: 'failed' }> => e.type === 'failed');
  const aiReady = events.some((e) => e.type === 'ai_review_done');
  const lastStatus = [...events].reverse().find((e): e is Extract<SubmissionEvent, { type: 'status' }> => e.type === 'status');
  const isQueued = !!submittingId && (!lastStatus || lastStatus.status === 'queued');
  const isRunning = !!submittingId;

  // Passed / total from test events (fallback if result hasn't arrived yet)
  const passedCount = tests.filter((t) => t.status === 'passed').length;
  const totalCount = tests.length;
  const allPassed = result ? result.score === 100 : (totalCount > 0 && passedCount === totalCount);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Tab bar + summary */}
      <div className="flex items-center gap-1 border-b border-border px-2 py-1 text-xs">
        <TabBtn active={tab === 'tests'} onClick={() => setTab('tests')}>
          Tests {totalCount > 0 && <Badge n={totalCount} ok={!failed && allPassed && !isRunning} />}
        </TabBtn>
        <TabBtn active={tab === 'console'} onClick={() => setTab('console')}>
          Console {logs.length > 0 && <span className="ml-1 rounded bg-muted px-1.5 text-[10px]">{logs.length}</span>}
        </TabBtn>
        <TabBtn active={tab === 'ai'} onClick={() => setTab('ai')}>
          AI Review {aiReady && <span className="ml-1 h-1.5 w-1.5 inline-block rounded-full bg-emerald-400" />}
        </TabBtn>

        <div className="ml-auto text-[11px] text-muted-foreground">
          {isRunning ? (
            <span className="flex items-center gap-1.5 text-amber-400">
              <Loader2 className="h-3 w-3 animate-spin" /> {isQueued ? 'Queued…' : 'Running…'}
            </span>
          ) : result ? (
            <span className={result.score === 100 ? 'text-emerald-400' : result.score >= 50 ? 'text-amber-400' : 'text-rose-400'}>
              {result.passed}/{result.total} tests · {result.score}% · {result.runtime_ms}ms
              {result.memory_kb > 0 && ` · ${(result.memory_kb / 1024).toFixed(1)}MB`}
            </span>
          ) : failed ? (
            <span className="text-rose-400">Execution failed</span>
          ) : null}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-3 text-sm">
        {/* Failure banner */}
        {failed && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-2.5 text-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">{failed.error}</div>
              {failed.stderr && (
                <pre className="mt-1 whitespace-pre-wrap text-xs opacity-80">{failed.stderr}</pre>
              )}
            </div>
          </div>
        )}

        {tab === 'tests' && <TestList tests={tests} isRunning={isRunning} />}
        {tab === 'console' && <ConsoleLog logs={logs} isRunning={isRunning} />}
        {tab === 'ai' && <AIReview ready={aiReady} isRunning={isRunning} />}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

function Badge({ n, ok }: { n: number; ok: boolean }) {
  return (
    <span className={`ml-1 rounded px-1.5 text-[10px] ${ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted'}`}>
      {n}
    </span>
  );
}

type TestEvent = Extract<SubmissionEvent, { type: 'test' }>;

function TestList({ tests, isRunning }: { tests: TestEvent[]; isRunning: boolean }) {
  if (tests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
        {isRunning ? (
          <><Loader2 className="h-5 w-5 animate-spin" /><span className="text-xs">Running tests…</span></>
        ) : (
          <span className="text-xs">Press Run (⌘↵) to execute your code.</span>
        )}
      </div>
    );
  }
  return (
    <ul className="space-y-1">
      <AnimatePresence initial={false}>
        {tests.map((t) => <TestRow key={t.test_id} t={t} />)}
      </AnimatePresence>
    </ul>
  );
}

function TestRow({ t }: { t: TestEvent }) {
  const [open, setOpen] = useState(false);
  const hasDiff = !!(t as any).diff;
  const hasStdout = !!(t as any).stdout;
  const hasStderr = !!t.stderr;
  const expandable = hasDiff || hasStdout || hasStderr;

  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-md border border-border font-mono text-xs"
    >
      <button
        onClick={() => expandable && setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 px-2 py-1.5 text-left ${expandable ? 'cursor-pointer hover:bg-muted/20' : 'cursor-default'}`}
      >
        <StatusIcon status={t.status} />
        <span className="flex-1">{t.name}</span>
        <span className="text-[10px] text-muted-foreground">{t.runtime_ms}ms</span>
        {expandable && (
          <span className="text-muted-foreground">
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </span>
        )}
      </button>

      {open && expandable && (
        <div className="border-t border-border bg-muted/10 px-3 py-2 space-y-2">
          {hasDiff && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Diff (expected → actual)</div>
              <pre className="whitespace-pre-wrap rounded bg-muted/40 p-2 text-[11px] text-rose-200/90">
                {(t as any).diff}
              </pre>
            </div>
          )}
          {hasStdout && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Your output</div>
              <pre className="whitespace-pre-wrap rounded bg-muted/40 p-2 text-[11px] text-muted-foreground">
                {(t as any).stdout}
              </pre>
            </div>
          )}
          {hasStderr && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Stderr</div>
              <pre className="whitespace-pre-wrap rounded bg-rose-500/10 p-2 text-[11px] text-rose-300">
                {t.stderr}
              </pre>
            </div>
          )}
        </div>
      )}
    </motion.li>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'passed')  return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />;
  if (status === 'failed')  return <XCircle      className="h-3.5 w-3.5 shrink-0 text-rose-400" />;
  if (status === 'timeout') return <Clock        className="h-3.5 w-3.5 shrink-0 text-amber-400" />;
  return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />;
}

type LogEvent = Extract<SubmissionEvent, { type: 'log' }>;

function ConsoleLog({ logs, isRunning }: { logs: LogEvent[]; isRunning: boolean }) {
  const [copied, setCopied] = useState(false);

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
        {isRunning
          ? 'Waiting for output…'
          : 'No console output. Print to stderr or use debug statements to see output here.'}
      </div>
    );
  }

  const copyAll = () => {
    navigator.clipboard.writeText(logs.map((l) => l.line).join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="relative">
      <button
        onClick={copyAll}
        title="Copy all output"
        className="absolute right-0 top-0 flex items-center gap-1 rounded border border-border bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className="font-mono text-xs leading-relaxed">
        {logs.map((l, i) => (
          <div key={i} className={l.stream === 'stderr' ? 'text-rose-300' : 'text-muted-foreground'}>
            {(l as any).test && (
              <span className="mr-2 text-[10px] text-muted-foreground/50">[{(l as any).test}]</span>
            )}
            {l.line}
          </div>
        ))}
      </pre>
    </div>
  );
}

function AIReview({ ready, isRunning }: { ready: boolean; isRunning: boolean }) {
  if (isRunning) {
    return <div className="py-10 text-center text-xs text-muted-foreground">AI review generates after tests complete…</div>;
  }
  if (!ready) {
    return (
      <div className="py-10 text-center text-xs text-muted-foreground">
        AI design review will appear here ~20s after submission.
        {!isRunning && ' Submit your code to get feedback.'}
      </div>
    );
  }
  return (
    <div className="text-xs text-emerald-400">
      ✓ AI review ready. Full renderer coming in the next update.
    </div>
  );
}
