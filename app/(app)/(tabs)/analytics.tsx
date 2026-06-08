import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  LayoutChangeEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line as SvgLine,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { countKioskAlerts } from '../../../components';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../../constants/theme';
import { api } from '../../../lib/api';
import { Kiosk } from '../../../lib/types';

type Range = '7d' | '30d' | 'all';

const RANGES: { key: Range; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All' },
];

interface ChartPoint {
  date: string;
  value: number;
}

const SCREEN_W = Dimensions.get('window').width;
// screen padding (lg each side) + card padding (md each side)
const DEFAULT_CHART_W = SCREEN_W - Spacing.lg * 2 - Spacing.md * 2;
const CHART_H = 170;

// ─── helpers ─────────────────────────────────────────────────────────────────

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

/** Normalise the analytics response into a clean {date,value} series. */
function normalizeSeries(raw: unknown): ChartPoint[] {
  let arr: any[] = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const key of ['series', 'data', 'points', 'page_counts', 'history', 'trend', 'results']) {
      if (Array.isArray(obj[key])) { arr = obj[key] as any[]; break; }
    }
  }
  return arr
    .map((p) => {
      if (typeof p === 'number') return { date: '', value: p };
      const date =
        p.date ?? p.day ?? p.timestamp ?? p.recorded_at ?? p.created_at ?? p.t ?? '';
      const value =
        p.page_count ?? p.pages ?? p.count ?? p.value ?? p.total ?? p.y ?? 0;
      return { date: String(date), value: Number(value) };
    })
    .filter((p) => Number.isFinite(p.value));
}

function formatDateLabel(s: string): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

// ─── Trend chart (custom SVG) ────────────────────────────────────────────────

function TrendChart({ points, width }: { points: ChartPoint[]; width: number }) {
  const w = width;
  const h = CHART_H;
  const padL = 6;
  const padR = 6;
  const padT = 14;
  const padB = 8;
  const innerW = Math.max(w - padL - padR, 1);
  const innerH = Math.max(h - padT - padB, 1);

  const n = points.length;
  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min || 1;
  const vpad = span * 0.08;
  const lo = min - vpad;
  const hi = max + vpad;
  const vspan = hi - lo || 1;

  const xAt = (i: number) => (n <= 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW);
  const yAt = (v: number) => padT + innerH - ((v - lo) / vspan) * innerH;

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.value).toFixed(1)}`)
    .join(' ');
  const areaPath =
    `${linePath} L ${xAt(n - 1).toFixed(1)} ${(padT + innerH).toFixed(1)}` +
    ` L ${xAt(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  const yMax = yAt(max);
  const yMin = yAt(min);
  const lastIdx = n - 1;

  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={Colors.accent} stopOpacity={0.28} />
          <Stop offset="1" stopColor={Colors.accent} stopOpacity={0.02} />
        </LinearGradient>
      </Defs>

      {/* reference lines at data min / max */}
      <SvgLine x1={padL} y1={yMax} x2={w - padR} y2={yMax} stroke={Colors.border} strokeWidth={1} strokeDasharray="3 4" />
      <SvgLine x1={padL} y1={yMin} x2={w - padR} y2={yMin} stroke={Colors.border} strokeWidth={1} strokeDasharray="3 4" />

      {/* area + line */}
      <Path d={areaPath} fill="url(#areaFill)" />
      <Path d={linePath} fill="none" stroke={Colors.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

      {/* last-point marker */}
      {n >= 1 && (
        <Circle cx={xAt(lastIdx)} cy={yAt(values[lastIdx])} r={4} fill={Colors.accent} stroke={Colors.white} strokeWidth={2} />
      )}

      {/* value labels */}
      <SvgText x={padL} y={yMax - 4} fontSize={10} fill={Colors.textMuted}>{fmt(max)}</SvgText>
      <SvgText x={padL} y={yMin + 12} fontSize={10} fill={Colors.textMuted}>{fmt(min)}</SvgText>
    </Svg>
  );
}

// ─── KPI card ────────────────────────────────────────────────────────────────

function KpiCard({
  icon, value, label, color,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: number;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('7d');
  const [series, setSeries] = useState<ChartPoint[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [chartW, setChartW] = useState(DEFAULT_CHART_W);

  const isMounted = useRef(true);
  const selectedRef = useRef<string | null>(null);
  const rangeRef = useRef<Range>(range);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const fetchKiosks = useCallback(async () => {
    try {
      const raw = await api.get('/api/kiosks');
      if (!isMounted.current) return;
      const list = unwrapKiosks(raw);
      setKiosks(list);
      setError(null);
      // Default selection: first kiosk, or keep current if still present.
      const stillValid = selectedRef.current && list.some(k => k.kiosk_id === selectedRef.current);
      if (!stillValid && list.length > 0) {
        selectedRef.current = list[0].kiosk_id;
        setSelectedId(list[0].kiosk_id);
      }
    } catch (e: any) {
      if (!isMounted.current) return;
      setError(e?.message ?? 'Failed to load kiosks');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async (id: string, r: Range) => {
    if (!id) return;
    setChartLoading(true);
    setChartError(null);
    try {
      const raw = await api.get(`/api/analytics/${id}?range=${r}`);
      if (!isMounted.current) return;
      // Ignore stale responses if the user switched kiosk/range mid-flight.
      if (selectedRef.current !== id || rangeRef.current !== r) return;
      setSeries(normalizeSeries(raw));
    } catch (e: any) {
      if (!isMounted.current) return;
      if (selectedRef.current === id && rangeRef.current === r) {
        setChartError(e?.message ?? 'Failed to load analytics');
        setSeries([]);
      }
    } finally {
      if (isMounted.current && selectedRef.current === id && rangeRef.current === r) {
        setChartLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchKiosks();
    }, [fetchKiosks]),
  );

  // Refetch the chart whenever the selected kiosk or range changes.
  useEffect(() => {
    if (selectedId) fetchAnalytics(selectedId, range);
  }, [selectedId, range, fetchAnalytics]);

  function selectKiosk(id: string) {
    if (id === selectedId) return;
    selectedRef.current = id;
    setSelectedId(id);
    // Clear so the chart shows a spinner for the new kiosk rather than the
    // previous kiosk's data under the new title.
    setSeries([]);
  }

  function selectRange(r: Range) {
    if (r === range) return;
    rangeRef.current = r;
    setRange(r);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchKiosks();
    if (selectedRef.current) await fetchAnalytics(selectedRef.current, rangeRef.current);
    if (isMounted.current) setRefreshing(false);
  }

  function onChartLayout(e: LayoutChangeEvent) {
    const wd = e.nativeEvent.layout.width;
    if (wd > 0 && Math.abs(wd - chartW) > 1) setChartW(wd);
  }

  // Fleet KPIs
  const totalKiosks = kiosks.length;
  const onlineCount = kiosks.filter(k => k.online).length;
  const activeAlerts = kiosks.reduce((sum, k) => sum + countKioskAlerts(k), 0);

  const selectedKiosk = kiosks.find(k => k.kiosk_id === selectedId) ?? null;
  const firstVal = series.length > 0 ? series[0].value : 0;
  const lastVal = series.length > 0 ? series[series.length - 1].value : 0;
  const delta = lastVal - firstVal;

  // ── initial loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerStandalone}>
          <Text style={Typography.h1}>Analytics</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={[Typography.bodySecondary, { marginTop: Spacing.sm }]}>Loading analytics…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── kiosks error ─────────────────────────────────────────────────────────
  if (error && kiosks.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerStandalone}>
          <Text style={Typography.h1}>Analytics</Text>
        </View>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.textMuted} />
          <Text style={[Typography.h3, { marginTop: Spacing.md, textAlign: 'center' }]}>
            Couldn't load analytics
          </Text>
          <Text style={[Typography.bodySecondary, { textAlign: 'center', marginTop: Spacing.xs }]}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchKiosks(); }}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />
        }
      >
        <Text style={[Typography.h1, { marginBottom: Spacing.md }]}>Analytics</Text>

        {/* Fleet KPIs */}
        <View style={styles.kpiRow}>
          <KpiCard icon="print" value={totalKiosks} label="Kiosks" color={Colors.accent} />
          <KpiCard icon="wifi" value={onlineCount} label="Online" color={Colors.online} />
          <KpiCard
            icon="alert-circle"
            value={activeAlerts}
            label="Active alerts"
            color={activeAlerts > 0 ? Colors.error : Colors.warning}
          />
        </View>

        {kiosks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="print-outline" size={40} color={Colors.textMuted} />
            <Text style={[Typography.h3, { marginTop: Spacing.sm }]}>No kiosks assigned</Text>
            <Text style={[Typography.bodySecondary, { textAlign: 'center', marginTop: 2 }]}>
              Usage trends will appear once kiosks are assigned to you.
            </Text>
          </View>
        ) : (
          <>
            {/* Kiosk selector chips */}
            <Text style={styles.sectionLabel}>Kiosk</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {kiosks.map((k) => {
                const active = k.kiosk_id === selectedId;
                return (
                  <TouchableOpacity
                    key={k.kiosk_id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => selectKiosk(k.kiosk_id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                      {k.kiosk_name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Range toggle */}
            <View style={styles.segment}>
              {RANGES.map(({ key, label }) => {
                const active = key === range;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                    onPress={() => selectRange(key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Chart card */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chartTitle} numberOfLines={1}>
                    {selectedKiosk?.kiosk_name ?? 'Kiosk'}
                  </Text>
                  <Text style={styles.chartSub}>Page count · {RANGES.find(r => r.key === range)?.label}</Text>
                </View>
                {series.length > 0 && (
                  <View style={styles.chartStat}>
                    <Text style={styles.chartStatValue}>{fmt(lastVal)}</Text>
                    <Text style={[styles.chartStatDelta, { color: delta > 0 ? Colors.online : Colors.textMuted }]}>
                      {delta > 0 ? `+${fmt(delta)}` : fmt(delta)} in range
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.chartArea} onLayout={onChartLayout}>
                {chartLoading && series.length === 0 ? (
                  <View style={styles.chartCenter}>
                    <ActivityIndicator color={Colors.accent} />
                  </View>
                ) : chartError ? (
                  <View style={styles.chartCenter}>
                    <Ionicons name="cloud-offline-outline" size={28} color={Colors.textMuted} />
                    <Text style={[Typography.bodySecondary, { textAlign: 'center', marginTop: 6 }]}>{chartError}</Text>
                    <TouchableOpacity
                      style={styles.smallRetry}
                      onPress={() => selectedId && fetchAnalytics(selectedId, range)}
                    >
                      <Text style={styles.smallRetryText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : series.length === 0 ? (
                  <View style={styles.chartCenter}>
                    <Ionicons name="bar-chart-outline" size={28} color={Colors.textMuted} />
                    <Text style={[Typography.bodySecondary, { textAlign: 'center', marginTop: 6 }]}>
                      No usage data yet for this range.
                    </Text>
                  </View>
                ) : (
                  <TrendChart points={series} width={chartW} />
                )}
              </View>

              {/* x-axis date range */}
              {series.length > 0 && (
                <View style={styles.axisRow}>
                  <Text style={styles.axisLabel}>{formatDateLabel(series[0].date)}</Text>
                  <Text style={styles.axisLabel}>{formatDateLabel(series[series.length - 1].date)}</Text>
                </View>
              )}
            </View>

            <Text style={styles.footnote}>
              Read-only. Page count is the printer's lifetime total; "in range" is the increase over the selected period.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  headerStandalone: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },

  kpiRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  kpiCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    padding: Spacing.md,
    gap: 4,
    ...Shadow.card,
  },
  kpiIcon: {
    width: 34, height: 34, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  kpiValue: { fontSize: 24, fontWeight: '800' as const, color: Colors.textPrimary },
  kpiLabel: { ...Typography.caption },

  sectionLabel: {
    fontSize: 13, fontWeight: '700' as const, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm,
  },
  chipsRow: { gap: Spacing.sm, paddingRight: Spacing.sm, marginBottom: Spacing.md },
  chip: {
    backgroundColor: Colors.card,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    maxWidth: 200,
  },
  chipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: { fontSize: 14, fontWeight: '600' as const, color: Colors.textSecondary },
  chipTextActive: { color: Colors.white },

  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.pillBg,
    borderRadius: Radius.pill,
    padding: 4,
    gap: 4,
    marginBottom: Spacing.md,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: Radius.pill, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: Colors.card, ...Shadow.card },
  segmentText: { fontSize: 14, fontWeight: '600' as const, color: Colors.textSecondary },
  segmentTextActive: { color: Colors.accentDark },

  chartCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    padding: Spacing.md,
    ...Shadow.card,
  },
  chartHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  chartTitle: { ...Typography.h3, fontSize: 16 },
  chartSub: { ...Typography.caption, marginTop: 1 },
  chartStat: { alignItems: 'flex-end' },
  chartStatValue: { fontSize: 20, fontWeight: '800' as const, color: Colors.textPrimary },
  chartStatDelta: { fontSize: 12, fontWeight: '600' as const, marginTop: 1 },

  chartArea: { height: CHART_H, justifyContent: 'center' },
  chartCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md },

  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  axisLabel: { ...Typography.caption },

  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadow.card,
  },

  footnote: { ...Typography.caption, marginTop: Spacing.md, lineHeight: 17 },

  smallRetry: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.accent + '22',
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  smallRetryText: { fontSize: 13, fontWeight: '700' as const, color: Colors.accentDark },

  retryBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  retryText: { color: Colors.white, fontWeight: '700' as const, fontSize: 15 },
});
