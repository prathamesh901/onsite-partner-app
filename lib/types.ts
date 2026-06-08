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

export interface PaperTotal {
  sheets_remaining: number;
  total_capacity: number;
  pct: number;
  zone: 'Good' | 'Low' | 'Critical' | 'Empty' | string;
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
}

/** Full kiosk detail returned by GET /api/kiosks/[id]. */
export interface KioskDetail extends Kiosk {
  model?: string;
  serial?: string;
  printer_ip?: string;
  page_count?: number;
  tray_config?: TrayConfig;
  alerts?: KioskAlert[];
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
