import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  plan: string;
  role: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  ready: boolean;
  setUser: (user: AuthUser | null) => void;
  setReady: () => void;
}

export const useAuth = create<AuthState>()((set) => ({
  user: null,
  ready: false,
  setUser: (user) => set({ user }),
  setReady: () => set({ ready: true }),
}));
