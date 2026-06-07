import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { PaperTotal } from '../lib/types';

function zoneColor(zone: string): string {
  switch (zone) {
    case 'Good': return Colors.online;
    case 'Low': return Colors.warning;
    case 'Critical':
    case 'Empty': return Colors.error;
    default: return Colors.textMuted;
  }
}

interface Props {
  paper: PaperTotal;
}

export function PaperTotalBar({ paper }: Props) {
  const { sheets_remaining, total_capacity, pct, zone } = paper;
  const fillPct = Math.max(0, Math.min(100, pct ?? 0));
  const color = zoneColor(zone);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Paper</Text>
        <View style={styles.right}>
          <Text style={styles.count}>
            ~{sheets_remaining?.toLocaleString()} of {total_capacity?.toLocaleString()}
          </Text>
          <View style={[styles.pill, { backgroundColor: color + '22' }]}>
            <Text style={[styles.pillText, { color }]}>{zone}</Text>
          </View>
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fillPct}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { ...Typography.caption, color: Colors.textMuted },
  right: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  count: { ...Typography.caption },
  pill: {
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillText: { fontSize: 11, fontWeight: '600' as const },
  track: {
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: Radius.pill },
});
