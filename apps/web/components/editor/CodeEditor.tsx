'use client';

import { useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useEditor, type Language } from '@/lib/store/editor';
import { drafts } from '@/lib/api';

const LANGUAGE_MAP: Record<Language, string> = {
  python: 'python',
  java: 'java',
  cpp: 'cpp',
  go: 'go',
  typescript: 'typescript',
  javascript: 'javascript',
};

interface Props {
  slug?: string;
}

export function CodeEditor({ slug }: Props) {
  const { activeFile, files, language, setFile } = useEditor();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleMount: OnMount = (editor, monaco) => {
    monaco.editor.defineTheme('sdc-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6e7681', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff7b72' },
        { token: 'string', foreground: 'a5d6ff' },
        { token: 'number', foreground: '79c0ff' },
        { token: 'type', foreground: 'ffa657' },
      ],
      colors: {
        'editor.background': '#0a0a0a',
        'editor.foreground': '#e6edf3',
        'editorLineNumber.foreground': '#3d444d',
        'editor.selectionBackground': '#264f78',
        'editorCursor.foreground': '#e6edf3',
        'editor.lineHighlightBackground': '#161616',
      },
    });
    monaco.editor.setTheme('sdc-dark');

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      window.dispatchEvent(new CustomEvent('sdc:open-command-palette'));
    });
  };

  const handleChange = (value: string | undefined) => {
    if (value === undefined) return;
    setFile(activeFile, value);

    if (!slug) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('sdc-access-token') : null;
      if (!token) return;
      const state = useEditor.getState();
      const fileList = Object.entries(state.files).map(([path, contents]) => ({ path, contents }));
      drafts.save(slug, state.language, fileList);
    }, 1500);
  };

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={LANGUAGE_MAP[language]}
        value={files[activeFile] ?? ''}
        onChange={handleChange}
        onMount={handleMount}
        theme="sdc-dark"
        options={{
          fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
          fontSize: 13,
          lineHeight: 1.6,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          padding: { top: 12, bottom: 12 },
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderLineHighlight: 'all',
          guides: { indentation: true, bracketPairs: true },
          fontLigatures: true,
          tabSize: 2,
          formatOnPaste: true,
          formatOnType: true,
        }}
      />
    </div>
  );
}
