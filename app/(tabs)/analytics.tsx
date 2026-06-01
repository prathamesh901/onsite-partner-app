import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../constants/theme';
import { usePolling } from '../../hooks/usePolling';
import { api } from '../../lib/api';
import { Analytics, Kiosk } from '../../lib/types';

type Range = '7d' | '30d' | 'all';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - Spacing.marginMobile * 2 - Spacing.md * 2;

export default function AnalyticsScreen() {
  const [range, setRange] = useState<Range>('7d');

  const kioskFetcher = useCallback(() => api.getKiosks(), []);
  const { data: kiosksRaw, loading: kioskLoading } = usePolling<Kiosk[]>(kioskFetcher);
  const kiosks = Array.isArray(kiosksRaw) ? kiosksRaw : [];

  const totalPages = kiosks.reduce((s, k) => s + (k.page_count ?? 0), 0);
  const mostActive = kiosks.slice().sort((a, b) => (b.page_count ?? 0) - (a.page_count ?? 0))[0];
  const totalAlerts = kiosks.reduce(
    (s, k) => s + (k.active_alerts?.filter((a) => a.status === 'active').length ?? 0),
    0,
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[Typography.headlineMd, { color: Colors.onSurface, marginBottom: Spacing.md }]}>
          Analytics
        </Text>

        {/* Range toggle */}
        <View style={styles.rangeRow}>
          {(['7d', '30d', 'all'] as Range[]).map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.rangePill, range === r && styles.rangePillActive]}
              onPress={() => setRange(r)}
            >
              <Text style={[Typography.labelMd, { color: range === r ? Colors.onPrimary : Colors.onSurfaceVariant }]}>
                {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : 'All Time'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary stat cards */}
        <View style={styles.statsGrid}>
          <StatCard
            icon="document-text-outline"
            iconBg={Colors.primaryFixed + '33'}
            iconColor={Colors.primary}
            label="Total Pages"
            value={totalPages.toLocaleString()}
          />
          <StatCard
            icon="warning-outline"
            iconBg={Colors.errorContainer}
            iconColor={Colors.error}
            label="Active Alerts"
            value={String(totalAlerts)}
          />
          <StatCard
            icon="trophy-outline"
            iconBg={Colors.tertiaryFixed + '66'}
            iconColor={Colors.tertiary}
            label="Most Active"
            value={mostActive?.kiosk_name ?? '—'}
            small
          />
        </View>

        {kioskLoading && kiosks.length === 0 && (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        )}

        {/* Per-kiosk charts */}
        {kiosks.map((k) => (
          <KioskChartCard key={k.kiosk_id} kiosk={k} range={range} chartWidth={CHART_WIDTH} />
        ))}

        {/* Ranking list */}
        {kiosks.length > 1 && (
          <View style={styles.card}>
            <Text style={[Typography.headlineSm, { color: Colors.onSurface, marginBottom: Spacing.sm }]}>
              Kiosk Rankings
            </Text>
            {kiosks
              .slice()
              .sort((a, b) => (b.page_count ?? 0) - (a.page_count ?? 0))
              .map((k, i) => (
                <View key={k.kiosk_id} style={styles.rankRow}>
                  <View style={styles.rankBadge}>
                    <Text style={[Typography.labelMd, { color: Colors.primary, fontWeight: '700' }]}>
                      #{i + 1}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[Typography.labelMd, { color: Colors.onSurface }]}>{k.kiosk_name}</Text>
                    <Text style={[Typography.labelSm, { color: Colors.onSurfaceVariant }]}>{k.location}</Text>
                  </View>
                  <Text style={[Typography.labelMd, { color: Colors.onSurface }]}>
                    {(k.page_count ?? 0).toLocaleString()} pg
                  </Text>
                </View>
              ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, iconBg, iconColor, label, value, small }: {
  icon: string; iconBg: string; iconColor: string; label: string; value: string; small?: boolean;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={22} color={iconColor} />
      </View>
      <Text style={[small ? Typography.labelMd : Typography.headlineSm, { color: Colors.onSurface, marginTop: 8 }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[Typography.labelSm, { color: Colors.onSurfaceVariant, marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

function KioskChartCard({ kiosk, range, chartWidth }: { kiosk: Kiosk; range: Range; chartWidth: number }) {
  const fetcher = useCallback(
    () => api.getAnalytics(kiosk.kiosk_id, range),
    [kiosk.kiosk_id, range],
  );
  const { data, loading } = usePolling<Analytics>(fetcher, 10000);

  const points = data?.data ?? [];
  const maxVal = Math.max(...points.map((p) => p.page_count), 1);
  const chartH = 120;

  return (
    <View style={styles.card}>
      <Text style={[Typography.headlineSm, { color: Colors.onSurface }]}>{kiosk.kiosk_name}</Text>
      <Text style={[Typography.labelSm, { color: Colors.onSurfaceVariant, marginBottom: Spacing.sm }]}>
        {kiosk.location}
      </Text>

      {loading && !data ? (
        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 30 }} />
      ) : points.length < 2 ? (
        <View style={styles.noData}>
          <Text style={[Typography.bodySm, { color: Colors.onSurfaceVariant }]}>No data for this period</Text>
        </View>
      ) : (
        <>
          {/* Bar chart */}
          <View style={[styles.chartContainer, { height: chartH }]}>
            {/* Grid lines */}
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <View
                key={f}
                style={[
                  styles.gridLine,
                  { bottom: f * chartH },
                ]}
              />
            ))}
            {/* Bars */}
            <View style={styles.barsRow}>
              {points.map((p, i) => {
                const h = Math.max(4, (p.page_count / maxVal) * chartH);
                return (
                  <View key={i} style={styles.barWrap}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: h,
                          backgroundColor: i === points.length - 1
                            ? Colors.primaryContainer
                            : Colors.primaryFixed + '55',
                        },
                      ]}
                    />
                  </View>
                );
              })}
            </View>
          </View>
          {/* X-axis labels */}
          <View style={styles.xLabels}>
            <Text style={[Typography.labelSm, { color: Colors.onSurfaceVariant }]}>
              {points[0]?.date?.slice(5)}
            </Text>
            <Text style={[Typography.labelSm, { color: Colors.onSurfaceVariant }]}>
              {points[Math.floor(points.length / 2)]?.date?.slice(5)}
            </Text>
            <Text style={[Typography.labelSm, { color: Colors.onSurfaceVariant }]}>
              {points[points.length - 1]?.date?.slice(5)}
            </Text>
          </View>
        </>
      )}

      <Text style={[Typography.labelMd, { color: Colors.onSurfaceVariant, marginTop: Spacing.sm }]}>
        Total: <Text style={{ color: Colors.onSurface }}>{(kiosk.page_count ?? 0).toLocaleString()} pages</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.marginMobile, paddingBottom: 32 },
  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  rangePill: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceContainer,
  },
  rangePillActive: { backgroundColor: Colors.primaryContainer },
  statsGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.card,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '33',
    ...Shadow.card,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.card,
  },
  chartContainer: { position: 'relative', marginBottom: 4 },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.outlineVariant + '33',
  },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', flex: 1, height: '100%' },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 1 },
  bar: { width: '85%', borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, minHeight: 4 },
  xLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  noData: { height: 80, alignItems: 'center', justifyContent: 'center' },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant + '44',
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
