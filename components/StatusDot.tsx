import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Typography } from '../constants/theme';

export type StatusKind = 'online' | 'warning' | 'offline' | 'error';

const STATUS_COLOR: Record<StatusKind, string> = {
  online: Colors.online,
  warning: Colors.warning,
  offline: Colors.offline,
  error: Colors.error,
};

interface Props {
  status: StatusKind;
  label?: string;
  size?: number;
}

/** Leading colored dot + optional label. */
export function StatusDot({ status, label, size = 8 }: Props) {
  const color = STATUS_COLOR[status];
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]} />
      {label != null && <Text style={[Typography.label, { color }]}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: {},
});
