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
import { Colors, Radius, Shadow } from '../../constants/theme';
import { usePolling } from '../../hooks/usePolling';
import { api } from '../../lib/api';
import { Kiosk, PaperLevel } from '../../lib/types';

const INK_COLORS: Record<string, string> = {
  black: Colors.ink.black,
  cyan: Colors.ink.cyan,
  magenta: Colors.ink.magenta,
  yellow: Colors.ink.yellow,
};

const ZONE_COLORS: Record<string, string> = {
  good: Colors.zoneGood,
  low: Colors.zoneLow,
  critical: Colors.zoneCritical,
  empty: Colors.zoneEmpty,
};

function inkColor(name: string) {
  const n = name.toLowerCase();
  for (const k of Object.keys(INK_COLORS)) {
    if (n.includes(k)) return INK_COLORS[k];
  }
  return Colors.textSecondary;
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
    try {
      await api.resolveAlert(alertId);
      refresh();
    } finally {
      setResolvingId(null);
    }
  }

  async function handleInstall(trayId: string) {
    setInstallingTray(trayId);
    try {
      await api.installTray(id, trayId);
      refresh();
    } finally {
      setInstallingTray(null);
    }
  }

  const trays = (kiosk?.paper_levels ?? kiosk?.trays ?? []).filter(
    (t) => t.tray_id !== 'tray_1' && t.tray_id !== 'tray1',
  );
  const activeAlerts = kiosk?.active_alerts?.filter((a) => a.status === 'active') ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{kiosk?.kiosk_name ?? '...'}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{kiosk?.location ?? ''}</Text>
        </View>
      </View>

      {loading && !kiosk && (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      )}
      {!!error && !kiosk && (
        <View style={styles.errorBox}><Text style={styles.errorText}>⚠️ {error}</Text></View>
      )}

      {kiosk && (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loading && !!kiosk} onRefresh={refresh} tintColor={Colors.primary} />}
        >
          {/* Hero card */}
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroStatus}>{kiosk.status ?? 'Unknown'}</Text>
                <Text style={styles.heroPages}>{kiosk.page_count?.toLocaleString()} pages printed</Text>
              </View>
              <View style={[styles.onlineDot, { backgroundColor: kiosk.online ? Colors.online : Colors.offline }]} />
            </View>
            <TimeAgo iso={kiosk.last_seen} style={{ color: 'rgba(255,255,255,0.7)' }} />
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
                  kioskId={id}
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
                <HealthChip
                  label="Door"
                  bad={kiosk.error_state.door_open}
                  goodLabel="Closed"
                  badLabel="Open"
                />
                {kiosk.error_state.paper_jam && <HealthChip label="Paper Jam" bad />}
                {kiosk.error_state.tray_open && <HealthChip label="Tray Open" bad />}
                {kiosk.error_state.cartridge_missing && <HealthChip label="Cartridge Missing" bad />}
              </View>
            </Section>
          )}

          {/* Active alerts */}
          {activeAlerts.length > 0 && (
            <Section title="Active Alerts">
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
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function TrayCard({ tray, kioskId, onRefill, onInstall, installing }: {
  tray: PaperLevel;
  kioskId: string;
  onRefill: () => void;
  onInstall: () => void;
  installing: boolean;
}) {
  const zoneColor = ZONE_COLORS[tray.zone] ?? Colors.textMuted;
  if (!tray.is_installed) {
    return (
      <View style={[styles.trayCard, styles.trayCardInstall]}>
        <Text style={styles.trayName}>{tray.tray_name}</Text>
        <Text style={styles.notInstalled}>Not installed</Text>
        <TouchableOpacity style={styles.installBtn} onPress={onInstall} disabled={installing}>
          {installing ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={styles.installText}>Mark as Installed</Text>}
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={styles.trayCard}>
      <View style={styles.trayHeader}>
        <Text style={styles.trayName}>{tray.tray_name}</Text>
        <View style={[styles.zonePill, { backgroundColor: zoneColor + '22' }]}>
          <Text style={[styles.zoneText, { color: zoneColor }]}>
            {tray.zone.charAt(0).toUpperCase() + tray.zone.slice(1)}
          </Text>
        </View>
      </View>
      <View style={styles.trayBar}>
        <View style={[styles.trayFill, { backgroundColor: zoneColor, width: `${tray.pct}%` as any }]} />
      </View>
      <View style={styles.trayFooter}>
        <Text style={styles.traySheets}>~{tray.sheets_remaining} of {tray.capacity} sheets</Text>
        <TouchableOpacity style={styles.refillBtn} onPress={onRefill}>
          <Text style={styles.refillText}>Refill</Text>
          <Ionicons name="chevron-forward" size={14} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function HealthChip({ label, bad, goodLabel = 'OK', badLabel = label }: {
  label: string;
  bad?: boolean;
  goodLabel?: string;
  badLabel?: string;
}) {
  const color = bad ? Colors.alertCritical : Colors.online;
  const text = bad ? badLabel : goodLabel;
  return (
    <View style={[styles.chip, { backgroundColor: color + '18', borderColor: color + '40' }]}>
      <View style={[styles.chipDot, { backgroundColor: color }]} />
      <Text style={[styles.chipText, { color }]}>{label}: {text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  headerSub: { fontSize: 13, color: Colors.textSecondary },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorBox: { margin: 20, backgroundColor: Colors.alertCritical + '18', borderRadius: 12, padding: 16 },
  errorText: { color: Colors.alertCritical },
  heroCard: {
    borderRadius: Radius.card,
    backgroundColor: Colors.heroGradientEnd,
    padding: 20,
    marginBottom: 16,
    ...Shadow.card,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  heroStatus: { fontSize: 26, fontWeight: '800', color: '#FFF', textTransform: 'capitalize' },
  heroPages: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  onlineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 8 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8, marginLeft: 2 },
  sectionCard: { backgroundColor: Colors.card, borderRadius: Radius.card, padding: 16, ...Shadow.card },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 13, fontWeight: '600' },
  trayCard: { borderRadius: 12, backgroundColor: '#F8FBFE', padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  trayCardInstall: { opacity: 0.7 },
  trayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  trayName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  zonePill: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  zoneText: { fontSize: 12, fontWeight: '600' },
  trayBar: { height: 8, borderRadius: 4, backgroundColor: '#E5E7EB', overflow: 'hidden', marginBottom: 8 },
  trayFill: { height: '100%', borderRadius: 4 },
  trayFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  traySheets: { fontSize: 13, color: Colors.textSecondary },
  refillBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primary, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
  refillText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  notInstalled: { fontSize: 13, color: Colors.textMuted, marginVertical: 4 },
  installBtn: { alignSelf: 'flex-start', marginTop: 6, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 6 },
  installText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
});
