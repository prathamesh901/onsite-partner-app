import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { Cartridge } from '../lib/types';

const INK_COLORS: Record<string, string> = {
  black: '#1A2B3C',
  cyan: '#22B8CF',
  magenta: '#E64980',
  yellow: '#FAB005',
};

function inkColor(name: string): string {
  const lower = name.toLowerCase();
  for (const key of Object.keys(INK_COLORS)) {
    if (lower.includes(key)) return INK_COLORS[key];
  }
  return Colors.textMuted;
}

interface Props {
  cartridge: Cartridge;
}

export function InkBar({ cartridge }: Props) {
  const { name, level_pct, unreadable } = cartridge;
  const color = inkColor(name);
  const isLow = level_pct !== null && !unreadable && level_pct < 15;
  const barColor = isLow ? Colors.error : color;
  const pct = level_pct !== null && !unreadable ? Math.max(0, Math.min(100, level_pct)) : null;

  const shortName = name.replace(/cartridge/i, '').trim().split(' ')[0];

  return (
    <View style={styles.row}>
      <Text style={[styles.label, isLow && { color: Colors.error }]} numberOfLines={1}>
        {shortName}
      </Text>
      <View style={styles.track}>
        {pct !== null ? (
          <View style={[styles.fill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
        ) : (
          <View style={styles.unreadable} />
        )}
      </View>
      <Text style={[styles.pct, isLow && { color: Colors.error }]}>
        {pct !== null ? `${Math.round(pct)}%` : '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  label: {
    ...Typography.caption,
    width: 42,
    textTransform: 'capitalize',
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: Radius.pill },
  unreadable: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: Colors.textMuted,
    opacity: 0.3,
  },
  pct: { ...Typography.caption, width: 30, textAlign: 'right' },
});
