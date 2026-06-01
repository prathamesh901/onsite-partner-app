import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Shadow, Spacing, Typography } from '../constants/theme';
import { Kiosk } from '../lib/types';
import { StatusDot } from './StatusDot';
import { TimeAgo } from './TimeAgo';

const INK_COLORS: Record<string, string> = {
  B: Colors.ink.black,
  C: Colors.ink.cyan,
  M: Colors.ink.magenta,
  Y: Colors.ink.yellow,
};

function inkLabel(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('black') || n.includes('k')) return 'B';
  if (n.includes('cyan') || n.includes('c')) return 'C';
  if (n.includes('magenta') || n.includes('m')) return 'M';
  if (n.includes('yellow') || n.includes('y')) return 'Y';
  return name[0]?.toUpperCase() ?? '?';
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
  const isAlert = alertCount > 0 || kiosk.status?.toLowerCase() === 'alert';

  return (
    <TouchableOpacity
      style={[styles.card, !kiosk.online && styles.offlineCard]}
      onPress={() => router.push(`/kiosk/${kiosk.kiosk_id}`)}
      activeOpacity={0.94}
    >
      {/* Header row */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[Typography.headlineSm, { color: Colors.onSurface }]}>{kiosk.kiosk_name}</Text>
          <Text style={[Typography.bodySm, { color: Colors.secondary, marginTop: 1 }]}>{kiosk.location}</Text>
        </View>
        <View style={styles.headerRight}>
          <StatusDot online={kiosk.online} status={kiosk.status} />
          <TimeAgo iso={kiosk.last_seen} prefix="Updated " />
          {alertCount > 0 && (
            <View style={styles.alertBadge}>
              <Text style={styles.alertBadgeText}>{alertCount}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Ink consumables */}
      {kiosk.cartridges && kiosk.cartridges.length > 0 && (
        <View style={styles.inkSection}>
          <View style={styles.inkHeader}>
            <Text style={[Typography.labelSm, { color: Colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
              Consumables
            </Text>
            <Text style={[Typography.labelSm, { color: Colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
              Estimated Levels
            </Text>
          </View>
          <View style={styles.inkRow}>
            {kiosk.cartridges.map((c) => {
              const lbl = inkLabel(c.name);
              const isLow = c.level_pct < 15;
              const fillColor = isLow ? Colors.error : (INK_COLORS[lbl] ?? Colors.onSurfaceVariant);
              return (
                <View key={c.id} style={styles.inkCol}>
                  <View style={styles.inkTrack}>
                    <View style={[styles.inkFill, { backgroundColor: fillColor, width: `${c.level_pct}%` as any }]} />
                  </View>
                  <Text style={[Typography.labelSm, { color: isLow ? Colors.error : Colors.onSurfaceVariant }]}>
                    {lbl} {c.level_pct}%
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Paper status */}
      {levels.length > 0 && (
        <View style={styles.paperRow}>
          {levels.map((t) => {
            const isGood = t.zone === 'good';
            const isCritical = t.zone === 'critical' || t.zone === 'empty';
            const bg = isGood ? Colors.zoneGoodBg : isCritical ? Colors.zoneLowBg : Colors.zoneWarningBg;
            const fg = isGood ? Colors.zoneGood : isCritical ? Colors.zoneLow : Colors.zoneWarning;
            const zoneName = t.zone.charAt(0).toUpperCase() + t.zone.slice(1);
            return (
              <View key={t.tray_id} style={[styles.paperPill, { backgroundColor: bg }]}>
                <Text style={[Typography.labelSm, { color: fg }]}>
                  {t.tray_name} · {zoneName} {t.pct}%
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.gutter,
    gap: Spacing.md,
    ...Shadow.card,
  },
  offlineCard: { opacity: 0.6 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  headerRight: { alignItems: 'flex-end', gap: 4 },
  alertBadge: {
    backgroundColor: Colors.error,
    borderRadius: Radius.pill,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  alertBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  inkSection: { gap: Spacing.sm },
  inkHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  inkRow: { flexDirection: 'row', gap: 8 },
  inkCol: { flex: 1, gap: 4 },
  inkTrack: {
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceContainerHigh,
    overflow: 'hidden',
  },
  inkFill: { height: '100%', borderRadius: Radius.pill },
  paperRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerHighest,
  },
  paperPill: {
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
});
