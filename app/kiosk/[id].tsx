import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '../../constants/theme';

export default function KioskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={Typography.h3} numberOfLines={1}>Kiosk Detail</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        <Ionicons name="print-outline" size={48} color={Colors.textMuted} />
        <Text style={[Typography.h3, { marginTop: Spacing.md }]}>Detail coming soon</Text>
        <Text style={[Typography.bodySecondary, styles.sub]}>
          Kiosk ID: {id}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  back: { width: 40, alignItems: 'flex-start' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  sub: { marginTop: Spacing.xs, textAlign: 'center' },
});
