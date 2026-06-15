import { StyleSheet, Text } from 'react-native';

import { Colors, Radius } from '../constants/theme';

interface Props {
  type: 'standard' | 'estamp' | string;
}

export function TypeBadge({ type }: Props) {
  const isEStamp = type === 'estamp';
  return (
    <Text style={[styles.base, isEStamp ? styles.estamp : styles.standard]}>
      {isEStamp ? 'e-Stamp' : 'Standard'}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontSize: 11,
    fontWeight: '600' as const,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  standard: {
    backgroundColor: Colors.hero + '18',
    color: Colors.hero,
  },
  estamp: {
    backgroundColor: Colors.accent + '22',
    color: Colors.accentDark,
  },
});
