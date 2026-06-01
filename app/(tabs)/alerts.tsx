import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertCard } from '../../components/AlertCard';
import { Colors, Radius } from '../../constants/theme';
import { usePolling } from '../../hooks/usePolling';
import { api } from '../../lib/api';
import { Alert } from '../../lib/types';

type SeverityFilter = 'all' | 'critical' | 'warning';

export default function AlertsScreen() {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetcher = useCallback(() => api.getAlerts(), []);
  const { data: alerts, loading, error, refresh } = usePolling<Alert[]>(fetcher);

  const safeAlerts = Array.isArray(alerts) ? alerts : [];
  const filtered = safeAlerts.filter((a) => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    return true;
  });

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
        refreshControl={<RefreshControl refreshing={loading && !!alerts} onRefresh={refresh} tintColor={Colors.primary} />}
      >
        <Text style={styles.title}>Alerts</Text>
        <View style={styles.filterRow}>
          {(['all', 'critical', 'warning'] as SeverityFilter[]).map((f) => (
            <FilterPill key={f} label={f.charAt(0).toUpperCase() + f.slice(1)} active={severityFilter === f} onPress={() => setSeverityFilter(f)} />
          ))}
        </View>
        {loading && !alerts && (
          <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
        )}
        {!!error && !alerts && (
          <View style={styles.errorBox}><Text style={styles.errorText}>⚠️ {error}</Text></View>
        )}
        {filtered?.length === 0 && !loading && (
          <View style={styles.empty}><Text style={styles.emptyText}>No alerts {severityFilter !== 'all' ? `matching "${severityFilter}"` : ''}</Text></View>
        )}
        {filtered?.map((a) => (
          <AlertCard
            key={a.id}
            alert={a}
            onResolve={a.status === 'active' ? handleResolve : undefined}
            resolving={resolvingId === a.id}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.pill, active && styles.pillActive]}
      onPress={onPress}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, marginBottom: 14 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  pill: {
    borderRadius: Radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.pillUnselectedBg,
  },
  pillActive: { backgroundColor: Colors.primary },
  pillText: { fontSize: 13, fontWeight: '600', color: Colors.pillUnselectedText },
  pillTextActive: { color: '#FFF' },
  center: { paddingTop: 60, alignItems: 'center' },
  errorBox: { backgroundColor: Colors.alertCritical + '18', borderRadius: 12, padding: 16 },
  errorText: { color: Colors.alertCritical, fontSize: 14 },
  empty: { paddingTop: 40, alignItems: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
});
