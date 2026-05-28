'use client';

import { useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useEditor, type Language } from '@/lib/store/editor';

const LANGUAGE_MAP: Record<Language, string> = {
  python: 'python',
  java: 'java',
  cpp: 'cpp',
  go: 'go',
  typescript: 'typescript',
  javascript: 'javascript',
};

export function CodeEditor() {
  const { activeFile, files, language, theme, setFile } = useEditor();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleMount: OnMount = (editor, monaco) => {
    // Custom theme tuned to feel premium — dark mode default
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

    // Make ⌘K open command palette instead of Monaco's
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      window.dispatchEvent(new CustomEvent('sdc:open-command-palette'));
    });
  };

  const handleChange = (value: string | undefined) => {
    if (value === undefined) return;
    setFile(activeFile, value);
    // Debounced draft autosave (1.5s)
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // TODO: PUT /drafts/{slug} — wire this once the route exists
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
        theme={theme === 'dark' ? 'sdc-dark' : 'vs-light'}
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
