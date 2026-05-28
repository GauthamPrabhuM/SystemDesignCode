import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Language = 'python' | 'java' | 'cpp' | 'go' | 'typescript' | 'javascript';

interface File {
  path: string;
  contents: string;
}

interface EditorState {
  activeFile: string;
  files: Record<string, string>;
  language: Language;
  theme: 'dark' | 'light';
  // panel sizes (percentages)
  problemPanelSize: number;
  consolePanelSize: number;

  setFile: (path: string, contents: string) => void;
  setFiles: (files: File[]) => void;
  setActiveFile: (path: string) => void;
  setLanguage: (lang: Language) => void;
  toggleTheme: () => void;
  setPanelSize: (panel: 'problem' | 'console', size: number) => void;
  reset: () => void;
}

export const useEditor = create<EditorState>()(
  persist(
    (set) => ({
      activeFile: 'main.py',
      files: {},
      language: 'python',
      theme: 'dark',
      problemPanelSize: 35,
      consolePanelSize: 30,

      setFile: (path, contents) =>
        set((s) => ({ files: { ...s.files, [path]: contents } })),
      setFiles: (files) =>
        set({
          files: Object.fromEntries(files.map((f) => [f.path, f.contents])),
          activeFile: files[0]?.path ?? 'main.py',
        }),
      setActiveFile: (path) => set({ activeFile: path }),
      setLanguage: (language) => set({ language }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setPanelSize: (panel, size) =>
        set(panel === 'problem' ? { problemPanelSize: size } : { consolePanelSize: size }),
      reset: () => set({ files: {}, activeFile: 'main.py' }),
    }),
    { name: 'sdc-editor' },
  ),
);
