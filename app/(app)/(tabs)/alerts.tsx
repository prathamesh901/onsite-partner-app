import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Shadow, Spacing, Typography } from '../../../constants/theme';
import { api } from '../../../lib/api';
import { Kiosk, KioskAlert } from '../../../lib/types';

const POLL_INTERVAL = 5000;

type Filter = 'active' | 'resolved' | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'All' },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatAgo(iso: string | undefined | null): string {
  if (!iso) return '—';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return '—';
  }
}

function severityColor(severity: string): string {
  switch ((severity || '').toLowerCase()) {
    case 'critical': return Colors.error;
    case 'high': return '#E64980';
    case 'warning':
    case 'medium': return Colors.warning;
    default: return Colors.textMuted;
  }
}

function isResolved(a: KioskAlert): boolean {
  // Treat missing/null resolved field as NOT resolved (active).
  if (a.resolved_at != null) return true;
  if (a.resolved === true) return true;
  return false;
}

/** Tray alerts auto-resolve from hardware — don't offer a manual Resolve button. */
function autoResolves(a: KioskAlert): boolean {
  return (a.type ?? '').toLowerCase().includes('tray');
}

function alertKioskId(a: KioskAlert): string {
  return a.kiosk_id ?? (a as any).kiosk ?? 'unknown';
}

function buildPath(f: Filter): string {
  if (f === 'active') return '/api/alerts?resolved=false';
  if (f === 'resolved') return '/api/alerts?resolved=true';
  return '/api/alerts';
}

function unwrapAlerts(raw: unknown): KioskAlert[] {
  if (Array.isArray(raw)) return raw as KioskAlert[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    // Try every envelope key the backend might use.
    for (const key of ['alerts', 'active_alerts', 'tray_alerts', 'data', 'results', 'items']) {
      if (Array.isArray(obj[key])) return obj[key] as KioskAlert[];
    }
  }
  return [];
}

function unwrapKiosks(raw: unknown): Kiosk[] {
  if (Array.isArray(raw)) return raw as Kiosk[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const key of ['kiosks', 'data', 'results']) {
      if (Array.isArray(obj[key])) return obj[key] as Kiosk[];
    }
  }
  return [];
}

interface KioskMeta { name: string; location: string }
interface Section {
  kioskId: string;
  name: string;
  location: string;
  activeCount: number;
  total: number;
  data: KioskAlert[];
}

function buildSections(
  alerts: KioskAlert[],
  filter: Filter,
  kioskMap: Record<string, KioskMeta>,
): Section[] {
  // Client-side filter as a safety net in case the backend ignores ?resolved.
  const visible = alerts.filter(a => {
    if (filter === 'active') return !isResolved(a);
    if (filter === 'resolved') return isResolved(a);
    return true;
  });

  const groups = new Map<string, KioskAlert[]>();
  for (const a of visible) {
    const id = alertKioskId(a);
    const arr = groups.get(id);
    if (arr) arr.push(a);
    else groups.set(id, [a]);
  }

  const sections: Section[] = [];
  for (const [kioskId, list] of groups) {
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const meta = kioskMap[kioskId];
    const name = meta?.name ?? list[0]?.kiosk_name ?? kioskId;
    sections.push({
      kioskId,
      name,
      location: meta?.location ?? '',
      activeCount: list.filter(a => !isResolved(a)).length,
      total: list.length,
      data: list,
    });
  }

  // Kiosks with active alerts first, then alphabetical.
  sections.sort((a, b) => {
    if ((b.activeCount > 0 ? 1 : 0) !== (a.activeCount > 0 ? 1 : 0)) {
      return (b.activeCount > 0 ? 1 : 0) - (a.activeCount > 0 ? 1 : 0);
    }
    return a.name.localeCompare(b.name);
  });
  return sections;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<KioskAlert[]>([]);
  const [kioskMap, setKioskMap] = useState<Record<string, KioskMeta>>({});
  const [filter, setFilter] = useState<Filter>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);
  const filterRef = useRef<Filter>(filter);

  const fetchAlerts = useCallback(async (silent = false) => {
    if (!isMounted.current) return;
    try {
      const path = buildPath(filterRef.current);
      const raw = await api.get(path);
      if (!isMounted.current) return;
      const parsed = unwrapAlerts(raw);
      console.log(
        '[Alerts] GET', path,
        '| raw keys:', raw && typeof raw === 'object' ? Object.keys(raw as object) : typeof raw,
        '| unwrapped count:', parsed.length,
        '| types:', parsed.map((a: KioskAlert) => a.type ?? a.id).join(', ') || '(none)',
      );
      if (parsed.length === 0) {
        console.log('[Alerts] Full raw response:', JSON.stringify(raw));
      }
      setAlerts(parsed);
      setError(null);
    } catch (e: any) {
      if (!isMounted.current) return;
      if (!silent) setError(e?.message ?? 'Failed to load alerts');
    } finally {
      if (!isMounted.current) return;
      if (!silent) setLoading(false);
    }
  }, []);

  const fetchKioskMap = useCallback(async () => {
    try {
      const raw = await api.get('/api/kiosks');
      if (!isMounted.current) return;
      const map: Record<string, KioskMeta> = {};
      for (const k of unwrapKiosks(raw)) {
        map[k.kiosk_id] = { name: k.kiosk_name, location: k.location };
      }
      setKioskMap(map);
    } catch {
      // Names fall back to the alert payload / kiosk id; non-fatal.
    }
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchAlerts(true), POLL_INTERVAL);
  }, [fetchAlerts]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchKioskMap();
      fetchAlerts(false).then(() => startPolling());
      return stopPolling;
    }, [fetchAlerts, fetchKioskMap, startPolling, stopPolling]),
  );

  useEffect(() => {
    return () => {
      isMounted.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  function selectFilter(f: Filter) {
    if (f === filter) return;
    filterRef.current = f;
    setFilter(f);
    setLoading(true);
    fetchAlerts(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([fetchKioskMap(), fetchAlerts(false)]);
    setRefreshing(false);
  }

  async function resolveAlert(alertId: string) {
    setResolvingId(alertId);
    try {
      await api.post(`/api/alerts/${alertId}/resolve`);
      await fetchAlerts(true);
    } catch (e: any) {
      // Surface inline by leaving the alert in place; lightweight feedback.
      setError(e?.message ?? 'Could not resolve alert.');
    } finally {
      if (isMounted.current) setResolvingId(null);
    }
  }

  const sections = buildSections(alerts, filter, kioskMap);
  const totalActive = alerts.filter(a => !isResolved(a)).length;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header filter={filter} onSelect={selectFilter} totalActive={totalActive} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={[Typography.bodySecondary, { marginTop: Spacing.sm }]}>Loading alerts…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error && alerts.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header filter={filter} onSelect={selectFilter} totalActive={totalActive} />
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.textMuted} />
          <Text style={[Typography.h3, { marginTop: Spacing.md, textAlign: 'center' }]}>
            Couldn't load alerts
          </Text>
          <Text style={[Typography.bodySecondary, { textAlign: 'center', marginTop: Spacing.xs }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { setLoading(true); fetchAlerts(false); }}
          >
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AlertRow
            alert={item}
            resolving={resolvingId === item.id}
            onResolve={resolveAlert}
          />
        )}
        renderSectionHeader={({ section }) => <SectionHeader section={section as Section} />}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled
        ListHeaderComponent={
          <Header filter={filter} onSelect={selectFilter} totalActive={totalActive} embedded />
        }
        ListEmptyComponent={<EmptyState filter={filter} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
      />
    </SafeAreaView>
  );
}

// ─── Header + filter ─────────────────────────────────────────────────────────

function Header({
  filter,
  onSelect,
  totalActive,
  embedded = false,
}: {
  filter: Filter;
  onSelect: (f: Filter) => void;
  totalActive: number;
  embedded?: boolean;
}) {
  return (
    <View style={[styles.headerContainer, !embedded && styles.headerStandalone]}>
      <View style={styles.titleRow}>
        <Text style={Typography.h1}>Alerts</Text>
        {totalActive > 0 && (
          <View style={styles.activePill}>
            <View style={styles.activeDot} />
            <Text style={styles.activePillText}>{totalActive} active</Text>
          </View>
        )}
      </View>
      <View style={styles.segment}>
        {FILTERS.map(({ key, label }) => {
          const active = key === filter;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
              onPress={() => onSelect(key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Section header ──────────────────────────────────────────────────────────

function SectionHeader({ section }: { section: Section }) {
  const hasActive = section.activeCount > 0;
  const badgeValue = hasActive ? section.activeCount : section.total;
  const badgeColor = hasActive ? Colors.error : Colors.textMuted;
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleGroup}>
        <Text style={styles.sectionTitle} numberOfLines={1}>{section.name}</Text>
        {section.location ? (
          <Text style={styles.sectionLocation} numberOfLines={1}>{section.location}</Text>
        ) : null}
      </View>
      <View style={[styles.countBadge, { backgroundColor: badgeColor }]}>
        <Text style={styles.countText}>{badgeValue}</Text>
      </View>
    </View>
  );
}

// ─── Alert row ───────────────────────────────────────────────────────────────

function AlertRow({
  alert,
  resolving,
  onResolve,
}: {
  alert: KioskAlert;
  resolving: boolean;
  onResolve: (id: string) => void;
}) {
  const color = severityColor(alert.severity);
  const resolved = isResolved(alert);
  const showResolve = !resolved && !autoResolves(alert);

  return (
    <View style={[styles.row, resolved && styles.rowResolved]}>
      <View style={[styles.severityDot, { backgroundColor: resolved ? Colors.online : color }]} />
      <View style={styles.rowBody}>
        <Text style={styles.rowMessage} numberOfLines={3}>{alert.message}</Text>
        <View style={styles.rowMetaRow}>
          <Text style={styles.rowTime}>{formatAgo(alert.created_at)}</Text>
          {autoResolves(alert) && !resolved && (
            <Text style={styles.autoTag}>auto-clears</Text>
          )}
          {resolved && (
            <View style={styles.resolvedPill}>
              <Ionicons name="checkmark" size={11} color={Colors.online} />
              <Text style={styles.resolvedPillText}>Resolved</Text>
            </View>
          )}
        </View>
      </View>
      {showResolve && (
        <TouchableOpacity
          style={[styles.resolveBtn, resolving && { opacity: 0.6 }]}
          onPress={() => onResolve(alert.id)}
          disabled={resolving}
        >
          {resolving
            ? <ActivityIndicator size="small" color={Colors.accentDark} />
            : <Text style={styles.resolveText}>Resolve</Text>
          }
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: Filter }) {
  const text =
    filter === 'resolved' ? 'No resolved alerts yet'
    : filter === 'all' ? 'No alerts — all clear'
    : 'No active alerts — all clear';
  return (
    <View style={styles.empty}>
      <Ionicons name="checkmark-circle" size={48} color={Colors.online} />
      <Text style={[Typography.h3, { marginTop: Spacing.md }]}>{text}</Text>
      <Text style={[Typography.bodySecondary, { textAlign: 'center', marginTop: Spacing.xs }]}>
        Alerts across your kiosks will appear here.
      </Text>
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.lg, paddingTop: Spacing.md, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },

  headerContainer: { gap: Spacing.md, marginBottom: Spacing.md },
  headerStandalone: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.error + '18',
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.error },
  activePillText: { fontSize: 12, fontWeight: '700' as const, color: Colors.error },

  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.pillBg,
    borderRadius: Radius.pill,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  segmentBtnActive: { backgroundColor: Colors.card, ...Shadow.card },
  segmentText: { fontSize: 14, fontWeight: '600' as const, color: Colors.textSecondary },
  segmentTextActive: { color: Colors.accentDark },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
    backgroundColor: Colors.background,
  },
  sectionTitleGroup: { flex: 1 },
  sectionTitle: { ...Typography.h3, fontSize: 16 },
  sectionLocation: { ...Typography.caption, marginTop: 1 },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  countText: { fontSize: 12, fontWeight: '700' as const, color: Colors.white },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.card,
  },
  rowResolved: { opacity: 0.75 },
  severityDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  rowBody: { flex: 1, gap: 4 },
  rowMessage: { ...Typography.body },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  rowTime: { ...Typography.caption },
  autoTag: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  resolvedPill: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  resolvedPillText: { fontSize: 11, fontWeight: '600' as const, color: Colors.online },
  resolveBtn: {
    backgroundColor: Colors.accent + '22',
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resolveText: { fontSize: 13, fontWeight: '700' as const, color: Colors.accentDark },

  empty: { alignItems: 'center', paddingTop: Spacing.xl * 2, paddingHorizontal: Spacing.lg },

  retryBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  retryText: { color: Colors.white, fontWeight: '700' as const, fontSize: 15 },
});
