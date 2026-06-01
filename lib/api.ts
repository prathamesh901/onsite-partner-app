import { Alert, Analytics, Kiosk } from './types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';

const headers = {
  'x-api-key': API_KEY,
  'Content-Type': 'application/json',
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

// Some endpoints return { kiosks: [...] } / { alerts: [...] } envelopes.
// These helpers unwrap to a plain array, defaulting to [] on bad shapes.
function unwrapArray<T>(raw: unknown, key: string): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object' && key in (raw as object)) {
    const inner = (raw as Record<string, unknown>)[key];
    if (Array.isArray(inner)) return inner as T[];
  }
  return [];
}

export const api = {
  getKiosks: () =>
    request<unknown>('/api/kiosks').then((r) => unwrapArray<Kiosk>(r, 'kiosks')),
  getKiosk: (id: string) => request<Kiosk>(`/api/kiosks/${id}`),
  getAlerts: (params?: { kiosk?: string; type?: string; severity?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<unknown>(`/api/alerts${qs ? `?${qs}` : ''}`)
      .then((r) => unwrapArray<Alert>(r, 'alerts'));
  },
  resolveAlert: (id: string) =>
    request<{ success: boolean }>(`/api/alerts/${id}/resolve`, { method: 'POST' }),
  getAnalytics: (id: string, range: '7d' | '30d' | 'all') =>
    request<unknown>(`/api/analytics/${id}?range=${range}`).then((r) => {
      const obj = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
      return {
        kiosk_id: (obj.kiosk_id as string) ?? id,
        range: (obj.range as string) ?? range,
        data: Array.isArray(obj.data) ? obj.data : [],
      } as Analytics;
    }),
  refill: (kiosk_id: string, tray_id: string, sheets_added: number) =>
    request<{ success: boolean }>('/api/refill', {
      method: 'POST',
      body: JSON.stringify({ kiosk_id, tray_id, sheets_added }),
    }),
  installTray: (kiosk_id: string, tray_id: string) =>
    request<{ success: boolean }>(`/api/trays/${kiosk_id}/${tray_id}/install`, {
      method: 'POST',
    }),
};
