import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { InkBar } from '../../components/InkBar';
import { RefillSheet } from '../../components/RefillSheet';
import { TimeAgo } from '../../components/TimeAgo';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../constants/theme';
import { usePolling } from '../../hooks/usePolling';
import { api } from '../../lib/api';
import { Kiosk, PaperLevel } from '../../lib/types';

function inkColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('black') || n.includes('bk')) return Colors.ink.black;
  if (n.includes('cyan')) return Colors.ink.cyan;
  if (n.includes('magenta')) return Colors.ink.magenta;
  if (n.includes('yellow')) return Colors.ink.yellow;
  return Colors.onSurfaceVariant;
}

export default function KioskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [refillTray, setRefillTray] = useState<PaperLevel | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [installingTray, setInstallingTray] = useState<string | null>(null);

  const fetcher = useCallback(() => api.getKiosk(id), [id]);
  const { data: kiosk, loading, error, refresh } = usePolling<Kiosk>(fetcher);

  async function handleResolve(alertId: string) {
    setResolvingId(alertId);
    try { await api.resolveAlert(alertId); refresh(); }
    finally { setResolvingId(null); }
  }

  async function handleInstall(trayId: string) {
    setInstallingTray(trayId);
    try { await api.installTray(id, trayId); refresh(); }
    finally { setInstallingTray(null); }
  }

  const trays = (kiosk?.paper_levels ?? kiosk?.trays ?? []).filter(
    (t) => t.tray_id !== 'tray_1' && t.tray_id !== 'tray1',
  );
  const activeAlerts = kiosk?.active_alerts?.filter((a) => a.status === 'active') ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[Typography.headlineSm, { color: Colors.onSurface }]} numberOfLines={1}>
            {kiosk?.kiosk_name ?? '…'}
          </Text>
          <Text style={[Typography.labelSm, { color: Colors.onSurfaceVariant }]} numberOfLines={1}>
            {kiosk?.location ?? ''}
          </Text>
        </View>
        {activeAlerts.length > 0 && (
          <View style={styles.alertBadge}>
            <Text style={styles.alertBadgeText}>{activeAlerts.length}</Text>
          </View>
        )}
      </View>

      {loading && !kiosk && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}
      {!!error && !kiosk && (
        <View style={styles.errorBox}>
          <Text style={[Typography.bodySm, { color: Colors.error }]}>{error}</Text>
        </View>
      )}

      {kiosk && (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={Colors.primary}
            />
          }
        >
          {/* Hero card — dark slate gradient */}
          <View style={styles.heroCard}>
            <View style={styles.heroRow}>
              <View style={{ flex: 1 }}>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: kiosk.online ? Colors.online + '33' : Colors.offline + '33',
                    borderColor: kiosk.online ? Colors.online + '66' : Colors.offline + '66' }
                ]}>
                  <View style={[styles.statusDot, { backgroundColor: kiosk.online ? Colors.online : Colors.offline }]} />
                  <Text style={[Typography.labelMd, { color: kiosk.online ? Colors.online : Colors.offline }]}>
                    {kiosk.online ? (kiosk.status ?? 'Online') : 'Offline'}
                  </Text>
                </View>
                <Text style={[Typography.displayLg, { color: '#fff', marginTop: 8, textTransform: 'capitalize' }]}>
                  {kiosk.status ?? 'Idle'}
                </Text>
              </View>
              <View style={styles.heroRight}>
                <Text style={[Typography.headlineLg, { color: '#fff' }]}>
                  {(kiosk.page_count ?? 0).toLocaleString()}
                </Text>
                <Text style={[Typography.labelSm, { color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5 }]}>
                  Pages Printed
                </Text>
              </View>
            </View>
            <TimeAgo iso={kiosk.last_seen} style={{ color: 'rgba(255,255,255,0.5)', marginTop: 8 }} />
            {/* Decorative circles */}
            <View style={styles.heroDecor1} />
            <View style={styles.heroDecor2} />
          </View>

          {/* Ink levels */}
          {kiosk.cartridges && kiosk.cartridges.length > 0 && (
            <Section title="Ink Levels">
              {kiosk.cartridges.map((c) => (
                <InkBar key={c.id} label={c.name} pct={c.level_pct} color={inkColor(c.name)} />
              ))}
            </Section>
          )}

          {/* Paper trays */}
          {trays.length > 0 && (
            <Section title="Paper">
              {trays.map((t) => (
                <TrayCard
                  key={t.tray_id}
                  tray={t}
                  onRefill={() => setRefillTray(t)}
                  onInstall={() => handleInstall(t.tray_id)}
                  installing={installingTray === t.tray_id}
                />
              ))}
            </Section>
          )}

          {/* Printer health */}
          {kiosk.error_state && (
            <Section title="Printer Health">
              <View style={styles.chipRow}>
                <HealthChip label="Door" ok={!kiosk.error_state.door_open} goodLabel="Closed" badLabel="Open" />
                {kiosk.error_state.paper_jam && <HealthChip label="Paper Jam" ok={false} />}
                {kiosk.error_state.tray_open && <HealthChip label="Tray" ok={false} badLabel="Open" />}
                {kiosk.error_state.cartridge_missing && <HealthChip label="Cartridge" ok={false} badLabel="Missing" />}
              </View>
            </Section>
          )}

          {/* Active alerts */}
          {activeAlerts.length > 0 && (
            <Section title={`Active Alerts (${activeAlerts.length})`}>
              {activeAlerts.map((a) => (
                <AlertCard
                  key={a.id}
                  alert={a}
                  onResolve={handleResolve}
                  resolving={resolvingId === a.id}
                />
              ))}
            </Section>
          )}
        </ScrollView>
      )}

      {refillTray && kiosk && (
        <RefillSheet
          visible
          tray={refillTray}
          kioskId={id}
          onClose={() => setRefillTray(null)}
          onSuccess={refresh}
        />
      )}
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[Typography.headlineSm, { color: Colors.onSurface, marginBottom: Spacing.sm }]}>
        {title}
      </Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function TrayCard({ tray, onRefill, onInstall, installing }: {
  tray: PaperLevel; onRefill: () => void; onInstall: () => void; installing: boolean;
}) {
  const isGood = tray.zone === 'good';
  const isCritical = tray.zone === 'critical' || tray.zone === 'empty';
  const zoneColor = isGood ? Colors.zoneGood : isCritical ? Colors.zoneLow : Colors.zoneWarning;
  const zoneBg = isGood ? Colors.zoneGoodBg : isCritical ? Colors.zoneLowBg : Colors.zoneWarningBg;
  const zoneName = tray.zone.charAt(0).toUpperCase() + tray.zone.slice(1);

  if (!tray.is_installed) {
    return (
      <View style={[styles.trayCard, styles.trayCardMuted]}>
        <Text style={[Typography.labelMd, { color: Colors.onSurfaceVariant }]}>{tray.tray_name}</Text>
        <Text style={[Typography.bodySm, { color: Colors.outline, marginTop: 4 }]}>Not installed</Text>
        <TouchableOpacity style={styles.installBtn} onPress={onInstall} disabled={installing}>
          {installing
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : <Text style={[Typography.labelMd, { color: Colors.primary }]}>Mark as Installed</Text>
          }
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.trayCard}>
      <View style={styles.trayHeader}>
        <Text style={[Typography.labelMd, { color: Colors.onSurface }]}>{tray.tray_name}</Text>
        <View style={[styles.zonePill, { backgroundColor: zoneBg }]}>
          <Text style={[Typography.labelSm, { color: zoneColor }]}>{zoneName}</Text>
        </View>
      </View>
      <View style={styles.trayBar}>
        <View style={[styles.trayFill, { backgroundColor: zoneColor, width: `${tray.pct}%` as any }]} />
      </View>
      <View style={styles.trayFooter}>
        <Text style={[Typography.bodySm, { color: Colors.onSurfaceVariant }]}>
          ~{tray.sheets_remaining} of {tray.capacity} sheets
        </Text>
        <TouchableOpacity style={styles.refillBtn} onPress={onRefill}>
          <Text style={[Typography.labelMd, { color: Colors.onPrimaryContainer }]}>Refill</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.onPrimaryContainer} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function HealthChip({ label, ok, goodLabel = 'OK', badLabel = label }: {
  label: string; ok?: boolean; goodLabel?: string; badLabel?: string;
}) {
  const color = ok ? Colors.online : Colors.error;
  const bg = ok ? Colors.zoneGoodBg : Colors.errorContainer;
  return (
    <View style={[styles.chip, { backgroundColor: bg, borderColor: color + '44' }]}>
      <View style={[styles.chipDot, { backgroundColor: color }]} />
      <Text style={[Typography.labelMd, { color }]}>
        {label}: {ok ? goodLabel : badLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.marginMobile,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBadge: {
    backgroundColor: Colors.error,
    borderRadius: Radius.pill,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  alertBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorBox: {
    margin: Spacing.md,
    backgroundColor: Colors.errorContainer,
    borderRadius: Radius.xl,
    padding: Spacing.md,
  },
  content: { padding: Spacing.marginMobile, paddingBottom: 40 },
  heroCard: {
    backgroundColor: Colors.inverseSurface,
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    ...Shadow.card,
  },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  heroRight: { alignItems: 'flex-end' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: Radius.pill },
  heroDecor1: {
    position: 'absolute',
    bottom: -20,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroDecor2: {
    position: 'absolute',
    top: -10,
    right: 60,
    width: 60,
    height: 60,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  section: { marginBottom: Spacing.md },
  sectionCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.card,
    padding: Spacing.md,
    gap: Spacing.xs,
    ...Shadow.card,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
  },
  chipDot: { width: 7, height: 7, borderRadius: Radius.pill },
  trayCard: {
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLow,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '44',
    gap: Spacing.sm,
  },
  trayCardMuted: { opacity: 0.65 },
  trayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  zonePill: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  trayBar: {
    height: 10,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceContainerHigh,
    overflow: 'hidden',
  },
  trayFill: { height: '100%', borderRadius: Radius.pill },
  trayFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  refillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primaryContainer,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  installBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
});
