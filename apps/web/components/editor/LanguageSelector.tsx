'use client';

import { useEditor, type Language } from '@/lib/store/editor';

const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'cpp', label: 'C++' },
  { id: 'go', label: 'Go' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'javascript', label: 'JavaScript' },
];

export function LanguageSelector() {
  const { language, setLanguage } = useEditor();
  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value as Language)}
      className="rounded border border-border bg-background px-2 py-0.5 text-xs"
    >
      {LANGUAGES.map((l) => (
        <option key={l.id} value={l.id}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
