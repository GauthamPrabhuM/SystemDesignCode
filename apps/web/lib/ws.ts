/**
 * Submission event stream client.
 * Opens a WS, parses JSON events, calls handlers. Auto-reconnect on transient close.
 */
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000';

export type SubmissionEvent =
  | { type: 'status'; status: 'queued' | 'running' | 'done' | 'failed' }
  | { type: 'log'; stream: 'stdout' | 'stderr'; line: string; test?: string }
  | {
      type: 'test';
      test_id: string;
      name: string;
      status: 'passed' | 'failed' | 'error' | 'timeout';
      runtime_ms: number;
      diff?: string;
      stderr?: string;
      stdout?: string;
    }
  | {
      type: 'result';
      score: number;
      passed: number;
      total: number;
      runtime_ms: number;
      memory_kb: number;
    }
  | { type: 'failed'; error: string; stderr?: string }
  | { type: 'timeout'; error?: string }
  | { type: 'ai_review_done'; review_id: string };

export interface StreamHandlers {
  onEvent: (e: SubmissionEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: Event) => void;
}

export function streamSubmission(
  submissionId: string,
  accessToken: string,
  handlers: StreamHandlers,
): () => void {
  const url = `${WS_URL}/api/v1/submissions/${submissionId}/stream?access_token=${encodeURIComponent(accessToken)}`;
  const ws = new WebSocket(url);

  ws.onopen = () => handlers.onOpen?.();
  ws.onclose = () => handlers.onClose?.();
  ws.onerror = (e) => handlers.onError?.(e);
  ws.onmessage = (msg) => {
    try {
      handlers.onEvent(JSON.parse(msg.data) as SubmissionEvent);
    } catch {
      /* skip malformed */
    }
  };

  return () => {
    try {
      ws.close();
    } catch {
      /* noop */
    }
  };
}
