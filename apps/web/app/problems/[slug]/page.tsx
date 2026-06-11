'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Play, ArrowLeft, Clock, LogIn, Pause, RotateCcw, FileX2 } from 'lucide-react';
import { toast } from 'sonner';

import { problems, submissions, drafts, ApiError } from '@/lib/api';
import { streamSubmission, type SubmissionEvent } from '@/lib/ws';
import { useEditor } from '@/lib/store/editor';
import { useAuth } from '@/lib/store/auth';
import { useProgress } from '@/lib/store/progress';
import { ProblemPanel } from '@/components/problem/ProblemPanel';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { ConsolePanel } from '@/components/execution/ConsolePanel';
import { LanguageSelector } from '@/components/editor/LanguageSelector';
import { FileTabs } from '@/components/editor/FileTabs';
import { CommandPalette } from '@/components/shared/CommandPalette';

// Countdown timer: persists across refreshes (per problem), supports pause/resume/reset.
function useTimer(totalMinutes: number, slug: string) {
  const key = `sdc-timer-${slug}`;
  const totalMs = totalMinutes * 60_000;

  const [state, setState] = useState<{ endAt: number; pausedRemaining: number | null }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
        if (saved && typeof saved.endAt === 'number') return saved;
      } catch { /* corrupt entry — start fresh */ }
    }
    return { endAt: Date.now() + totalMs, pausedRemaining: null };
  });
  const [, setTick] = useState(0);

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  useEffect(() => {
    if (state.pausedRemaining !== null) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [state.pausedRemaining]);

  const remaining = state.pausedRemaining ?? Math.max(0, state.endAt - Date.now());
  const mins = Math.floor(remaining / 60_000);
  const secs = Math.floor(remaining / 1000) % 60;

  return {
    display: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
    urgent: remaining <= 120_000 && remaining > 0,
    expired: remaining === 0,
    paused: state.pausedRemaining !== null,
    pause: () => setState((s) => ({ ...s, pausedRemaining: Math.max(0, s.endAt - Date.now()) })),
    resume: () => setState((s) => ({ endAt: Date.now() + (s.pausedRemaining ?? totalMs), pausedRemaining: null })),
    reset: () => setState({ endAt: Date.now() + totalMs, pausedRemaining: null }),
  };
}

export default function ProblemIDE() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { language, files, setFiles } = useEditor();
  const { user } = useAuth();
  const recordSubmission = useProgress((s) => s.recordSubmission);

  const [events, setEvents] = useState<SubmissionEvent[]>([]);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [starterError, setStarterError] = useState<string | null>(null);

  // Refs for stable callbacks and cleanup
  const stopStreamRef = useRef<(() => void) | null>(null);
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const langRef = useRef(language); // tracks current lang for stale fetch guard
  langRef.current = language;
  const starterFilesRef = useRef<Array<{ path: string; contents: string }>>([]);

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
  const titleRef = useRef('');
  titleRef.current = problemQ.data?.title ?? slug;

  const resetToStarter = useCallback(() => {
    if (starterFilesRef.current.length === 0) return;
    setFiles(starterFilesRef.current);
    toast.success('Code reset to starter');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load starter + saved draft whenever slug or language changes; prefer the draft.
  useEffect(() => {
    const lang = language; // capture for closure
    let cancelled = false;
    setStarterError(null);
    useEditor.getState().reset();

    (async () => {
      const [starterRes, draftRes] = await Promise.allSettled([
        problems.starter(slug, lang),
        user ? drafts.get(slug, lang) : Promise.resolve(null),
      ]);
      if (cancelled || langRef.current !== lang) return; // guard against stale

      const starter = starterRes.status === 'fulfilled' ? starterRes.value : null;
      if (starter) starterFilesRef.current = starter.files;

      const draft = draftRes.status === 'fulfilled' ? draftRes.value : null;
      if (draft?.files?.length) {
        setFiles(draft.files);
        toast('Draft restored', {
          description: 'Picked up where you left off.',
          action: { label: 'Reset to starter', onClick: resetToStarter },
        });
      } else if (starter) {
        setFiles(starter.files);
      } else {
        setStarterError(`No ${lang} starter yet — switch to Python or write from scratch.`);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, language, user?.id]);

  // Stable run handler (no stale closure via ref pattern)
  const handleRunRef = useRef<() => void>(() => {});
  const handleRun = useCallback(() => {
    if (!user) { router.push('/login'); return; }
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
          if (e.type === 'result') {
            recordSubmission({
              slug,
              title: titleRef.current,
              score: e.score,
              passed: e.passed,
              total: e.total,
              at: new Date().toISOString(),
            });
            if (e.score === 100) {
              toast.success(`All ${e.total} tests passed! 🎉`, { description: `${e.runtime_ms}ms · score ${e.score}` });
            } else {
              toast.warning(`${e.passed}/${e.total} tests passed`, { description: 'Open the failing tests for diffs and output.' });
            }
          }
          if (e.type === 'failed') {
            toast.error('Execution failed', { description: e.error });
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
        toast.error('Submission failed', {
          description: err instanceof Error ? err.message : 'Please try again.',
        });
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
          <FileX2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-muted-foreground">Problem not found.</p>
          <Link href="/problems" className="mt-2 inline-block text-sm underline">Browse problems</Link>
        </div>
      </div>
    );

  const running = submit.isPending || submittingId !== null;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar
        slug={slug}
        title={problemQ.data.title}
        difficulty={problemQ.data.difficulty}
        timeLimit={problemQ.data.time_limit_minutes}
        onRun={handleRun}
        submitting={running}
        isLoggedIn={!!user}
      />

      <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-300 md:hidden">
        This IDE works best on a larger screen.
      </div>

      {starterError && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-300">
          {starterError}
        </div>
      )}

      <PanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        <Panel defaultSize={35} minSize={20} maxSize={60}>
          <ProblemPanel problem={problemQ.data} />
        </Panel>

        <PanelResizeHandle className="w-1 bg-border/50 hover:bg-ring/60 transition-colors data-[resize-handle-active]:bg-ring" />

        <Panel defaultSize={65}>
          <PanelGroup direction="vertical">
            <Panel defaultSize={70} minSize={30}>
              <div className="flex h-full flex-col">
                <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
                  <LanguageSelector />
                  <button
                    onClick={resetToStarter}
                    title="Reset code to starter"
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset
                  </button>
                  <div className="ml-auto text-xs text-muted-foreground">
                    {Object.keys(files).length} file{Object.keys(files).length !== 1 ? 's' : ''}
                  </div>
                </div>
                <FileTabs />
                {/* key={language} forces Monaco to remount on language change */}
                <CodeEditor slug={slug} key={language} />
              </div>
            </Panel>

            <PanelResizeHandle className="h-1 bg-border/50 hover:bg-ring/60 transition-colors data-[resize-handle-active]:bg-ring" />

            <Panel defaultSize={30} minSize={15}>
              <ConsolePanel events={events} submittingId={submittingId} />
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>

      <CommandPalette onRun={handleRun} onResetCode={resetToStarter} />
    </div>
  );
}

function TopBar({
  slug, title, difficulty, timeLimit, onRun, submitting, isLoggedIn,
}: {
  slug: string; title: string; difficulty: string; timeLimit: number;
  onRun: () => void; submitting: boolean; isLoggedIn: boolean;
}) {
  const timer = useTimer(timeLimit, slug);
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
        {/* Countdown timer with pause/reset */}
        <div className={`flex items-center gap-1 text-xs tabular-nums shrink-0 ${
          timer.expired ? 'text-rose-400' : timer.urgent ? 'text-amber-400' : 'text-muted-foreground'
        }`}>
          <Clock className="h-3.5 w-3.5" />
          {timer.expired ? "Time's up" : timer.display}
          <button
            onClick={timer.paused ? timer.resume : timer.pause}
            title={timer.paused ? 'Resume timer' : 'Pause timer'}
            className="rounded p-0.5 hover:bg-accent"
          >
            {timer.paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          </button>
          <button onClick={timer.reset} title="Restart timer" className="rounded p-0.5 hover:bg-accent">
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>

        {!isLoggedIn ? (
          <Link
            href="/login"
            className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1 text-xs text-background hover:opacity-90"
          >
            <LogIn className="h-3.5 w-3.5" /> Sign in to run
          </Link>
        ) : (
          <button
            onClick={onRun}
            disabled={submitting}
            aria-label="run"
            className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1 text-xs text-background hover:opacity-90 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            {submitting ? 'Running…' : 'Run tests'}
            {!submitting && <kbd className="ml-1 text-[10px] opacity-60">⌘↵</kbd>}
          </button>
        )}
      </div>
    </header>
  );
}
