'use client';

import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { Play, RotateCcw, Search, FileText, FileCode2, Code2, Home } from 'lucide-react';
import { useEditor, type Language } from '@/lib/store/editor';

const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'cpp', label: 'C++' },
  { id: 'go', label: 'Go' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'javascript', label: 'JavaScript' },
];

interface Props {
  onRun?: () => void;
  onResetCode?: () => void;
}

export function CommandPalette({ onRun, onResetCode }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { language, setLanguage, files, activeFile, setActiveFile } = useEditor();
  const filePaths = Object.keys(files);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('sdc:open-command-palette', onOpen);

    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('sdc:open-command-palette', onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className="fixed left-1/2 top-[20%] z-50 w-[560px] -translate-x-1/2 rounded-xl border border-border bg-background/95 shadow-2xl backdrop-blur"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Command.Input
          placeholder="Type a command or search…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="rounded border border-border px-1.5 text-[10px] text-muted-foreground">ESC</kbd>
      </div>
      <Command.List className="max-h-[320px] overflow-auto p-1.5">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
          No results found.
        </Command.Empty>

        <Command.Group heading="Actions" className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {onRun && (
            <CommandItem
              icon={<Play className="h-3.5 w-3.5" />}
              shortcut="⌘↵"
              onSelect={() => { setOpen(false); onRun(); }}
            >
              Run tests
            </CommandItem>
          )}
          {onResetCode && (
            <CommandItem
              icon={<RotateCcw className="h-3.5 w-3.5" />}
              onSelect={() => { setOpen(false); onResetCode(); }}
            >
              Reset code to starter
            </CommandItem>
          )}
        </Command.Group>

        {filePaths.length > 1 && (
          <Command.Group heading="Files" className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {filePaths.map((path) => (
              <CommandItem
                key={path}
                icon={<FileCode2 className="h-3.5 w-3.5" />}
                shortcut={path === activeFile ? 'active' : undefined}
                onSelect={() => { setActiveFile(path); setOpen(false); }}
              >
                Open {path}
              </CommandItem>
            ))}
          </Command.Group>
        )}

        {onRun && (
          <Command.Group heading="Language" className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {LANGUAGES.filter((l) => l.id !== language).map((l) => (
              <CommandItem
                key={l.id}
                icon={<Code2 className="h-3.5 w-3.5" />}
                onSelect={() => { setLanguage(l.id); setOpen(false); }}
              >
                Switch to {l.label}
              </CommandItem>
            ))}
          </Command.Group>
        )}

        <Command.Group heading="Navigate" className="text-[10px] uppercase tracking-wide text-muted-foreground">
          <CommandItem
            icon={<Home className="h-3.5 w-3.5" />}
            onSelect={() => { router.push('/'); setOpen(false); }}
          >
            Home
          </CommandItem>
          <CommandItem
            icon={<FileText className="h-3.5 w-3.5" />}
            onSelect={() => { router.push('/dashboard'); setOpen(false); }}
          >
            Dashboard
          </CommandItem>
          <CommandItem
            icon={<FileText className="h-3.5 w-3.5" />}
            onSelect={() => { router.push('/problems'); setOpen(false); }}
          >
            All problems
          </CommandItem>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}

function CommandItem({
  icon,
  shortcut,
  children,
  onSelect,
}: {
  icon: React.ReactNode;
  shortcut?: string;
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm aria-selected:bg-accent"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span>{children}</span>
      {shortcut && <kbd className="ml-auto text-[10px] text-muted-foreground">{shortcut}</kbd>}
    </Command.Item>
  );
}
