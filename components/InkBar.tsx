import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Typography } from '../constants/theme';

interface Props {
  label: string;
  pct: number;
  color: string;
  compact?: boolean;
}

export function InkBar({ label, pct, color, compact = false }: Props) {
  const isLow = pct < 15;
  const fillColor = isLow ? Colors.error : color;

  if (compact) {
    return (
      <View style={styles.compactWrap}>
        <View style={styles.compactTrack}>
          <View style={[styles.compactFill, { backgroundColor: fillColor, width: `${pct}%` as any }]} />
        </View>
        <Text style={[Typography.labelSm, { color: isLow ? Colors.error : Colors.onSurfaceVariant }]}>
          {label}
        </Text>
        <Text style={[Typography.labelSm, { color: isLow ? Colors.error : Colors.onSurfaceVariant }]}>
          {pct}%
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={[Typography.labelMd, styles.name, { color: isLow ? Colors.error : Colors.onSurface }]}>
        {label}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { backgroundColor: fillColor, width: `${pct}%` as any }]} />
      </View>
      <Text style={[Typography.labelMd, styles.pct, { color: isLow ? Colors.error : Colors.onSurfaceVariant }]}>
        {pct}%
      </Text>
      {isLow && (
        <View style={styles.lowTag}>
          <Text style={styles.lowText}>LOW</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  name: { width: 72 },
  track: {
    flex: 1,
    height: 16,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceContainerHigh,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: Radius.pill },
  pct: { width: 40, textAlign: 'right' },
  lowTag: {
    backgroundColor: Colors.error,
    borderRadius: Radius.lg,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  lowText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  compactWrap: { flex: 1, alignItems: 'center', gap: 3 },
  compactTrack: {
    width: '100%',
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceContainerHigh,
    overflow: 'hidden',
  },
  compactFill: { height: '100%', borderRadius: Radius.pill },
});
