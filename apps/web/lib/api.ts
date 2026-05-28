/**
 * API client: thin fetch wrapper with auth, error handling, retries.
 * Access token lives in memory; refresh cookie is HttpOnly.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

let accessToken: string | null = null;
let refreshing: Promise<string> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
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
      accessToken = access_token;
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
  headers.set('Content-Type', 'application/json');
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
      throw new ApiError(401, { detail: 'Session expired' });
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

export const problems = {
  list: (params?: { category?: string; difficulty?: string; q?: string }) =>
    api<Problem[]>(`/problems?${new URLSearchParams(params as any).toString()}`),
  get: (slug: string) => api<Problem>(`/problems/${slug}`),
  starter: (slug: string, language: string) =>
    api<{ files: Array<{ path: string; contents: string }> }>(
      `/problems/${slug}/starter?language=${language}`,
    ),
};

export const submissions = {
  create: (data: { problem_slug: string; language: string; files: Array<{ path: string; contents: string }> }) =>
    api<Submission>('/submissions', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) => api<Submission>(`/submissions/${id}`),
};

export const auth = {
  login: async (email: string, password: string) => {
    const r = await api<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(r.access_token);
    return r;
  },
  me: () => api<{ id: string; email: string; username: string; plan: string; role: string }>('/auth/me'),
  logout: () => api('/auth/logout', { method: 'POST' }),
};
