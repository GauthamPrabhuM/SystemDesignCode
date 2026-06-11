import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ProblemStatus = 'attempted' | 'solved';

export interface ProblemProgress {
  status: ProblemStatus;
  bestScore: number;
  lastSubmittedAt: string; // ISO date
}

export interface RecentSubmission {
  slug: string;
  title: string;
  score: number;
  passed: number;
  total: number;
  at: string; // ISO date
}

interface ProgressState {
  problems: Record<string, ProblemProgress>;
  recent: RecentSubmission[];
  // ISO date (YYYY-MM-DD) → submission count, drives the activity heatmap
  activity: Record<string, number>;

  recordSubmission: (sub: RecentSubmission) => void;
}

const MAX_RECENT = 20;

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      problems: {},
      recent: [],
      activity: {},

      recordSubmission: (sub) =>
        set((s) => {
          const prev = s.problems[sub.slug];
          const solved = sub.score === 100;
          const day = sub.at.slice(0, 10);
          return {
            problems: {
              ...s.problems,
              [sub.slug]: {
                status: solved || prev?.status === 'solved' ? 'solved' : 'attempted',
                bestScore: Math.max(prev?.bestScore ?? 0, sub.score),
                lastSubmittedAt: sub.at,
              },
            },
            recent: [sub, ...s.recent].slice(0, MAX_RECENT),
            activity: { ...s.activity, [day]: (s.activity[day] ?? 0) + 1 },
          };
        }),
    }),
    { name: 'sdc-progress' },
  ),
);
