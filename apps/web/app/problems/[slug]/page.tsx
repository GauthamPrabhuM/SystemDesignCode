'use client';

/**
 * The IDE route: /problems/[slug]
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │  TopBar:  back  |  title       Timer  |  Run  Submit             │
 *   ├──────────────────────┬───────────────────────────────────────────┤
 *   │  ProblemPanel        │  EditorPanel                              │
 *   │  (Desc/Tests/...)    │  ┌──────────────────────────────────────┐ │
 *   │                      │  │ MonacoEditor                         │ │
 *   │                      │  └──────────────────────────────────────┘ │
 *   │                      │  Console / Tests / Output                 │
 *   └──────────────────────┴───────────────────────────────────────────┘
 */
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Play, Send, ArrowLeft, Clock } from 'lucide-react';

import { problems, submissions } from '@/lib/api';
import { streamSubmission, type SubmissionEvent } from '@/lib/ws';
import { useEditor } from '@/lib/store/editor';
import { ProblemPanel } from '@/components/problem/ProblemPanel';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { ConsolePanel } from '@/components/execution/ConsolePanel';
import { LanguageSelector } from '@/components/editor/LanguageSelector';
import { CommandPalette } from '@/components/shared/CommandPalette';

export default function ProblemIDE() {
  const { slug } = useParams<{ slug: string }>();
  const { language, files, setFiles } = useEditor();
  const [events, setEvents] = useState<SubmissionEvent[]>([]);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Load problem
  const problemQ = useQuery({
    queryKey: ['problem', slug],
    queryFn: () => problems.get(slug),
  });

  // Load starter when language changes (and no draft yet)
  useEffect(() => {
    if (Object.keys(files).length > 0) return;
    problems.starter(slug, language).then((res) => setFiles(res.files));
  }, [slug, language, files, setFiles]);

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
      const token = localStorage.getItem('sdc-access-token') ?? '';
      const stop = streamSubmission(sub.id, token, {
        onEvent: (e) => setEvents((prev) => [...prev, e]),
        onClose: () => setSubmittingId(null),
      });
      // Stop streaming when component unmounts
      return () => stop();
    },
  });

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key === 'Enter') {
        e.preventDefault();
        submit.mutate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submit]);

  if (problemQ.isLoading) return <div className="grid h-screen place-items-center text-muted">Loading…</div>;
  if (!problemQ.data) return <div className="grid h-screen place-items-center">Not found</div>;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar
        title={problemQ.data.title}
        difficulty={problemQ.data.difficulty}
        timeLimit={problemQ.data.time_limit_minutes}
        onRun={() => submit.mutate()}
        onSubmit={() => submit.mutate()}
        submitting={submit.isPending || submittingId !== null}
      />

      <PanelGroup direction="horizontal" className="flex-1">
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
                    {Object.keys(files).length} file{Object.keys(files).length !== 1 && 's'}
                  </div>
                </div>
                <CodeEditor />
              </div>
            </Panel>

            <PanelResizeHandle className="h-px bg-border hover:bg-accent transition-colors" />

            <Panel defaultSize={30} minSize={15}>
              <ConsolePanel events={events} submittingId={submittingId} />
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>

      <CommandPalette />
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
    difficulty === 'easy' ? 'text-emerald-400' : difficulty === 'medium' ? 'text-amber-400' : 'text-rose-400';
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
      <button className="rounded p-1 hover:bg-accent" aria-label="back">
        <ArrowLeft className="h-4 w-4" />
      </button>
      <h1 className="font-medium text-sm">{title}</h1>
      <span className={`text-xs uppercase tracking-wide ${diffColor}`}>{difficulty}</span>
      <div className="ml-auto flex items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> {timeLimit}m
        </span>
        <button
          onClick={onRun}
          disabled={submitting}
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
