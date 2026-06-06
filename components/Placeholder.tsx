import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { Card } from './Card';
import { Screen } from './Screen';

interface Props {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}

/** Simple "coming soon" placeholder for a not-yet-built tab. */
export function Placeholder({ title, icon, description }: Props) {
  return (
    <Screen>
      <Text style={[Typography.h1, styles.header]}>{title}</Text>
      <Card style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={36} color={Colors.accent} />
        </View>
        <Text style={Typography.h3}>Coming soon</Text>
        <Text style={[Typography.bodySecondary, styles.desc]}>{description}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: Spacing.lg },
  card: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: Radius.pill,
    backgroundColor: Colors.pillBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  desc: { textAlign: 'center', paddingHorizontal: Spacing.md },
});
