export interface Cartridge {
  id: string;
  name: string;
  level_pct: number;
  stage: string;
  low: boolean;
}

export interface PaperLevel {
  tray_id: string;
  tray_name: string;
  capacity: number;
  is_installed: boolean;
  sheets_remaining: number;
  pct: number;
  zone: 'good' | 'low' | 'critical' | 'empty';
}

export interface ErrorState {
  paper_jam: boolean;
  door_open: boolean;
  tray_open: boolean;
  cartridge_missing: boolean;
}

export interface Kiosk {
  kiosk_id: string;
  kiosk_name: string;
  location: string;
  status: string;
  page_count: number;
  cartridges: Cartridge[];
  trays: PaperLevel[];
  paper_levels: PaperLevel[];
  error_state: ErrorState;
  last_seen: string;
  online: boolean;
  active_alerts?: Alert[];
}

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertStatus = 'active' | 'resolved';

export interface Alert {
  id: string;
  kiosk_id: string;
  kiosk_name?: string;
  type: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  created_at: string;
  resolved_at?: string;
}

export interface AnalyticsDataPoint {
  date: string;
  page_count: number;
}

export interface Analytics {
  kiosk_id: string;
  range: string;
  data: AnalyticsDataPoint[];
}
