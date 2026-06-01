import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../constants/theme';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        <Text style={[Typography.headlineMd, { color: Colors.onSurface }]}>Profile</Text>

        {/* Avatar card */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={48} color={Colors.onPrimary} />
          </View>
          <Text style={[Typography.headlineSm, { color: Colors.onSurface, marginTop: 12 }]}>
            Onsite Partner
          </Text>
          <Text style={[Typography.bodySm, { color: Colors.onSurfaceVariant, marginTop: 4 }]}>
            PrintBuddy Partner App
          </Text>
        </View>

        {/* Settings list */}
        <View style={styles.card}>
          <SettingsRow icon="print-outline" label="App Version" value="1.0.0" />
          <SettingsRow icon="server-outline" label="API Endpoint" value="Connected" valueColor={Colors.online} />
          <SettingsRow icon="shield-checkmark-outline" label="Authentication" value="Coming soon" muted />
          <SettingsRow icon="notifications-outline" label="Push Notifications" value="Coming soon" muted />
          <SettingsRow icon="moon-outline" label="Dark Mode" value="System default" />
        </View>

        {/* Coming soon pill */}
        <View style={styles.comingSoon}>
          <Ionicons name="time-outline" size={16} color={Colors.onSurfaceVariant} />
          <Text style={[Typography.bodySm, { color: Colors.onSurfaceVariant }]}>
            Auth &amp; notifications coming in the next release
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function SettingsRow({ icon, label, value, valueColor, muted }: {
  icon: string; label: string; value: string; valueColor?: string; muted?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7}>
      <View style={[styles.rowIcon, { backgroundColor: muted ? Colors.surfaceContainer : Colors.primaryFixed + '44' }]}>
        <Ionicons name={icon as any} size={18} color={muted ? Colors.outline : Colors.primary} />
      </View>
      <Text style={[Typography.bodyMd, { flex: 1, color: Colors.onSurface }]}>{label}</Text>
      <Text style={[Typography.labelMd, { color: valueColor ?? (muted ? Colors.outline : Colors.onSurfaceVariant) }]}>
        {value}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.outlineVariant} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, padding: Spacing.marginMobile, gap: Spacing.md },
  avatarCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.card,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadow.card,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.card,
    overflow: 'hidden',
    ...Shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant + '44',
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radius.xl,
    padding: Spacing.md,
  },
});
