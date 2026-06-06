import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';

import { Colors, Radius, Typography } from '../constants/theme';

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Secondary (outline) style. */
  variant?: 'primary' | 'secondary';
  /** Show a trailing chevron. */
  chevron?: boolean;
  style?: ViewStyle;
}

/** Pill-shaped button. Primary = sky-blue fill; secondary = outline. */
export function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  chevron = false,
  style,
}: Props) {
  const isSecondary = variant === 'secondary';
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        isSecondary ? styles.secondary : styles.primary,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={isSecondary ? Colors.accent : Colors.white} />
      ) : (
        <>
          <Text style={[styles.label, { color: isSecondary ? Colors.accent : Colors.white }]}>
            {title}
          </Text>
          {chevron && (
            <Ionicons name="chevron-forward" size={18} color={isSecondary ? Colors.accent : Colors.white} />
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: Radius.pill,
    paddingVertical: 15,
    paddingHorizontal: 24,
  },
  primary: { backgroundColor: Colors.accent },
  secondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.accent },
  disabled: { opacity: 0.5 },
  label: { ...Typography.body, fontWeight: '700' },
});
