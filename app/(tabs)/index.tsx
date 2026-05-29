import React, { useCallback } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KioskCard } from '../../components/KioskCard';
import { Colors, Radius } from '../../constants/theme';
import { usePolling } from '../../hooks/usePolling';
import { api } from '../../lib/api';
import { Kiosk } from '../../lib/types';

export default function KiosksScreen() {
  const fetcher = useCallback(() => api.getKiosks(), []);
  const { data: kiosks, loading, error, refresh } = usePolling<Kiosk[]>(fetcher);

  const online = kiosks?.filter((k) => k.online).length ?? 0;
  const offline = kiosks?.filter((k) => !k.online).length ?? 0;
  const alerts = kiosks?.reduce((sum, k) => sum + (k.active_alerts?.filter((a) => a.status === 'active').length ?? 0), 0) ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading && !!kiosks} onRefresh={refresh} tintColor={Colors.primary} />}
      >
        <Text style={styles.title}>My Kiosks</Text>
        <View style={styles.pillRow}>
          <SummaryPill label={`${online} Online`} color={Colors.online} />
          <SummaryPill label={`${alerts} Alerts`} color={alerts > 0 ? Colors.alertCritical : Colors.alertWarning} />
          <SummaryPill label={`${offline} Offline`} color={Colors.offline} />
        </View>
        {loading && !kiosks && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
        {!!error && !kiosks && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}
        {kiosks?.map((k) => <KioskCard key={k.kiosk_id} kiosk={k} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color + '18' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, marginBottom: 14 },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 13, fontWeight: '600' },
  center: { paddingTop: 60, alignItems: 'center' },
  errorBox: { backgroundColor: Colors.alertCritical + '18', borderRadius: 12, padding: 16, marginBottom: 20 },
  errorText: { color: Colors.alertCritical, fontSize: 14 },
});
