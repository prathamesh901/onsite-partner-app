import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../constants/theme';

interface Props {
  online: boolean;
  status?: string;
  size?: number;
}

export function StatusDot({ online, status, size = 8 }: Props) {
  const isAlert = status?.toLowerCase() === 'alert' || status?.toLowerCase() === 'warning';
  const color = online ? (isAlert ? Colors.alert : Colors.online) : Colors.offline;
  const label = !online ? 'Offline' : isAlert ? 'Alert' : (status ?? 'Online');

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]} />
      <Text style={[Typography.labelSm, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: {},
});
