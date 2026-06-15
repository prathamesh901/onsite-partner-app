import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { AlertKioskCard } from '../../../components/AlertKioskCard';
import { Colors, Spacing, Typography } from '../../../constants/theme';
import {
  AlertFilters,
  DEFAULT_FILTERS,
  buildSummaryParams,
  filtersToParams,
} from '../../../lib/alertFilters';
import { api } from '../../../lib/api';
import { KioskAlertSummary } from '../../../lib/types';

const POLL_INTERVAL = 15000;
const FILTER_DEBOUNCE_MS = 300;

function unwrap(raw: unknown): KioskAlertSummary[] {
  if (Array.isArray(raw)) return raw as KioskAlertSummary[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.kiosks)) return obj.kiosks as KioskAlertSummary[];
  }
  return [];
}

export default function AlertsOverviewScreen() {
  const router = useRouter();

  const [filters, setFilters] = useState<AlertFilters>(DEFAULT_FILTERS);
  const [summaries, setSummaries] = useState<KioskAlertSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced copy of the filters so rapid taps don't fire a request each time.
  const [appliedFilters, setAppliedFilters] = useState<AlertFilters>(DEFAULT_FILTERS);

  const isMounted = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Mirror the live params so the poll always fetches the current filter set.
  const paramsRef = useRef<string>(buildSummaryParams(DEFAULT_FILTERS));

  useEffect(() => {
    const t = setTimeout(() => setAppliedFilters(filters), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [filters]);

  const fetchSummary = useCallback(async (silent = false) => {
    if (!isMounted.current) return;
    const path = `/api/alerts/summary${paramsRef.current ? `?${paramsRef.current}` : ''}`;
    try {
      const raw = await api.get(path);
      if (!isMounted.current) return;
      setSummaries(unwrap(raw));
      setError(null);
    } catch (e: any) {
      if (!isMounted.current) return;
      if (!silent) setError(e?.message ?? 'Failed to load alerts');
    } finally {
      if (!isMounted.current) return;
      if (!silent) setLoading(false);
    }
  }, []);

  // Refetch whenever the debounced filters change.
  useEffect(() => {
    paramsRef.current = buildSummaryParams(appliedFilters);
    setLoading(true);
    fetchSummary(false);
  }, [appliedFilters, fetchSummary]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchSummary(true), POLL_INTERVAL);
  }, [fetchSummary]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSummary(true).then(() => startPolling());
      return stopPolling;
    }, [fetchSummary, startPolling, stopPolling]),
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  async function onRefresh() {
    setRefreshing(true);
    await fetchSummary(false);
    setRefreshing(false);
  }

  function openKiosk(summary: KioskAlertSummary) {
    router.push({
      pathname: '/alert/[kiosk_id]',
      params: {
        kiosk_id: summary.kiosk_id,
        kiosk_name: summary.kiosk_name ?? summary.kiosk_id,
        location: summary.location ?? '',
        ...filtersToParams(filters),
      },
    } as any);
  }

  const totalActive = summaries.reduce((sum, s) => sum + (s.active_count || 0), 0);

  const header = (
    <View style={styles.headerContainer}>
      <View style={styles.titleRow}>
        <Text style={Typography.h1}>Alerts</Text>
        {totalActive > 0 && (
          <View style={styles.activePill}>
            <View style={styles.activeDot} />
            <Text style={styles.activePillText}>{totalActive} active</Text>
          </View>
        )}
      </View>
      <AlertFilterBar filters={filters} onChange={setFilters} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerStandalone}>{header}</View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={[Typography.bodySecondary, { marginTop: Spacing.sm }]}>Loading alerts…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && summaries.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerStandalone}>{header}</View>
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
            onPress={() => { setLoading(true); fetchSummary(false); }}
          >
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={summaries}
        keyExtractor={(s) => s.kiosk_id}
        renderItem={({ item }) => (
          <AlertKioskCard summary={item} status={filters.status} onPress={openKiosk} />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ marginBottom: Spacing.md }}
        ListEmptyComponent={<EmptyState />}
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

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Ionicons name="checkmark-circle" size={48} color={Colors.online} />
      <Text style={[Typography.h3, { marginTop: Spacing.md }]}>No kiosks to show</Text>
      <Text style={[Typography.bodySecondary, { textAlign: 'center', marginTop: Spacing.xs }]}>
        Kiosks you can access will appear here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.lg, paddingTop: Spacing.lg, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  headerStandalone: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },

  headerContainer: { gap: Spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.error + '18',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.error },
  activePillText: { fontSize: 12, fontWeight: '700', color: Colors.error },

  empty: { alignItems: 'center', paddingTop: Spacing.xl * 2, paddingHorizontal: Spacing.lg },
  retryBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.accent,
    borderRadius: 9999,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  retryText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
