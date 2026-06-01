import { Ionicons } from '@expo/vector-icons';
import React, { useCallback } from 'react';
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
import { KioskCard } from '../../components/KioskCard';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../constants/theme';
import { usePolling } from '../../hooks/usePolling';
import { api } from '../../lib/api';
import { Kiosk } from '../../lib/types';

export default function KiosksScreen() {
  const fetcher = useCallback(() => api.getKiosks(), []);
  const { data: kiosks, loading, error, refresh } = usePolling<Kiosk[]>(fetcher);

  const safeKiosks = Array.isArray(kiosks) ? kiosks : [];
  const online = safeKiosks.filter((k) => k.online).length;
  const offline = safeKiosks.filter((k) => !k.online).length;
  const alerts = safeKiosks.reduce(
    (sum, k) => sum + (k.active_alerts?.filter((a) => a.status === 'active').length ?? 0),
    0,
  );
  const totalPages = safeKiosks.reduce((s, k) => s + (k.page_count ?? 0), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Sticky header */}
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <Ionicons name="print" size={26} color={Colors.primary} />
          <Text style={[Typography.headlineLg, { color: Colors.primary }]}>PrintBuddy</Text>
        </View>
        <View style={styles.appBarRight}>
          <TouchableOpacity onPress={refresh}>
            <Ionicons name="search-outline" size={24} color={Colors.onSurfaceVariant} />
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="ellipsis-vertical" size={24} color={Colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading && safeKiosks.length > 0}
            onRefresh={refresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Summary header */}
        <View style={styles.summarySection}>
          <Text style={[Typography.headlineMd, { color: Colors.onSurface }]}>My Kiosks</Text>
          <View style={styles.pillRow}>
            <SummaryPill dot="#27AE60" label={`${online} Online`} />
            <SummaryPill dot={alerts > 0 ? Colors.error : Colors.alert} label={`${alerts} Alerts`} />
            <SummaryPill dot={Colors.offline} label={`${offline} Offline`} />
          </View>
        </View>

        {loading && safeKiosks.length === 0 && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}

        {!!error && safeKiosks.length === 0 && (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={20} color={Colors.error} />
            <Text style={[Typography.bodySm, { color: Colors.error, flex: 1 }]}>{error}</Text>
          </View>
        )}

        {/* Kiosk cards */}
        {safeKiosks.map((k) => <KioskCard key={k.kiosk_id} kiosk={k} />)}

        {/* Performance overview card */}
        {safeKiosks.length > 0 && (
          <View style={styles.perfCard}>
            <View style={styles.perfDecor1} />
            <View style={styles.perfDecor2} />
            <Text style={[Typography.headlineSm, { color: '#fff', zIndex: 1 }]}>
              Performance Overview
            </Text>
            <Text style={[Typography.bodySm, { color: 'rgba(255,255,255,0.85)', zIndex: 1, marginTop: 4 }]}>
              Your fleet printed {totalPages.toLocaleString()} pages today.
            </Text>
            <View style={styles.perfStats}>
              <View>
                <Text style={[Typography.displayLg, { color: '#fff' }]}>
                  {online > 0 ? Math.round((online / (online + offline)) * 100) : 0}%
                </Text>
                <Text style={[Typography.labelSm, { color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1 }]}>
                  Uptime
                </Text>
              </View>
              <View style={styles.perfDivider} />
              <View>
                <Text style={[Typography.displayLg, { color: '#fff' }]}>{alerts}</Text>
                <Text style={[Typography.labelSm, { color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1 }]}>
                  Active Alerts
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryPill({ dot, label }: { dot: string; label: string }) {
  return (
    <View style={styles.pill}>
      <View style={[styles.pillDot, { backgroundColor: dot }]} />
      <Text style={[Typography.labelMd, { color: Colors.onSurface }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.marginMobile,
    height: 64,
    backgroundColor: Colors.background,
  },
  appBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  appBarRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  content: { padding: Spacing.marginMobile, paddingBottom: 24 },
  summarySection: { gap: Spacing.xs, marginBottom: Spacing.md },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  pillDot: { width: 8, height: 8, borderRadius: Radius.pill },
  center: { paddingTop: 60, alignItems: 'center' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.errorContainer,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  perfCard: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.card,
    padding: Spacing.md,
    minHeight: 180,
    overflow: 'hidden',
    gap: Spacing.base,
    ...Shadow.card,
  },
  perfDecor1: {
    position: 'absolute',
    bottom: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  perfDecor2: {
    position: 'absolute',
    top: -12,
    right: 0,
    width: 96,
    height: 96,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  perfStats: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-end', marginTop: Spacing.sm },
  perfDivider: { width: 1, height: 48, backgroundColor: 'rgba(255,255,255,0.2)' },
});
