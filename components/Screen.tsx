import React from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '../constants/theme';

interface Props {
  children: React.ReactNode;
  /** Wrap content in a ScrollView (default true). */
  scroll?: boolean;
  /** Center content vertically + horizontally (e.g. for placeholders). */
  center?: boolean;
  style?: ViewStyle;
  edges?: Edge[];
}

/** Standard screen wrapper: safe area + themed background + padding. */
export function Screen({ children, scroll = true, center = false, style, edges = ['top'] }: Props) {
  const inner = center ? [styles.inner, styles.center, style] : [styles.inner, style];

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={center ? [styles.scrollContent, styles.center] : styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={inner}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  inner: { flex: 1, padding: Spacing.lg },
  scrollContent: { padding: Spacing.lg, flexGrow: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
});
