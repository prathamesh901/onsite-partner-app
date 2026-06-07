import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

import { KioskCard, countKioskAlerts } from '../../../components/KioskCard';
import { Colors, Spacing, Typography } from '../../../constants/theme';
import { api } from '../../../lib/api';
import { Kiosk } from '../../../lib/types';

const POLL_INTERVAL = 5000;

function unwrap(raw: unknown): Kiosk[] {
  if (Array.isArray(raw)) return raw as Kiosk[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const key of ['kiosks', 'data', 'results']) {
      if (Array.isArray(obj[key])) return obj[key] as Kiosk[];
    }
  }
  return [];
}

export default function KiosksScreen() {
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [updating, setUpdating] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);

  async function fetchKiosks(silent = false) {
    if (!isMounted.current) return;
    if (silent) setUpdating(true);
    try {
      const raw = await api.get('/api/kiosks');
      if (!isMounted.current) return;
      setKiosks(unwrap(raw));
      setError(null);
      setLastUpdated(new Date());
    } catch (e: any) {
      if (!isMounted.current) return;
      if (!silent) setError(e?.message ?? 'Failed to load kiosks');
    } finally {
      if (!isMounted.current) return;
      if (!silent) setLoading(false);
      setUpdating(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchKiosks(false);
    setRefreshing(false);
  }

  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchKiosks(true), POLL_INTERVAL);
  }, []);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchKiosks(false).then(() => startPolling());
      return stopPolling;
    }, [])
  );

  useEffect(() => {
    return () => {
      isMounted.current = false;
      stopPolling();
    };
  }, []);

  const onlineCount = kiosks.filter(k => k.online).length;
  const offlineCount = kiosks.filter(k => !k.online).length;
  const alertCount = kiosks.reduce((sum, k) => sum + countKioskAlerts(k), 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={[Typography.bodySecondary, { marginTop: Spacing.sm }]}>Loading kiosks…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && kiosks.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.textMuted} />
          <Text style={[Typography.h3, { marginTop: Spacing.md, textAlign: 'center' }]}>
            Couldn't load kiosks
          </Text>
          <Text style={[Typography.bodySecondary, { textAlign: 'center', marginTop: Spacing.xs }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { setLoading(true); fetchKiosks(false); }}
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
        data={kiosks}
        keyExtractor={k => k.kiosk_id}
        renderItem={({ item }) => <KioskCard kiosk={item} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
        ListHeaderComponent={
          <ListHeader
            count={kiosks.length}
            online={onlineCount}
            alerts={alertCount}
            offline={offlineCount}
            lastUpdated={lastUpdated}
            updating={updating}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="print-outline" size={48} color={Colors.textMuted} />
            <Text style={[Typography.h3, { marginTop: Spacing.md }]}>No kiosks assigned yet</Text>
            <Text style={[Typography.bodySecondary, { textAlign: 'center', marginTop: Spacing.xs }]}>
              Your kiosks will appear here once assigned.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

interface HeaderProps {
  count: number;
  online: number;
  alerts: number;
  offline: number;
  lastUpdated: Date | null;
  updating: boolean;
}

function ListHeader({ count, online, alerts, offline, lastUpdated, updating }: HeaderProps) {
  return (
    <View style={styles.headerContainer}>
      <View style={styles.titleRow}>
        <Text style={Typography.h1}>My Kiosks</Text>
        <Text style={styles.updateIndicator}>
          {updating ? 'updating…' : lastUpdated ? 'updated just now' : ''}
        </Text>
      </View>
      {count > 0 && (
        <View style={styles.summaryRow}>
          <StatPill icon="wifi" label="Online" value={online} color={Colors.online} />
          <StatPill
            icon="alert-circle"
            label="Alerts"
            value={alerts}
            color={alerts > 0 ? Colors.error : Colors.warning}
          />
          <StatPill icon="wifi-outline" label="Offline" value={offline} color={Colors.offline} />
        </View>
      )}
    </View>
  );
}

function StatPill({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={[styles.pill, { borderColor: color + '44' }]}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[styles.pillValue, { color }]}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  empty: { alignItems: 'center', paddingTop: Spacing.xl * 2 },
  headerContainer: { gap: Spacing.md, marginBottom: Spacing.lg },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  updateIndicator: { ...Typography.caption, color: Colors.textMuted },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillValue: { fontSize: 15, fontWeight: '700' as const },
  pillLabel: { ...Typography.caption, color: Colors.textSecondary },
  retryBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.accent,
    borderRadius: 999,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  retryText: { color: Colors.white, fontWeight: '700' as const, fontSize: 15 },
});
