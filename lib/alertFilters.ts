// Shared filter model for the two-level Alerts view. The same filter object
// drives both the Level-1 overview (/api/alerts/summary) and the Level-2
// per-kiosk list (/api/alerts), and is serialised into backend query params so
// the database does the filtering — never an in-memory list.

export type AlertStatus = 'active' | 'resolved' | 'all';

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'last_30'
  | 'custom';

export interface TypeGroup {
  key: string;
  label: string;
  /** Underlying alert_type values this chip maps to (incl. legacy aliases). */
  types: string[];
}

// User-facing chips → the raw alert_type values written by the backend.
export const TYPE_GROUPS: TypeGroup[] = [
  { key: 'door', label: 'Door', types: ['door_open'] },
  { key: 'tray', label: 'Tray', types: ['tray_needs_attention', 'tray_low', 'tray_critical', 'tray_empty'] },
  { key: 'paper', label: 'Paper', types: ['paper_low', 'paper_critical', 'paper_empty'] },
  { key: 'jam', label: 'Jam', types: ['paper_jam'] },
  { key: 'cartridge', label: 'Cartridge', types: ['cartridge_missing'] },
];

export const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This week' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_30', label: 'Last 30 days' },
  { key: 'custom', label: 'Custom' },
];

export const STATUS_OPTIONS: { key: AlertStatus; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'All' },
];

export interface AlertFilters {
  status: AlertStatus;
  /** Selected TypeGroup keys; empty = all types. */
  groups: string[];
  datePreset: DatePreset;
  /** ISO bounds, only used when datePreset === 'custom'. */
  from: string | null;
  to: string | null;
}

export const DEFAULT_FILTERS: AlertFilters = {
  status: 'active',
  groups: [],
  datePreset: 'last_30',
  from: null,
  to: null,
};

// ─── date helpers ──────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Resolve the active preset (or custom bounds) to concrete ISO from/to. */
export function resolveDateRange(f: AlertFilters): { from: string | null; to: string | null } {
  const now = new Date();
  switch (f.datePreset) {
    case 'today':
      return { from: startOfDay(now).toISOString(), to: null };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() };
    }
    case 'this_week': {
      const s = startOfDay(now);
      const mondayOffset = (s.getDay() + 6) % 7; // week starts Monday
      s.setDate(s.getDate() - mondayOffset);
      return { from: s.toISOString(), to: null };
    }
    case 'this_month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { from: s.toISOString(), to: null };
    }
    case 'last_30': {
      const s = new Date(now);
      s.setDate(s.getDate() - 30);
      return { from: startOfDay(s).toISOString(), to: null };
    }
    case 'custom':
      return { from: f.from, to: f.to };
  }
}

/** Expand selected chip groups to the flat list of alert_type values. */
export function selectedTypes(groups: string[]): string[] {
  const out: string[] = [];
  for (const g of groups) {
    const def = TYPE_GROUPS.find((t) => t.key === g);
    if (def) out.push(...def.types);
  }
  return out;
}

// ─── query-param builders ──────────────────────────────────────────────────

function applyShared(p: URLSearchParams, f: AlertFilters) {
  const types = selectedTypes(f.groups);
  if (types.length > 0) p.set('type', types.join(','));
  const { from, to } = resolveDateRange(f);
  if (from) p.set('from', from);
  if (to) p.set('to', to);
}

/** Params for GET /api/alerts (per-kiosk list). */
export function buildListParams(
  f: AlertFilters,
  opts: { kioskId?: string; limit?: number; offset?: number } = {},
): string {
  const p = new URLSearchParams();
  if (opts.kioskId) p.set('kiosk_id', opts.kioskId);
  p.set('status', f.status);
  applyShared(p, f);
  if (opts.limit != null) p.set('limit', String(opts.limit));
  if (opts.offset != null) p.set('offset', String(opts.offset));
  return p.toString();
}

/** Params for GET /api/alerts/summary (status intentionally omitted). */
export function buildSummaryParams(f: AlertFilters): string {
  const p = new URLSearchParams();
  applyShared(p, f);
  return p.toString();
}

// ─── serialise filters for cross-route navigation ──────────────────────────

/** Flatten filters to string route params (Level 1 → Level 2 hand-off). */
export function filtersToParams(f: AlertFilters): Record<string, string> {
  return {
    status: f.status,
    groups: f.groups.join(','),
    datePreset: f.datePreset,
    from: f.from ?? '',
    to: f.to ?? '',
  };
}

/** Rebuild filters from route params, falling back to defaults. */
export function filtersFromParams(p: Record<string, string | undefined>): AlertFilters {
  const status = (p.status as AlertStatus) || DEFAULT_FILTERS.status;
  const datePreset = (p.datePreset as DatePreset) || DEFAULT_FILTERS.datePreset;
  const groups = p.groups ? p.groups.split(',').filter(Boolean) : [];
  return {
    status: ['active', 'resolved', 'all'].includes(status) ? status : DEFAULT_FILTERS.status,
    groups,
    datePreset,
    from: p.from ? p.from : null,
    to: p.to ? p.to : null,
  };
}

/** Short human label for the active date range (for compact summaries). */
export function dateRangeLabel(f: AlertFilters): string {
  if (f.datePreset !== 'custom') {
    return DATE_PRESETS.find((d) => d.key === f.datePreset)?.label ?? '';
  }
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '…';
  return `${fmt(f.from)} – ${fmt(f.to)}`;
}
