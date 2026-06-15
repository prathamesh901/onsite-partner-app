import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlertFilterBar } from '../../../components/AlertFilterBar';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../../constants/theme';
import {
  AlertFilters,
  TYPE_GROUPS,
  buildListParams,
  filtersFromParams,
} from '../../../lib/alertFilters';
import { api } from '../../../lib/api';
import { AlertsPage, KioskAlert } from '../../../lib/types';

const PAGE_SIZE = 25;
const FILTER_DEBOUNCE_MS = 300;

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

function severityColor(severity: string | undefined): string {
  switch ((severity || '').toLowerCase()) {
    case 'critical': return Colors.error;
    case 'high': return '#E64980';
    case 'warning':
    case 'medium': return Colors.warning;
    default: return Colors.textMuted;
  }
}

function alertType(a: KioskAlert): string {
  return a.type ?? (a as any).alert_type ?? '';
}
function alertTime(a: KioskAlert): string | null {
  return a.created_at ?? (a as any).triggered_at ?? null;
}
function isResolved(a: KioskAlert): boolean {
  return a.resolved === true || a.resolved_at != null;
}
/** Tray alerts auto-clear from hardware — no manual Resolve. */
function autoResolves(a: KioskAlert): boolean {
  return alertType(a).toLowerCase().includes('tray');
}

/** Friendly chip-style label for a raw alert_type. */
function typeLabel(a: KioskAlert): string {
  const t = alertType(a);
  const group = TYPE_GROUPS.find((g) => g.types.includes(t));
  if (group) return group.label;
  // Fallback: prettify the raw type (door_open -> Door Open).
  return t ? t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Alert';
}

// ─── screen ──────────────────────────────────────────────────────────────────

export default function KioskAlertDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    kiosk_id: string;
    kiosk_name?: string;
    location?: string;
    status?: string;
    groups?: string;
    datePreset?: string;
    from?: string;
    to?: string;
  }>();

  const kioskId = params.kiosk_id;
  const kioskName = params.kiosk_name || kioskId;
  const location = params.location || '';

  const [filters, setFilters] = useState<AlertFilters>(() => filtersFromParams(params));
  const [appliedFilters, setAppliedFilters] = useState<AlertFilters>(filters);

  const [alerts, setAlerts] = useState<KioskAlert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const isMounted = useRef(true);
  // Paging cursors held in refs so onEndReached never reads stale closure state.
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Debounce filter edits before they hit the network.
  useEffect(() => {
    const t = setTimeout(() => setAppliedFilters(filters), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [filters]);

  const fetchPage = useCallback(
    async (mode: 'reset' | 'more') => {
      if (!kioskId) return;
      const offset = mode === 'reset' ? 0 : offsetRef.current;
      const path = `/api/alerts?${buildListParams(appliedFilters, {
        kioskId,
        limit: PAGE_SIZE,
        offset,
      })}`;
      try {
        const page = (await api.get(path)) as AlertsPage;
        if (!isMounted.current) return;
        const rows = Array.isArray(page?.alerts) ? page.alerts : [];
        setAlerts((prev) => (mode === 'reset' ? rows : [...prev, ...rows]));
        setTotal(page?.total ?? rows.length);
        offsetRef.current = offset + rows.length;
        hasMoreRef.current = Boolean(page?.has_more);
        setError(null);
      } catch (e: any) {
        if (!isMounted.current) return;
        setError(e?.message ?? 'Failed to load alerts');
      } finally {
        if (!isMounted.current) return;
        setLoading(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    },
    [appliedFilters, kioskId],
  );

  // Reload from page 1 whenever the debounced filters change.
  useEffect(() => {
    setLoading(true);
    offsetRef.current = 0;
    hasMoreRef.current = false;
    fetchPage('reset');
  }, [fetchPage]);

  function onEndReached() {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    fetchPage('more');
  }

  async function onRefresh() {
    setRefreshing(true);
    offsetRef.current = 0;
    await fetchPage('reset');
    if (isMounted.current) setRefreshing(false);
  }

  async function resolveAlert(id: string) {
    setResolvingId(id);
    try {
      await api.post(`/api/alerts/${id}/resolve`);
      if (!isMounted.current) return;
      // Optimistic, scroll-preserving update instead of a full reload.
      setAlerts((prev) => {
        if (appliedFilters.status === 'active') {
          // Row no longer matches the active filter — drop it.
          return prev.filter((a) => String(a.id) !== String(id));
        }
        return prev.map((a) =>
          String(a.id) === String(id)
            ? { ...a, resolved: true, resolved_at: new Date().toISOString() }
            : a,
        );
      });
      if (appliedFilters.status === 'active') {
        setTotal((t) => Math.max(0, t - 1));
        offsetRef.current = Math.max(0, offsetRef.current - 1);
      }
    } catch (e: any) {
      if (isMounted.current) setError(e?.message ?? 'Could not resolve alert.');
    } finally {
      if (isMounted.current) setResolvingId(null);
    }
  }

  const headerEl = useMemo(
    () => (
      <View style={styles.filterWrap}>
        <Text style={styles.countLine}>
          {total} {total === 1 ? 'alert' : 'alerts'}
          {appliedFilters.status !== 'all' ? ` · ${appliedFilters.status}` : ''}
        </Text>
        <AlertFilterBar filters={filters} onChange={setFilters} />
      </View>
    ),
    [filters, total, appliedFilters.status],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerMid}>
          <Text style={styles.headerTitle} numberOfLines={1}>{kioskName}</Text>
          {location ? <Text style={styles.headerSub} numberOfLines={1}>{location}</Text> : null}
        </View>
      </View>

      {loading ? (
        <View>
          {headerEl}
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.accent} />
          </View>
        </View>
      ) : error && alerts.length === 0 ? (
        <View>
          {headerEl}
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
              onPress={() => { setLoading(true); fetchPage('reset'); }}
            >
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(a) => String(a.id)}
          renderItem={({ item }) => (
            <AlertRow
              alert={item}
              resolving={resolvingId === String(item.id)}
              onResolve={resolveAlert}
            />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          ListHeaderComponent={headerEl}
          ListEmptyComponent={<EmptyState status={appliedFilters.status} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={Colors.accent} />
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─── alert row ───────────────────────────────────────────────────────────────

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
        <View style={styles.rowTopLine}>
          <Text style={styles.typeLabel}>{typeLabel(alert)}</Text>
          {alert.severity ? (
            <Text style={[styles.severityTag, { color }]}>{alert.severity}</Text>
          ) : null}
        </View>
        <Text style={styles.rowMessage} numberOfLines={3}>{alert.message}</Text>
        <View style={styles.rowMetaRow}>
          <Text style={styles.rowTime}>{formatAgo(alertTime(alert))}</Text>
          {autoResolves(alert) && !resolved && <Text style={styles.autoTag}>auto-clears</Text>}
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
          onPress={() => onResolve(String(alert.id))}
          disabled={resolving}
        >
          {resolving
            ? <ActivityIndicator size="small" color={Colors.accentDark} />
            : <Text style={styles.resolveText}>Resolve</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

function EmptyState({ status }: { status: string }) {
  const text =
    status === 'resolved' ? 'No resolved alerts in this range'
    : status === 'all' ? 'No alerts in this range'
    : 'No active alerts — all clear';
  return (
    <View style={styles.empty}>
      <Ionicons name="checkmark-circle" size={48} color={Colors.online} />
      <Text style={[Typography.h3, { marginTop: Spacing.md, textAlign: 'center' }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
    gap: Spacing.sm,
  },
  back: { width: 36 },
  headerMid: { flex: 1 },
  headerTitle: { ...Typography.h3, fontSize: 16 },
  headerSub: { ...Typography.caption, marginTop: 1 },

  filterWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.sm },
  countLine: { ...Typography.caption, fontWeight: '600', textTransform: 'capitalize' },

  list: { padding: Spacing.lg, paddingTop: 0, flexGrow: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, paddingTop: Spacing.xl * 2 },
  footer: { paddingVertical: Spacing.lg },
  empty: { alignItems: 'center', paddingTop: Spacing.xl * 2, paddingHorizontal: Spacing.lg },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    ...Shadow.card,
  },
  rowResolved: { opacity: 0.75 },
  severityDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  rowBody: { flex: 1, gap: 3 },
  rowTopLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  typeLabel: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  severityTag: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  rowMessage: { ...Typography.body },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  rowTime: { ...Typography.caption },
  autoTag: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, fontStyle: 'italic' },
  resolvedPill: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  resolvedPillText: { fontSize: 11, fontWeight: '600', color: Colors.online },
  resolveBtn: {
    backgroundColor: Colors.accent + '22',
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resolveText: { fontSize: 13, fontWeight: '700', color: Colors.accentDark },

  retryBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  retryText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
