import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/theme';

interface Props {
  online: boolean;
  status?: string;
  size?: number;
}

export function StatusDot({ online, status, size = 8 }: Props) {
  const color = online ? Colors.online : Colors.offline;
  const label = online ? (status ?? 'Online') : 'Offline';
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: {},
  label: { fontSize: 13, fontWeight: '600' },
});
