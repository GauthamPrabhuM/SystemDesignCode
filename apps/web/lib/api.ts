/**
 * API client: thin fetch wrapper with auth, error handling, retries.
 * Access token lives in memory + localStorage; refresh cookie is HttpOnly.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

let accessToken: string | null = null;
let refreshing: Promise<string> | null = null;

// Restore token from localStorage on module load (browser only)
if (typeof window !== 'undefined') {
  accessToken = localStorage.getItem('sdc-access-token');
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('sdc-access-token', token);
    } else {
      localStorage.removeItem('sdc-access-token');
    }
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function refresh(): Promise<string> {
  if (refreshing) return refreshing;
  refreshing = fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then(async (r) => {
      if (!r.ok) throw new Error('refresh failed');
      const { access_token } = await r.json();
      setAccessToken(access_token);
      return access_token as string;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(typeof body === 'object' && body && 'detail' in body ? String((body as any).detail) : 'API error');
  }
}

export async function api<T = unknown>(
  path: string,
  opts: RequestInit & { retried?: boolean } = {},
): Promise<T> {
  const headers = new Headers(opts.headers);
  if (!(opts.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...opts,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && !opts.retried) {
    try {
      await refresh();
      return api<T>(path, { ...opts, retried: true });
    } catch {
      setAccessToken(null);
      throw new ApiError(401, { detail: 'Session expired. Please sign in again.' });
    }
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---------- Typed endpoints ----------
export interface Problem {
  slug: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  statement_md: string;
  constraints: Record<string, unknown>;
  time_limit_minutes: number;
  is_premium: boolean;
}

export interface Submission {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'timeout';
  score: number | null;
  passed_tests: number | null;
  total_tests: number | null;
  runtime_ms: number | null;
  memory_kb: number | null;
  error: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  plan: string;
  role: string;
  created_at: string;
}

export const problems = {
  list: (params?: { category?: string; difficulty?: string; q?: string }) =>
    api<Problem[]>(`/problems?${new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v)) as Record<string, string>
    ).toString()}`),
  get: (slug: string) => api<Problem>(`/problems/${slug}`),
  starter: (slug: string, language: string) =>
    api<{ language: string; files: Array<{ path: string; contents: string }>; entrypoint: string }>(
      `/problems/${slug}/starter?language=${encodeURIComponent(language)}`,
    ),
};

export const submissions = {
  create: (data: { problem_slug: string; language: string; files: Array<{ path: string; contents: string }> }) =>
    api<Submission>('/submissions', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) => api<Submission>(`/submissions/${id}`),
};

export const drafts = {
  get: (slug: string, language: string) =>
    api<{ language: string; files: Array<{ path: string; contents: string }> } | null>(
      `/drafts/${slug}?language=${encodeURIComponent(language)}`,
    ).catch(() => null),
  save: (slug: string, language: string, files: Array<{ path: string; contents: string }>) =>
    api(`/drafts/${slug}`, {
      method: 'PUT',
      body: JSON.stringify({ language, files }),
    }).catch(() => {}),
};

export const auth = {
  register: (email: string, password: string, username: string, display_name?: string) =>
    api<UserProfile>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username, display_name }),
    }),
  login: async (email: string, password: string) => {
    const r = await api<{ access_token: string; expires_in: number }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(r.access_token);
    return r;
  },
  me: () => api<UserProfile>('/auth/me'),
  logout: async () => {
    setAccessToken(null);
    return api('/auth/logout', { method: 'POST' }).catch(() => {});
  },
};
