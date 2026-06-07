import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Radius, Shadow, Spacing, Typography } from '../constants/theme';
import { Cartridge, Kiosk } from '../lib/types';
import { InkBar } from './InkBar';
import { PaperTotalBar } from './PaperTotalBar';
import { TypeBadge } from './TypeBadge';

function statusLabel(kiosk: Kiosk): string {
  if (!kiosk.online) return 'Offline';
  switch (kiosk.status) {
    case 'printing': return 'Printing';
    case 'warmup': return 'Warming up';
    case 'idle': return 'Idle';
    default: return 'Unknown';
  }
}

function statusColor(kiosk: Kiosk): string {
  if (!kiosk.online) return Colors.offline;
  switch (kiosk.status) {
    case 'printing': return Colors.accent;
    case 'warmup': return Colors.warning;
    case 'idle': return Colors.online;
    default: return Colors.textMuted;
  }
}

export function countKioskAlerts(kiosk: Kiosk): number {
  const { error_state, cartridges, paper_total } = kiosk;
  let n = 0;
  if (error_state?.door_open) n++;
  if (error_state?.paper_jam) n++;
  if (error_state?.cartridge_missing) n++;
  if (error_state?.tray2_open) n++;
  if (error_state?.tray3_open) n++;
  cartridges?.forEach((c: Cartridge) => { if (c.low || c.critical || c.empty) n++; });
  if (paper_total?.zone && paper_total.zone !== 'Good') n++;
  return n;
}

interface Props {
  kiosk: Kiosk;
}

export function KioskCard({ kiosk }: Props) {
  const router = useRouter();
  const alertCount = countKioskAlerts(kiosk);
  const color = statusColor(kiosk);
  const label = statusLabel(kiosk);
  const dimmed = !kiosk.online;

  return (
    <TouchableOpacity
      style={[styles.card, dimmed && styles.dimmed]}
      onPress={() => router.push(`/kiosk/${kiosk.kiosk_id}` as any)}
      activeOpacity={0.85}
    >
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <Text style={[Typography.h3, dimmed && styles.dimText]} numberOfLines={1}>
            {kiosk.kiosk_name}
          </Text>
          <Text style={[Typography.bodySecondary, dimmed && styles.dimText]} numberOfLines={1}>
            {kiosk.location}
          </Text>
        </View>
        <View style={styles.badges}>
          <TypeBadge type={kiosk.kiosk_type} />
          {alertCount > 0 && (
            <View style={styles.alertBadge}>
              <Text style={styles.alertText}>{alertCount}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Status row */}
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.statusText, { color }]}>{label}</Text>
        {kiosk.last_seen && (
          <Text style={styles.lastSeen} numberOfLines={1}>
            · {formatLastSeen(kiosk.last_seen)}
          </Text>
        )}
        <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={styles.chevron} />
      </View>

      <View style={styles.divider} />

      {/* Ink bars */}
      {kiosk.cartridges?.length > 0 && (
        <View style={styles.inkSection}>
          {kiosk.cartridges.map((c) => (
            <InkBar key={c.id} cartridge={c} />
          ))}
        </View>
      )}

      {/* Paper bar */}
      {kiosk.paper_total && (
        <PaperTotalBar paper={kiosk.paper_total} />
      )}
    </TouchableOpacity>
  );
}

function formatLastSeen(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.card,
  },
  dimmed: { opacity: 0.65 },
  dimText: { color: Colors.textMuted },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  titleGroup: { flex: 1, gap: 2 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexShrink: 0 },
  alertBadge: {
    backgroundColor: Colors.error,
    borderRadius: Radius.pill,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  alertText: { fontSize: 11, fontWeight: '700' as const, color: Colors.white },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '600' as const },
  lastSeen: { ...Typography.caption, flex: 1 },
  chevron: { marginLeft: 'auto' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 2 },
  inkSection: { gap: 5 },
});
