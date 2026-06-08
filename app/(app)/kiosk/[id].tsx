import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InkBar } from '../../../components/InkBar';
import { PaperTotalBar } from '../../../components/PaperTotalBar';
import { TypeBadge } from '../../../components/TypeBadge';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../../constants/theme';
import { api } from '../../../lib/api';
import { KioskAlert, KioskDetail, PaperTotal } from '../../../lib/types';

const POLL_MS = 5000;

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

function statusLabel(d: KioskDetail): string {
  if (!d.online) return 'Offline';
  switch (d.status) {
    case 'printing': return 'Printing';
    case 'warmup': return 'Warming Up';
    case 'idle': return 'Idle';
    default: return 'Unknown';
  }
}

function statusColor(d: KioskDetail): string {
  if (!d.online) return Colors.offline;
  switch (d.status) {
    case 'printing': return Colors.accent;
    case 'warmup': return Colors.warning;
    case 'idle': return Colors.online;
    default: return Colors.textMuted;
  }
}

function severityColor(s: string): string {
  switch (s) {
    case 'critical': return Colors.error;
    case 'high': return '#E64980';
    case 'medium': return Colors.warning;
    default: return Colors.textMuted;
  }
}

function unwrapKiosk(raw: unknown): KioskDetail {
  if (!raw || typeof raw !== 'object') return raw as KioskDetail;
  const obj = raw as Record<string, unknown>;
  if (obj.kiosk && typeof obj.kiosk === 'object') return obj.kiosk as KioskDetail;
  if (obj.data && typeof obj.data === 'object') return obj.data as KioskDetail;
  return obj as unknown as KioskDetail;
}

/** Read paper_total directly from the kiosk response — same field both endpoints now return. */
function resolvePaper(k: KioskDetail): PaperTotal | null {
  const pt = (k as any).paper_total;
  if (!pt || typeof pt !== 'object') return null;
  const sheets_remaining = pt.sheets_remaining ?? pt.total_remaining ?? 0;
  const total_capacity = pt.total_capacity ?? 0;
  const pct = pt.pct ?? (total_capacity > 0 ? Math.round((sheets_remaining / total_capacity) * 100) : 0);
  const zone = pt.zone ?? derivedZone(pct);
  return { sheets_remaining, total_capacity, pct, zone };
}

function derivedZone(pct: number): string {
  if (pct >= 40) return 'Good';
  if (pct >= 15) return 'Low';
  if (pct > 0) return 'Critical';
  return 'Empty';
}

// ─── Stocktake Modal ──────────────────────────────────────────────────────────

const TRAY_PRESETS: Record<string, { label: string; value: number }[]> = {
  '2': [
    { label: 'Empty', value: 0 },
    { label: 'Half', value: 125 },
    { label: 'Full', value: 250 },
  ],
  '3': [
    { label: 'Empty', value: 0 },
    { label: 'Half', value: 275 },
    { label: 'Full', value: 550 },
  ],
};

interface StocktakeProps {
  visible: boolean;
  kioskId: string;
  trays: string[]; // ['2'] or ['2','3']
  onClose: () => void;
  onSaved: () => void;
}

function StocktakeModal({ visible, kioskId, trays, onClose, onSaved }: StocktakeProps) {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // Track the previous visible value so we only reset inputs when the modal
  // transitions from closed → open, not on every re-render while open.
  const wasVisible = useRef(false);

  useEffect(() => {
    if (visible && !wasVisible.current) {
      // Modal just opened — initialise inputs to empty
      const init: Record<string, string> = {};
      trays.forEach(t => { init[t] = ''; });
      setCounts(init);
    }
    wasVisible.current = visible;
  }, [visible]); // intentionally omitting trays — reference changes every render

  const total = trays.reduce((sum, t) => sum + (parseInt(counts[t] || '0', 10) || 0), 0);

  async function handleConfirm() {
    const tray_counts: Record<string, number> = {};
    for (const t of trays) {
      const n = parseInt(counts[t] || '0', 10);
      if (isNaN(n) || n < 0) {
        Alert.alert('Invalid value', `Enter a valid sheet count for Tray ${t}.`);
        return;
      }
      tray_counts[t] = n;
    }
    setSaving(true);
    try {
      await api.post('/api/refill', { kiosk_id: kioskId, tray_counts });
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to update paper count.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={mStyles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={mStyles.backdrop} onPress={onClose} />
        <View style={mStyles.sheet}>
          <View style={mStyles.handle} />
          <Text style={[Typography.h3, mStyles.title]}>Update Paper Count</Text>
          <Text style={[Typography.bodySecondary, mStyles.subtitle]}>
            How many sheets are in each tray right now?
          </Text>

          {trays.map(t => (
            <View key={t} style={mStyles.trayRow}>
              <Text style={[Typography.body, mStyles.trayLabel]}>Tray {t}</Text>
              <TextInput
                style={mStyles.input}
                value={counts[t] ?? ''}
                onChangeText={v => setCounts(prev => ({ ...prev, [t]: v.replace(/[^0-9]/g, '') }))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                maxLength={4}
              />
              <View style={mStyles.presets}>
                {(TRAY_PRESETS[t] ?? []).map(p => (
                  <TouchableOpacity
                    key={p.label}
                    style={[
                      mStyles.preset,
                      counts[t] === String(p.value) && mStyles.presetActive,
                    ]}
                    onPress={() => setCounts(prev => ({ ...prev, [t]: String(p.value) }))}
                  >
                    <Text
                      style={[
                        mStyles.presetText,
                        counts[t] === String(p.value) && mStyles.presetTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <View style={mStyles.totalRow}>
            <Text style={Typography.body}>New total</Text>
            <Text style={mStyles.totalValue}>{total} sheets</Text>
          </View>

          <View style={mStyles.actions}>
            <TouchableOpacity style={mStyles.cancelBtn} onPress={onClose}>
              <Text style={mStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[mStyles.confirmBtn, saving && { opacity: 0.6 }]}
              onPress={handleConfirm}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={mStyles.confirmText}>Confirm</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const mStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    paddingBottom: 36,
    gap: Spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginTop: -Spacing.sm },
  trayRow: { gap: Spacing.sm },
  trayLabel: { fontWeight: '600' as const },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  presets: { flexDirection: 'row', gap: Spacing.sm },
  preset: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  presetActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '18' },
  presetText: { ...Typography.label, color: Colors.textSecondary },
  presetTextActive: { color: Colors.accentDark },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalValue: { fontSize: 20, fontWeight: '800' as const, color: Colors.textPrimary },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelText: { ...Typography.body, fontWeight: '600' as const, color: Colors.textSecondary },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  confirmText: { ...Typography.body, fontWeight: '700' as const, color: Colors.white },
});

// ─── Health chip ──────────────────────────────────────────────────────────────

function HealthChip({ ok, label }: { ok: boolean; label: string }) {
  const color = ok ? Colors.online : Colors.error;
  const bg = ok ? Colors.online + '18' : Colors.error + '18';
  return (
    <View style={[hStyles.chip, { backgroundColor: bg }]}>
      <Ionicons name={ok ? 'checkmark-circle' : 'alert-circle'} size={14} color={color} />
      <Text style={[hStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

const hStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  label: { fontSize: 13, fontWeight: '600' as const },
});

// ─── Alert row ────────────────────────────────────────────────────────────────

function AlertRow({
  alert,
  onResolve,
}: {
  alert: KioskAlert;
  onResolve: (id: string) => void;
}) {
  const color = severityColor(alert.severity);
  const autoResolves = alert.type?.includes('tray');

  return (
    <View style={aStyles.row}>
      <View style={[aStyles.dot, { backgroundColor: color }]} />
      <View style={aStyles.body}>
        <Text style={aStyles.message} numberOfLines={2}>{alert.message}</Text>
        <Text style={aStyles.time}>{formatAgo(alert.created_at)}</Text>
      </View>
      {!autoResolves && (
        <TouchableOpacity style={aStyles.resolveBtn} onPress={() => onResolve(alert.id)}>
          <Text style={aStyles.resolveText}>Resolve</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const aStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  body: { flex: 1, gap: 2 },
  message: { ...Typography.body },
  time: { ...Typography.caption },
  resolveBtn: {
    backgroundColor: Colors.accent + '22',
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  resolveText: { fontSize: 13, fontWeight: '600' as const, color: Colors.accentDark },
});

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sStyles.card}>
      <Text style={sStyles.title}>{title}</Text>
      {children}
    </View>
  );
}

const sStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadow.card,
  },
  title: { fontSize: 13, fontWeight: '700' as const, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function KioskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [kiosk, setKiosk] = useState<KioskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stocktakeOpen, setStocktakeOpen] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);
  // Mirrors stocktakeOpen as a ref so the interval callback can read it
  // without capturing a stale closure value.
  const stocktakeOpenRef = useRef(false);

  function openStocktake() {
    stocktakeOpenRef.current = true;
    setStocktakeOpen(true);
  }
  function closeStocktake() {
    stocktakeOpenRef.current = false;
    setStocktakeOpen(false);
  }

  async function fetchKiosk(silent = false) {
    if (!isMounted.current) return;
    // Never update kiosk state while the stocktake modal is open — it would
    // reset the modal's input state via the trays prop change.
    if (silent && stocktakeOpenRef.current) return;
    try {
      const raw = await api.get(`/api/kiosks/${id}`) as any;
      if (!isMounted.current) return;
      const k = unwrapKiosk(raw) as any;
      // paper_total and active_alerts live at the TOP level of the response,
      // not inside raw.kiosk. Merge them so the rest of the screen can read them.
      if (raw.paper_total) k.paper_total = raw.paper_total;
      if (Array.isArray(raw.active_alerts)) k.alerts = raw.active_alerts;
      setKiosk(k);
      setError(null);
    } catch (e: any) {
      if (!isMounted.current) return;
      if (!silent) setError(e?.message ?? 'Failed to load kiosk');
    } finally {
      if (!isMounted.current) return;
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    isMounted.current = true;
    fetchKiosk(false).then(() => {
      if (isMounted.current) {
        intervalRef.current = setInterval(() => fetchKiosk(true), POLL_MS);
      }
    });
    return () => {
      isMounted.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [id]);

  async function onRefresh() {
    setRefreshing(true);
    await fetchKiosk(false);
    setRefreshing(false);
  }

  async function resolveAlert(alertId: string) {
    setResolvingId(alertId);
    try {
      await api.post(`/api/alerts/${alertId}/resolve`);
      await fetchKiosk(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not resolve alert.');
    } finally {
      setResolvingId(null);
    }
  }

  // Determine installed trays from tray_config or defaults
  function getInstalledTrays(): string[] {
    const cfg = kiosk?.tray_config;
    if (!cfg) {
      // fallback: standard = 2+3, estamp = 2 only
      return kiosk?.kiosk_type === 'estamp' ? ['2'] : ['2', '3'];
    }
    const trays: string[] = [];
    if (cfg.tray2?.installed !== false) trays.push('2');
    if (cfg.tray3?.installed) trays.push('3');
    return trays;
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <PageHeader title="Kiosk Detail" subtitle="" onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error && !kiosk) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <PageHeader title="Kiosk Detail" subtitle="" onBack={() => router.back()} />
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.textMuted} />
          <Text style={[Typography.h3, { marginTop: Spacing.md }]}>Couldn't load kiosk</Text>
          <Text style={[Typography.bodySecondary, { marginTop: Spacing.xs, textAlign: 'center' }]}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchKiosk(false); }}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!kiosk) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <PageHeader title="Kiosk Detail" subtitle="" onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={Typography.h3}>Kiosk not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const installedTrays = getInstalledTrays();
  const activeAlerts = (kiosk.alerts ?? []).filter(a => !a.resolved);
  const errState = kiosk.error_state ?? {} as any;
  const dot = statusColor(kiosk);
  const sLabel = statusLabel(kiosk);
  const paper = resolvePaper(kiosk);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Fixed header ── */}
      <PageHeader
        title={kiosk.kiosk_name}
        subtitle={kiosk.location}
        online={kiosk.online}
        lastSeen={kiosk.last_seen}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />
        }
      >
        {/* ── 1. Hero card ── */}
        <View style={[styles.heroCard]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroStatus}>{sLabel}</Text>
              <Text style={styles.heroUpdated}>Updated {formatAgo(kiosk.last_seen)}</Text>
            </View>
            <TypeBadge type={kiosk.kiosk_type} />
          </View>
          <View style={styles.heroGrid}>
            <HeroMeta label="Model" value={kiosk.model ?? '—'} />
            <HeroMeta label="Serial" value={kiosk.serial ?? '—'} />
            <HeroMeta label="IP" value={kiosk.printer_ip ?? '—'} />
            <HeroMeta label="Pages" value={kiosk.page_count != null ? kiosk.page_count.toLocaleString() : '—'} />
          </View>
          <View style={[styles.statusDotRow]}>
            <View style={[styles.statusDot, { backgroundColor: dot }]} />
            <Text style={[styles.statusWord, { color: dot }]}>{sLabel}</Text>
          </View>
        </View>

        {/* ── 2. Ink levels ── */}
        {kiosk.cartridges?.length > 0 && (
          <SectionCard title="Ink Levels">
            {kiosk.cartridges.map(c => <InkBar key={c.id} cartridge={c} />)}
          </SectionCard>
        )}

        {/* ── 3. Paper (always rendered) ── */}
        <SectionCard title="Paper">
          {paper ? (
            <PaperTotalBar paper={paper} />
          ) : (
            <Text style={[Typography.bodySecondary, { color: Colors.textMuted }]}>
              Paper data unavailable
            </Text>
          )}

          {/* Per-tray status chips */}
          <View style={styles.trayChips}>
            {installedTrays.includes('2') && (
              <TrayChip label="Tray 2" empty={!!errState.tray2_open} />
            )}
            {installedTrays.includes('3') && (
              <TrayChip label="Tray 3" empty={!!errState.tray3_open} />
            )}
          </View>

          <TouchableOpacity
            style={styles.stocktakeBtn}
            onPress={openStocktake}
          >
            <Ionicons name="create-outline" size={16} color={Colors.white} />
            <Text style={styles.stocktakeBtnText}>Update Paper Count</Text>
          </TouchableOpacity>
        </SectionCard>

        {/* ── 4. Printer health ── */}
        <SectionCard title="Printer Health">
          <View style={styles.healthChips}>
            <HealthChip ok={!errState.door_open} label={errState.door_open ? 'Door open' : 'Door closed'} />
            <HealthChip ok={!errState.paper_jam} label={errState.paper_jam ? 'Paper jam' : 'No jam'} />
            <HealthChip ok={!errState.cartridge_missing} label={errState.cartridge_missing ? 'Cartridge missing' : 'All cartridges present'} />
            {installedTrays.includes('2') && (
              <HealthChip ok={!errState.tray2_open} label={errState.tray2_open ? 'Tray 2 open' : 'Tray 2 in place'} />
            )}
            {installedTrays.includes('3') && (
              <HealthChip ok={!errState.tray3_open} label={errState.tray3_open ? 'Tray 3 open' : 'Tray 3 in place'} />
            )}
          </View>
        </SectionCard>

        {/* ── 5. Active alerts ── */}
        <SectionCard title="Active Alerts">
          {activeAlerts.length === 0 ? (
            <View style={styles.allClear}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.online} />
              <Text style={styles.allClearText}>No active alerts — all clear</Text>
            </View>
          ) : (
            activeAlerts.map(a => (
              <AlertRow
                key={a.id}
                alert={a}
                onResolve={resolveAlert}
              />
            ))
          )}
        </SectionCard>

        {/* ── 6. Recent Activity (minimal) ── */}
        <RecentActivity kiosk={kiosk} />
      </ScrollView>

      {/* Stocktake modal */}
      <StocktakeModal
        visible={stocktakeOpen}
        kioskId={kiosk.kiosk_id}
        trays={installedTrays}
        onClose={closeStocktake}
        onSaved={async () => {
          closeStocktake();
          await fetchKiosk(false);
        }}
      />
    </SafeAreaView>
  );
}

// ─── Page header ──────────────────────────────────────────────────────────────

function PageHeader({
  title,
  subtitle,
  online,
  lastSeen,
  onBack,
}: {
  title: string;
  subtitle: string;
  online?: boolean;
  lastSeen?: string;
  onBack: () => void;
}) {
  return (
    <View style={phStyles.header}>
      <TouchableOpacity onPress={onBack} style={phStyles.back} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
      </TouchableOpacity>
      <View style={phStyles.mid}>
        <Text style={phStyles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={phStyles.sub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {online !== undefined && (
        <View style={phStyles.statusWrap}>
          <View style={[phStyles.dot, { backgroundColor: online ? Colors.online : Colors.offline }]} />
          <Text style={phStyles.lastSeen}>{lastSeen ? formatAgo(lastSeen) : ''}</Text>
        </View>
      )}
    </View>
  );
}

const phStyles = StyleSheet.create({
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
  mid: { flex: 1 },
  title: { ...Typography.h3, fontSize: 16 },
  sub: { ...Typography.caption, marginTop: 1 },
  statusWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  lastSeen: { ...Typography.caption },
});

// ─── Hero meta item ───────────────────────────────────────────────────────────

function HeroMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={hmStyles.item}>
      <Text style={hmStyles.label}>{label}</Text>
      <Text style={hmStyles.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const hmStyles = StyleSheet.create({
  item: { flex: 1, minWidth: '45%' },
  label: { fontSize: 11, color: Colors.heroText, opacity: 0.6, fontWeight: '500' as const, marginBottom: 2 },
  value: { fontSize: 13, color: Colors.heroText, fontWeight: '600' as const },
});

// ─── Tray chip ────────────────────────────────────────────────────────────────

function TrayChip({ label, empty }: { label: string; empty: boolean }) {
  const color = empty ? Colors.error : Colors.online;
  const bg = empty ? Colors.error + '18' : Colors.online + '18';
  return (
    <View style={[tcStyles.chip, { backgroundColor: bg }]}>
      <Text style={[tcStyles.text, { color }]}>{label}: {empty ? 'Empty' : 'OK'}</Text>
    </View>
  );
}

const tcStyles = StyleSheet.create({
  chip: {
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: { fontSize: 13, fontWeight: '600' as const },
});

// ─── Recent Activity ──────────────────────────────────────────────────────────

function RecentActivity({ kiosk }: { kiosk: KioskDetail }) {
  // Derive a minimal feed from resolved + active alerts sorted newest-first
  const allAlerts = kiosk.alerts ?? [];
  if (allAlerts.length === 0) return null;

  const recent = [...allAlerts]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  return (
    <SectionCard title="Recent Activity">
      {recent.map((a, i) => (
        <View key={a.id} style={[raStyles.row, i > 0 && raStyles.border]}>
          <View style={[raStyles.dot, { backgroundColor: severityColor(a.severity) }]} />
          <View style={raStyles.body}>
            <Text style={raStyles.msg} numberOfLines={2}>{a.message}</Text>
            <Text style={raStyles.time}>{formatAgo(a.created_at)}</Text>
          </View>
          {a.resolved && (
            <View style={raStyles.resolvedPill}>
              <Text style={raStyles.resolvedText}>Resolved</Text>
            </View>
          )}
        </View>
      ))}
    </SectionCard>
  );
}

const raStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingTop: Spacing.sm },
  border: { borderTopWidth: 1, borderTopColor: Colors.border },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  body: { flex: 1, gap: 2 },
  msg: { ...Typography.body },
  time: { ...Typography.caption },
  resolvedPill: { backgroundColor: Colors.online + '18', borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  resolvedText: { fontSize: 11, fontWeight: '600' as const, color: Colors.online },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  retryBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  retryText: { color: Colors.white, fontWeight: '700' as const, fontSize: 15 },

  // Hero card
  heroCard: {
    backgroundColor: Colors.hero,
    borderRadius: Radius.card,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadow.card,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroStatus: { fontSize: 28, fontWeight: '800' as const, color: Colors.heroText },
  heroUpdated: { fontSize: 12, color: Colors.heroText, opacity: 0.65, marginTop: 2 },
  heroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  statusDotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusWord: { fontSize: 13, fontWeight: '600' as const },

  // Paper section
  trayChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  stocktakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingVertical: 12,
  },
  stocktakeBtnText: { color: Colors.white, fontWeight: '700' as const, fontSize: 15 },

  // Health chips
  healthChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },

  // All clear
  allClear: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  allClearText: { ...Typography.body, color: Colors.online },
});
