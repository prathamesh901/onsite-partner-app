import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Card, PrimaryButton, Screen } from '../../../components';
import { Colors, Radius, Spacing, Typography } from '../../../constants/theme';
import { useAuth } from '../../../context/AuthContext';

export default function ProfileScreen() {
  const { profile, session, signOut } = useAuth();

  const email = profile?.email ?? session?.user?.email ?? '—';
  const name = profile?.name ?? 'Onsite Partner';
  const role = String(profile?.role ?? 'partner');
  const status = String(profile?.status ?? 'approved');

  return (
    <Screen>
      <Text style={[Typography.h1, styles.header]}>Profile</Text>

      <Card style={styles.identity}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color={Colors.white} />
        </View>
        <Text style={Typography.h3}>{name}</Text>
        <Text style={Typography.bodySecondary}>{email}</Text>
        <View style={styles.badges}>
          <Badge label={role} selected color={Colors.accent} />
          <Badge label={status} selected color={Colors.online} />
        </View>
      </Card>

      <Card style={styles.list}>
        <Row icon="server-outline" label="Backend" value="Connected" valueColor={Colors.online} />
        <Row icon="key-outline" label="Auth" value="Supabase OTP" />
        <Row icon="information-circle-outline" label="App version" value="1.0.0" />
      </Card>

      <PrimaryButton title="Sign out" variant="secondary" onPress={signOut} style={styles.signOut} />
    </Screen>
  );
}

function Row({ icon, label, value, valueColor }: {
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={Colors.accent} />
      </View>
      <Text style={[Typography.body, { flex: 1 }]}>{label}</Text>
      <Text style={[Typography.label, { color: valueColor ?? Colors.textSecondary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: Spacing.lg },
  identity: { alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.md },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  badges: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  list: { gap: Spacing.md, marginBottom: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    backgroundColor: Colors.pillBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOut: {},
});
