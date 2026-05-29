import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/theme';

interface Props {
  label: string;
  pct: number;
  color: string;
  compact?: boolean;
}

export function InkBar({ label, pct, color, compact = false }: Props) {
  const isLow = pct < 15;
  if (compact) {
    return (
      <View style={styles.compactWrap}>
        <View style={styles.compactTrack}>
          <View style={[styles.compactFill, { backgroundColor: isLow ? Colors.alertCritical : color, width: `${pct}%` as any }]} />
        </View>
        <Text style={[styles.compactLabel, { color: isLow ? Colors.alertCritical : Colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.compactPct, { color: isLow ? Colors.alertCritical : Colors.textSecondary }]}>{pct}%</Text>
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <Text style={[styles.name, { color: isLow ? Colors.alertCritical : Colors.textPrimary }]}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { backgroundColor: isLow ? Colors.alertCritical : color, width: `${pct}%` as any }]} />
      </View>
      <Text style={[styles.pct, { color: isLow ? Colors.alertCritical : Colors.textSecondary }]}>{pct}%</Text>
      {isLow && <View style={styles.lowTag}><Text style={styles.lowText}>LOW</Text></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  name: { width: 60, fontSize: 14, fontWeight: '600' },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  pct: { width: 36, fontSize: 13, textAlign: 'right' },
  lowTag: { backgroundColor: Colors.alertCritical, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  lowText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  compactWrap: { flex: 1, alignItems: 'center', gap: 2 },
  compactTrack: { width: '100%', height: 5, borderRadius: 3, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  compactFill: { height: '100%', borderRadius: 3 },
  compactLabel: { fontSize: 10, fontWeight: '600' },
  compactPct: { fontSize: 10 },
});
