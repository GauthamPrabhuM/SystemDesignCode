'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Play, Send, ArrowLeft, Clock, LogIn } from 'lucide-react';

import { problems, submissions, ApiError } from '@/lib/api';
import { streamSubmission, type SubmissionEvent } from '@/lib/ws';
import { useEditor } from '@/lib/store/editor';
import { useAuth } from '@/lib/store/auth';
import { ProblemPanel } from '@/components/problem/ProblemPanel';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { ConsolePanel } from '@/components/execution/ConsolePanel';
import { LanguageSelector } from '@/components/editor/LanguageSelector';
import { CommandPalette } from '@/components/shared/CommandPalette';

// Countdown timer: starts on mount, counts down from totalMinutes
function useTimer(totalMinutes: number) {
  const startRef = useRef(Date.now());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
  const remaining = Math.max(0, totalMinutes * 60 - elapsed);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return {
    display: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
    urgent: remaining <= 120,
    expired: remaining === 0,
  };
}

export default function ProblemIDE() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { language, files, setFiles } = useEditor();
  const { user } = useAuth();

  const [events, setEvents] = useState<SubmissionEvent[]>([]);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [starterError, setStarterError] = useState<string | null>(null);

  // Refs for stable callbacks and cleanup
  const stopStreamRef = useRef<(() => void) | null>(null);
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const langRef = useRef(language); // tracks current lang for stale fetch guard
  langRef.current = language;

  // Clean up WS + timers on unmount
  useEffect(() => () => {
    stopStreamRef.current?.();
    clearTimeout(aiTimeoutRef.current);
  }, []);

  // Load problem metadata
  const problemQ = useQuery({
    queryKey: ['problem', slug],
    queryFn: () => problems.get(slug),
  });

  // Load starter whenever slug OR language changes; cancel stale fetches
  useEffect(() => {
    const lang = language; // capture for closure
    setStarterError(null);
    useEditor.getState().reset();

    problems.starter(slug, lang)
      .then((res) => {
        if (langRef.current === lang) setFiles(res.files); // guard against stale
      })
      .catch(() => {
        if (langRef.current === lang) {
          setStarterError(`No ${lang} starter yet — switch to Python or write from scratch.`);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, language]);

  // Stable run handler (no stale closure via ref pattern)
  const handleRunRef = useRef<() => void>(() => {});
  const handleRun = useCallback(() => {
    if (!user) { router.push('/login'); return; }
    setSubmitError(null);
    submit.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  handleRunRef.current = handleRun;

  const submit = useMutation({
    mutationFn: () =>
      submissions.create({
        problem_slug: slug,
        language,
        files: Object.entries(files).map(([path, contents]) => ({ path, contents })),
      }),
    onSuccess: (sub) => {
      setEvents([]);
      setSubmittingId(sub.id);
      clearTimeout(aiTimeoutRef.current);
      stopStreamRef.current?.();

      const token = localStorage.getItem('sdc-access-token') ?? '';
      const stop = streamSubmission(sub.id, token, {
        onEvent: (e) => {
          setEvents((prev) => [...prev, e]);

          // Result arrived → stop spinner immediately; keep WS open 30s for AI review
          if (e.type === 'result' || e.type === 'failed' || e.type === 'timeout') {
            setSubmittingId(null);
            clearTimeout(aiTimeoutRef.current);
            aiTimeoutRef.current = setTimeout(() => {
              stopStreamRef.current?.();
              stopStreamRef.current = null;
            }, 30_000);
          }
          // AI review arrived → close now
          if (e.type === 'ai_review_done') {
            clearTimeout(aiTimeoutRef.current);
            stopStreamRef.current?.();
            stopStreamRef.current = null;
          }
        },
        onClose: () => setSubmittingId(null),
      });
      stopStreamRef.current = stop;
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Submission failed. Try again.');
      }
    },
  });

  // ⌘↵ keyboard shortcut — always calls current handler via ref
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRunRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (problemQ.isLoading)
    return <div className="grid h-screen place-items-center text-muted-foreground">Loading…</div>;
  if (!problemQ.data)
    return (
      <div className="grid h-screen place-items-center">
        <div className="text-center">
          <p className="text-muted-foreground">Problem not found.</p>
          <Link href="/problems" className="mt-2 inline-block text-sm underline">Browse problems</Link>
        </div>
      </div>
    );

  const running = submit.isPending || submittingId !== null;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar
        title={problemQ.data.title}
        difficulty={problemQ.data.difficulty}
        timeLimit={problemQ.data.time_limit_minutes}
        onRun={handleRun}
        onSubmit={handleRun}
        submitting={running}
        isLoggedIn={!!user}
      />

      {(submitError || starterError) && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-300">
          {submitError || starterError}
        </div>
      )}

      <PanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        <Panel defaultSize={35} minSize={20} maxSize={60}>
          <ProblemPanel problem={problemQ.data} />
        </Panel>

        <PanelResizeHandle className="w-px bg-border hover:bg-accent transition-colors" />

        <Panel defaultSize={65}>
          <PanelGroup direction="vertical">
            <Panel defaultSize={70} minSize={30}>
              <div className="flex h-full flex-col">
                <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
                  <LanguageSelector />
                  {starterError && (
                    <span className="text-xs text-amber-400">⚠ no starter for this language</span>
                  )}
                  <div className="ml-auto text-xs text-muted-foreground">
                    {Object.keys(files).length} file{Object.keys(files).length !== 1 ? 's' : ''}
                  </div>
                </div>
                {/* key={language} forces Monaco to remount on language change */}
                <CodeEditor slug={slug} key={language} />
              </div>
            </Panel>

            <PanelResizeHandle className="h-px bg-border hover:bg-accent transition-colors" />

            <Panel defaultSize={30} minSize={15}>
              <ConsolePanel events={events} submittingId={submittingId} />
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>

      <CommandPalette onRun={handleRun} />
    </div>
  );
}

function TopBar({
  title, difficulty, timeLimit, onRun, onSubmit, submitting, isLoggedIn,
}: {
  title: string; difficulty: string; timeLimit: number;
  onRun: () => void; onSubmit: () => void;
  submitting: boolean; isLoggedIn: boolean;
}) {
  const timer = useTimer(timeLimit);
  const diffColor =
    difficulty === 'easy' ? 'text-emerald-400'
    : difficulty === 'medium' ? 'text-amber-400'
    : 'text-rose-400';

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
      <Link href="/problems" className="rounded p-1 hover:bg-accent" aria-label="Back to problems">
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <h1 className="text-sm font-medium truncate max-w-xs">{title}</h1>
      <span className={`text-xs uppercase tracking-wide shrink-0 ${diffColor}`}>{difficulty}</span>

      <div className="ml-auto flex items-center gap-2">
        {/* Countdown timer */}
        <span className={`flex items-center gap-1 text-xs tabular-nums shrink-0 ${
          timer.expired ? 'text-rose-400' : timer.urgent ? 'text-amber-400' : 'text-muted-foreground'
        }`}>
          <Clock className="h-3.5 w-3.5" />
          {timer.display}
        </span>

        {!isLoggedIn ? (
          <Link
            href="/login"
            className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1 text-xs text-background hover:opacity-90"
          >
            <LogIn className="h-3.5 w-3.5" /> Sign in to run
          </Link>
        ) : (
          <>
            <button
              onClick={onRun}
              disabled={submitting}
              aria-label="run"
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1 text-xs hover:bg-accent disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              {submitting ? 'Running…' : 'Run'}
              {!submitting && <kbd className="ml-1 text-[10px] text-muted-foreground">⌘↵</kbd>}
            </button>
            <button
              onClick={onSubmit}
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1 text-xs text-background hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" /> Submit
            </button>
          </>
        )}
      </div>
    </header>
  );
}
