'use client';

import { FileCode2 } from 'lucide-react';
import { useEditor } from '@/lib/store/editor';

/** Tab bar for switching between files in a multi-file problem. Hidden for single-file problems. */
export function FileTabs() {
  const { files, activeFile, setActiveFile } = useEditor();
  const paths = Object.keys(files);
  if (paths.length <= 1) return null;

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border bg-muted/10 px-1.5 py-1">
      {paths.map((path) => (
        <button
          key={path}
          onClick={() => setActiveFile(path)}
          className={`flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1 font-mono text-xs transition-colors ${
            path === activeFile
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
          }`}
        >
          <FileCode2 className="h-3 w-3 opacity-60" />
          {path}
        </button>
      ))}
    </div>
  );
}
