export interface Cartridge {
  id: string;
  name: string;
  level_pct: number | null;
  stage: string;
  low: boolean;
  critical: boolean;
  empty: boolean;
  unreadable: boolean;
}

/** Per-tray status within a PaperTotal (one entry per INSTALLED tray). */
export interface PaperTotalTray {
  tray_id: string;
  tray_name: string | null;
  capacity: number;
  tray_num: string; // "2" | "3"
  is_open: boolean;
}

export interface PaperTotal {
  sheets_remaining: number;
  total_capacity: number;
  pct: number;
  zone: 'Good' | 'Low' | 'Critical' | 'Empty' | string;
  trays?: PaperTotalTray[];
}

export interface ErrorState {
  door_open: boolean;
  paper_jam: boolean;
  cartridge_missing: boolean;
  tray2_open: boolean;
  tray3_open: boolean;
  any_error: boolean;
}

export interface Kiosk {
  kiosk_id: string;
  kiosk_name: string;
  location: string;
  kiosk_type: 'standard' | 'estamp';
  color_mode: string;
  status: 'idle' | 'printing' | 'warmup' | 'unknown';
  online: boolean;
  last_seen: string;
  cartridges: Cartridge[];
  paper_total: PaperTotal;
  error_state: ErrorState;
}

export interface TrayInfo {
  installed: boolean;
  capacity?: number;
}

export interface TrayConfig {
  tray2?: TrayInfo;
  tray3?: TrayInfo;
}

export interface KioskAlert {
  id: string;
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  created_at: string;
  resolved: boolean;
  resolved_at?: string | null;
  kiosk_id?: string;
  kiosk_name?: string;
  tray_id?: string | null;
}

/** One row from GET /api/alerts/summary — per-kiosk alert counts. */
export interface KioskAlertSummary {
  kiosk_id: string;
  kiosk_name: string | null;
  location: string | null;
  active_count: number;
  total_count: number;
}

/** Envelope returned by GET /api/alerts (filtered + paginated). */
export interface AlertsPage {
  alerts: KioskAlert[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

/** Full kiosk detail returned by GET /api/kiosks/[id]. */
export interface KioskDetail extends Kiosk {
  model?: string;
  serial?: string;
  printer_ip?: string;
  page_count?: number;
  tray_config?: TrayConfig;
  ownership?: Ownership;
  franchise_partner_id?: string | null;
  alerts?: KioskAlert[];
}

/** Kiosk ownership type. null = newly-registered / unassigned. */
export type Ownership = 'printbuddy' | 'franchise' | null;

/** A kiosk row from GET /api/admin/kiosks (ownership roster). */
export interface AdminKiosk {
  kiosk_id: string;
  kiosk_name: string | null;
  location: string | null;
  model: string | null;
  ownership: Ownership;
  franchise_partner_id: string | null;
  last_seen: string | null;
  updated_at?: string | null;
}

/** An invite row from GET /api/invites and the POST /api/invites result. */
export interface Invite {
  id: string;
  email: string;
  kiosk_id: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired' | string;
  token?: string;
  created_at: string;
  accepted_at?: string | null;
  expires_at?: string | null;
}

/** An onsite partner from GET /api/partners (kiosk_ids clipped to caller's scope). */
export interface Partner {
  id: string;
  email: string | null;
  name: string | null;
  phone?: string | null;
  role: string;
  status: string;
  kiosk_ids: string[];
}

/** User role returned by GET /api/auth/me. */
export type UserRole = 'admin' | 'partner' | 'staff' | string;

/** Account approval status returned by GET /api/auth/me. */
export type UserStatus = 'approved' | 'pending' | 'rejected' | 'suspended' | string;

/** Profile shape from GET /api/auth/me. Extra fields are tolerated. */
export interface UserProfile {
  id?: string;
  email?: string;
  name?: string;
  role: UserRole;
  status: UserStatus;
  [key: string]: unknown;
}
