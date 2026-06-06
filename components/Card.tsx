import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { Colors, Radius, Shadow, Spacing } from '../constants/theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Dark slate "hero" variant with light text. */
  hero?: boolean;
}

/** White rounded surface with soft shadow (or dark hero variant). */
export function Card({ children, style, hero = false }: Props) {
  return <View style={[styles.card, hero && styles.hero, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    ...Shadow.card,
  },
  hero: {
    backgroundColor: Colors.hero,
  },
});
