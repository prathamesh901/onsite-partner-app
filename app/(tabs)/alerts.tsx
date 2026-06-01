import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertCard } from '../../components/AlertCard';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../constants/theme';
import { usePolling } from '../../hooks/usePolling';
import { api } from '../../lib/api';
import { Alert } from '../../lib/types';

type SeverityFilter = 'all' | 'critical' | 'warning';
type StatusFilter = 'active' | 'all';

export default function AlertsScreen() {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetcher = useCallback(() => api.getAlerts(), []);
  const { data: alerts, loading, error, refresh } = usePolling<Alert[]>(fetcher);

  const safeAlerts = Array.isArray(alerts) ? alerts : [];

  const filtered = safeAlerts.filter((a) => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (statusFilter === 'active' && a.status !== 'active') return false;
    return true;
  });

  const criticalCount = safeAlerts.filter((a) => a.severity === 'critical' && a.status === 'active').length;
  const warningCount = safeAlerts.filter((a) => a.severity === 'warning' && a.status === 'active').length;
  const resolvedCount = safeAlerts.filter((a) => a.status === 'resolved').length;

  async function handleResolve(id: string) {
    setResolvingId(id);
    try {
      await api.resolveAlert(id);
      refresh();
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading && safeAlerts.length > 0}
            onRefresh={refresh}
            tintColor={Colors.primary}
          />
        }
      >
        <Text style={[Typography.headlineMd, { color: Colors.onSurface, marginBottom: Spacing.md }]}>
          Alerts
        </Text>

        {/* Filter pills — horizontal scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={{ marginBottom: Spacing.md }}
        >
          <FilterPill label="All" active={severityFilter === 'all'} onPress={() => setSeverityFilter('all')} />
          <FilterPill
            label={`Critical${criticalCount > 0 ? ` · ${criticalCount}` : ''}`}
            active={severityFilter === 'critical'}
            onPress={() => setSeverityFilter('critical')}
          />
          <FilterPill
            label={`Warning${warningCount > 0 ? ` · ${warningCount}` : ''}`}
            active={severityFilter === 'warning'}
            onPress={() => setSeverityFilter('warning')}
          />
          <FilterPill
            label="Active"
            active={statusFilter === 'active'}
            onPress={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
          />
          <FilterPill
            label={`Resolved${resolvedCount > 0 ? ` · ${resolvedCount}` : ''}`}
            active={statusFilter === 'all' && severityFilter === 'all'}
            onPress={() => { setStatusFilter('all'); setSeverityFilter('all'); }}
          />
        </ScrollView>

        {loading && safeAlerts.length === 0 && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
        {!!error && safeAlerts.length === 0 && (
          <View style={styles.errorBox}>
            <Text style={[Typography.bodySm, { color: Colors.error }]}>{error}</Text>
          </View>
        )}
        {filtered.length === 0 && !loading && safeAlerts.length > 0 && (
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>✅</Text>
            <Text style={[Typography.headlineSm, { color: Colors.onSurface, marginTop: 12 }]}>
              All clear
            </Text>
            <Text style={[Typography.bodySm, { color: Colors.onSurfaceVariant, marginTop: 4, textAlign: 'center' }]}>
              No {severityFilter !== 'all' ? severityFilter : ''} alerts right now
            </Text>
          </View>
        )}

        {filtered.map((a) => (
          <AlertCard
            key={a.id}
            alert={a}
            onResolve={a.status === 'active' ? handleResolve : undefined}
            resolving={resolvingId === a.id}
          />
        ))}

        {/* Fleet health summary card */}
        {safeAlerts.length > 0 && (
          <View style={styles.fleetCard}>
            <View style={{ flex: 1 }}>
              <Text style={[Typography.headlineMd, { color: '#fff' }]}>Fleet Health</Text>
              <Text style={[Typography.bodySm, { color: 'rgba(255,255,255,0.7)', marginTop: 4 }]}>
                Summary across all kiosks
              </Text>
            </View>
            <View style={styles.fleetStats}>
              <View style={{ alignItems: 'center' }}>
                <Text style={[Typography.displayLg, { color: '#fff' }]}>{criticalCount}</Text>
                <Text style={[Typography.labelSm, { color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }]}>
                  Critical
                </Text>
              </View>
              <View style={styles.fleetDivider} />
              <View style={{ alignItems: 'center' }}>
                <Text style={[Typography.displayLg, { color: '#fff' }]}>{warningCount}</Text>
                <Text style={[Typography.labelSm, { color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }]}>
                  Warnings
                </Text>
              </View>
              <View style={styles.fleetDivider} />
              <View style={{ alignItems: 'center' }}>
                <Text style={[Typography.displayLg, { color: '#fff' }]}>{resolvedCount}</Text>
                <Text style={[Typography.labelSm, { color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }]}>
                  Resolved
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.pill, active && styles.pillActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[Typography.labelMd, { color: active ? Colors.onPrimary : Colors.onSurfaceVariant }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.marginMobile, paddingBottom: 32 },
  filterRow: { gap: 8, paddingBottom: 4 },
  pill: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    ...Shadow.card,
  },
  pillActive: {
    backgroundColor: Colors.primaryContainer,
    borderColor: Colors.primaryContainer,
  },
  center: { paddingTop: 60, alignItems: 'center' },
  errorBox: {
    backgroundColor: Colors.errorContainer,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  empty: { alignItems: 'center', paddingTop: 48, paddingBottom: 48 },
  fleetCard: {
    backgroundColor: Colors.inverseSurface,
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.md,
    ...Shadow.card,
  },
  fleetStats: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  fleetDivider: { width: 1, height: 48, backgroundColor: 'rgba(255,255,255,0.2)' },
});
