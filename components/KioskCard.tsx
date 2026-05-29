import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Shadow } from '../constants/theme';
import { Kiosk } from '../lib/types';
import { InkBar } from './InkBar';
import { StatusDot } from './StatusDot';
import { TimeAgo } from './TimeAgo';

const ZONE_COLORS: Record<string, string> = {
  good: Colors.zoneGood,
  low: Colors.zoneLow,
  critical: Colors.zoneCritical,
  empty: Colors.zoneEmpty,
};

const INK_COLORS: Record<string, string> = {
  B: Colors.ink.black,
  C: Colors.ink.cyan,
  M: Colors.ink.magenta,
  Y: Colors.ink.yellow,
};

function inkLabel(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('black')) return 'B';
  if (n.includes('cyan')) return 'C';
  if (n.includes('magenta')) return 'M';
  if (n.includes('yellow')) return 'Y';
  return name[0].toUpperCase();
}

interface Props {
  kiosk: Kiosk;
}

export function KioskCard({ kiosk }: Props) {
  const router = useRouter();
  const levels = (kiosk.paper_levels ?? kiosk.trays ?? []).filter(
    (t) => t.tray_id !== 'tray_1' && t.tray_id !== 'tray1',
  );
  const alertCount = kiosk.active_alerts?.filter((a) => a.status === 'active').length ?? 0;

  return (
    <TouchableOpacity
      style={[styles.card, !kiosk.online && styles.offlineCard]}
      onPress={() => router.push(`/kiosk/${kiosk.kiosk_id}`)}
      activeOpacity={0.85}
    >
      {!kiosk.online && <View style={styles.offlineOverlay} pointerEvents="none" />}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{kiosk.kiosk_name}</Text>
          <Text style={styles.location}>{kiosk.location}</Text>
        </View>
        {alertCount > 0 && (
          <View style={styles.alertBadge}>
            <Text style={styles.alertBadgeText}>{alertCount}</Text>
          </View>
        )}
      </View>
      <View style={styles.statusRow}>
        <StatusDot online={kiosk.online} status={kiosk.status} />
        <TimeAgo iso={kiosk.last_seen} />
      </View>
      {kiosk.cartridges && kiosk.cartridges.length > 0 && (
        <View style={styles.inkRow}>
          {kiosk.cartridges.map((c) => {
            const lbl = inkLabel(c.name);
            return (
              <InkBar
                key={c.id}
                label={lbl}
                pct={c.level_pct}
                color={INK_COLORS[lbl] ?? Colors.textSecondary}
                compact
              />
            );
          })}
        </View>
      )}
      {levels.length > 0 && (
        <View style={styles.pillRow}>
          {levels.map((t) => (
            <View key={t.tray_id} style={[styles.pill, { backgroundColor: ZONE_COLORS[t.zone] + '22' }]}>
              <Text style={[styles.pillText, { color: ZONE_COLORS[t.zone] }]}>
                {t.tray_name} · {t.zone.charAt(0).toUpperCase() + t.zone.slice(1)} {t.pct}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    padding: 16,
    marginBottom: 12,
    ...Shadow.card,
  },
  offlineCard: { opacity: 0.85 },
  offlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F3F4F6',
    borderRadius: Radius.card,
    opacity: 0.4,
    zIndex: 1,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  name: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  location: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
  alertBadge: {
    backgroundColor: Colors.alertCritical,
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  alertBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  inkRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '600' },
});
