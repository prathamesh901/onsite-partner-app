import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';

import { Colors, Radius, Typography } from '../constants/theme';

interface Props {
  label: string;
  /** Filled accent style when selected. */
  selected?: boolean;
  /** Tap handler — renders as a pressable pill when provided. */
  onPress?: () => void;
  color?: string;
  style?: ViewStyle;
}

/** Full-rounded pill / badge. Selected = accent fill + white text. */
export function Badge({ label, selected = false, onPress, color, style }: Props) {
  const bg = selected ? color ?? Colors.accent : Colors.pillBg;
  const fg = selected ? Colors.white : Colors.textSecondary;

  const content = (
    <Text style={[Typography.label, { color: fg }]} numberOfLines={1}>
      {label}
    </Text>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.pill, { backgroundColor: bg }, style]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <Text
      style={[styles.pill, styles.staticText, { backgroundColor: bg, color: fg }, style]}
      numberOfLines={1}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  staticText: { ...Typography.label, overflow: 'hidden' },
});
