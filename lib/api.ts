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

export const api = {
  getKiosks: () => request<Kiosk[]>('/api/kiosks'),
  getKiosk: (id: string) => request<Kiosk>(`/api/kiosks/${id}`),
  getAlerts: (params?: { kiosk?: string; type?: string; severity?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<Alert[]>(`/api/alerts${qs ? `?${qs}` : ''}`);
  },
  resolveAlert: (id: string) =>
    request<{ success: boolean }>(`/api/alerts/${id}/resolve`, { method: 'POST' }),
  getAnalytics: (id: string, range: '7d' | '30d' | 'all') =>
    request<Analytics>(`/api/analytics/${id}?range=${range}`),
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
