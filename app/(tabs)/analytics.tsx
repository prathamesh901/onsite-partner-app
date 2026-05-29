import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radius, Shadow } from '../../constants/theme';
import { usePolling } from '../../hooks/usePolling';
import { api } from '../../lib/api';
import { Analytics, Kiosk } from '../../lib/types';

type Range = '7d' | '30d' | 'all';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen() {
  const [range, setRange] = useState<Range>('7d');

  const kioskFetcher = useCallback(() => api.getKiosks(), []);
  const { data: kiosks, loading: kioskLoading } = usePolling<Kiosk[]>(kioskFetcher);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Analytics</Text>
        <View style={styles.rangeRow}>
          {(['7d', '30d', 'all'] as Range[]).map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.rangePill, range === r && styles.rangePillActive]}
              onPress={() => setRange(r)}
            >
              <Text style={[styles.rangeText, range === r && styles.rangeTextActive]}>
                {r === 'all' ? 'All Time' : r === '7d' ? '7 Days' : '30 Days'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {kioskLoading && !kiosks && <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />}
        {kiosks?.map((k) => (
          <KioskAnalyticsCard key={k.kiosk_id} kiosk={k} range={range} />
        ))}
        {kiosks && kiosks.length > 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Kiosk Comparison</Text>
            {kiosks
              .slice()
              .sort((a, b) => b.page_count - a.page_count)
              .map((k, i) => (
                <View key={k.kiosk_id} style={styles.compRow}>
                  <Text style={styles.compRank}>#{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.compName}>{k.kiosk_name}</Text>
                    <Text style={styles.compLoc}>{k.location}</Text>
                  </View>
                  <Text style={styles.compCount}>{k.page_count.toLocaleString()} pages</Text>
                </View>
              ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function KioskAnalyticsCard({ kiosk, range }: { kiosk: Kiosk; range: Range }) {
  const fetcher = useCallback(() => api.getAnalytics(kiosk.kiosk_id, range), [kiosk.kiosk_id, range]);
  const { data, loading } = usePolling<Analytics>(fetcher);

  const points = data?.data ?? [];
  const maxVal = Math.max(...points.map((p) => p.page_count), 1);
  const chartWidth = width - 80;
  const chartHeight = 80;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{kiosk.kiosk_name}</Text>
      <Text style={styles.cardSub}>{kiosk.location}</Text>
      {loading && !data ? (
        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
      ) : points.length === 0 ? (
        <Text style={styles.noData}>No data for this period</Text>
      ) : (
        <View style={styles.chartArea}>
          <SimpleLineChart points={points.map((p) => p.page_count)} maxVal={maxVal} width={chartWidth} height={chartHeight} />
          <View style={styles.chartLabels}>
            <Text style={styles.chartLabel}>{points[0]?.date?.slice(5)}</Text>
            <Text style={styles.chartLabel}>{points[points.length - 1]?.date?.slice(5)}</Text>
          </View>
        </View>
      )}
      <Text style={styles.total}>Total: {kiosk.page_count.toLocaleString()} pages</Text>
    </View>
  );
}

function SimpleLineChart({ points, maxVal, width: w, height: h }: {
  points: number[];
  maxVal: number;
  width: number;
  height: number;
}) {
  if (points.length < 2) return null;
  const step = w / (points.length - 1);

  return (
    <View style={{ width: w, height: h + 4, overflow: 'hidden' }}>
      {points.map((v, i) => {
        if (i === points.length - 1) return null;
        const x1 = i * step;
        const y1 = h - (v / maxVal) * h;
        const x2 = (i + 1) * step;
        const y2 = h - (points[i + 1] / maxVal) * h;
        const len = Math.hypot(x2 - x1, y2 - y1);
        const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: x1,
              top: y1,
              width: len,
              height: 2.5,
              backgroundColor: Colors.primary,
              borderRadius: 1,
              transformOrigin: '0 50%',
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}
      {points.map((v, i) => (
        <View
          key={`dot-${i}`}
          style={{
            position: 'absolute',
            left: i * step - 3,
            top: h - (v / maxVal) * h - 3,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: Colors.primary,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, marginBottom: 14 },
  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  rangePill: { borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.pillUnselectedBg },
  rangePillActive: { backgroundColor: Colors.primary },
  rangeText: { fontSize: 13, fontWeight: '600', color: Colors.pillUnselectedText },
  rangeTextActive: { color: '#FFF' },
  card: { backgroundColor: Colors.card, borderRadius: Radius.card, padding: 16, marginBottom: 16, ...Shadow.card },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  cardSub: { fontSize: 12, color: Colors.textSecondary, marginBottom: 12 },
  noData: { color: Colors.textMuted, fontSize: 13, paddingVertical: 16, textAlign: 'center' },
  chartArea: { marginBottom: 8 },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  chartLabel: { fontSize: 11, color: Colors.textMuted },
  total: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  compRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  compRank: { fontSize: 14, fontWeight: '700', color: Colors.primary, width: 24 },
  compName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  compLoc: { fontSize: 12, color: Colors.textSecondary },
  compCount: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
});
