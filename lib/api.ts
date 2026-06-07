import { ENV } from '../config/env';
import { getSessionToken } from './supabase';

const FETCH_TIMEOUT_MS = 10_000;

/** Error thrown by the API client carrying the HTTP status and parsed body. */
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  /** Plain object body — serialized to JSON automatically. */
  body?: unknown;
  /** Skip attaching the Authorization header (e.g. truly public endpoints). */
  skipAuth?: boolean;
};

async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  };

  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  if (!skipAuth) {
    // Read synchronously from the module-level cache — avoids calling
    // supabase.auth.getSession() which can deadlock when called from inside
    // an onAuthStateChange handler (the SDK holds an async lock during
    // session init, so a second getSession() call waits forever).
    const token = getSessionToken();
    console.log(`[api] ${options.method ?? 'GET'} ${path} — token attached: ${Boolean(token)}`);
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`;
    } else {
      console.warn(`[api] ${path} — no cached token; request will be unauthenticated`);
    }
  }

  const url = path.startsWith('http') ? path : `${ENV.API_BASE_URL}${path}`;
  console.log(`[api] fetching: ${url}`);

  const controller = new AbortController();
  const timer = setTimeout(() => {
    console.warn(`[api] timeout after ${FETCH_TIMEOUT_MS}ms — aborting ${path}`);
    controller.abort();
  }, FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    const isTimeout = (e as any)?.name === 'AbortError';
    throw new ApiError(
      0,
      isTimeout
        ? `Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`
        : 'Network request failed. Check your connection.',
      e,
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  console.log(`[api] ${path} — HTTP ${res.status}, body length: ${text.length}`);

  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const obj = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    const message =
      (obj && typeof obj.error === 'string' && obj.error) ||
      (obj && typeof obj.message === 'string' && obj.message) ||
      `Request failed (${res.status})`;
    throw new ApiError(res.status, String(message), parsed);
  }

  return parsed as T;
}

export const api = {
  get: <T = unknown>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T = unknown>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
