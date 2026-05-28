'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Play, Send, ArrowLeft, Clock } from 'lucide-react';

import { problems, submissions, ApiError } from '@/lib/api';
import { streamSubmission, type SubmissionEvent } from '@/lib/ws';
import { useEditor } from '@/lib/store/editor';
import { ProblemPanel } from '@/components/problem/ProblemPanel';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { ConsolePanel } from '@/components/execution/ConsolePanel';
import { LanguageSelector } from '@/components/editor/LanguageSelector';
import { CommandPalette } from '@/components/shared/CommandPalette';

export default function ProblemIDE() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { language, files, setFiles } = useEditor();
  const [events, setEvents] = useState<SubmissionEvent[]>([]);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);

  // Cleanup WS on unmount
  useEffect(() => () => { stopStreamRef.current?.(); }, []);

  // Load problem
  const problemQ = useQuery({
    queryKey: ['problem', slug],
    queryFn: () => problems.get(slug),
  });

  // Load starter when language changes and no code in editor yet
  useEffect(() => {
    if (Object.keys(files).length > 0) return;
    problems.starter(slug, language)
      .then((res) => setFiles(res.files))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, language]);

  const handleRun = () => {
    setSubmitError(null);
    submit.mutate();
  };

  // Submit mutation
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
      stopStreamRef.current?.(); // cancel any previous stream

      const token = localStorage.getItem('sdc-access-token') ?? '';
      const stop = streamSubmission(sub.id, token, {
        onEvent: (e) => setEvents((prev) => [...prev, e]),
        onClose: () => { setSubmittingId(null); stopStreamRef.current = null; },
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

  // Keyboard shortcut ⌘↵ → run
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (problemQ.isLoading)
    return <div className="grid h-screen place-items-center text-muted-foreground">Loading…</div>;
  if (!problemQ.data)
    return (
      <div className="grid h-screen place-items-center">
        <div className="text-center">
          <p className="text-muted-foreground">Problem not found.</p>
          <Link href="/problems" className="mt-2 inline-block text-sm underline">
            Browse problems
          </Link>
        </div>
      </div>
    );

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar
        title={problemQ.data.title}
        difficulty={problemQ.data.difficulty}
        timeLimit={problemQ.data.time_limit_minutes}
        onRun={handleRun}
        onSubmit={handleRun}
        submitting={submit.isPending || submittingId !== null}
      />

      {submitError && (
        <div className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-1.5 text-xs text-rose-300">
          {submitError}
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
                  <div className="ml-auto text-xs text-muted-foreground">
                    {Object.keys(files).length} file{Object.keys(files).length !== 1 ? 's' : ''}
                  </div>
                </div>
                <CodeEditor slug={slug} />
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
  title,
  difficulty,
  timeLimit,
  onRun,
  onSubmit,
  submitting,
}: {
  title: string;
  difficulty: string;
  timeLimit: number;
  onRun: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const diffColor =
    difficulty === 'easy'
      ? 'text-emerald-400'
      : difficulty === 'medium'
      ? 'text-amber-400'
      : 'text-rose-400';

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
      <Link href="/problems" className="rounded p-1 hover:bg-accent" aria-label="Back to problems">
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <h1 className="text-sm font-medium">{title}</h1>
      <span className={`text-xs uppercase tracking-wide ${diffColor}`}>{difficulty}</span>
      <div className="ml-auto flex items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> {timeLimit}m
        </span>
        <button
          onClick={onRun}
          disabled={submitting}
          aria-label="run"
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1 text-xs hover:bg-accent disabled:opacity-50"
        >
          <Play className="h-3.5 w-3.5" /> Run
          <kbd className="ml-1 text-[10px] text-muted-foreground">⌘↵</kbd>
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1 text-xs text-background hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" /> Submit
        </button>
      </div>
    </header>
  );
}
