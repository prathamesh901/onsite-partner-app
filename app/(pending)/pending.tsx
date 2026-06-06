import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, PrimaryButton, Screen } from '../../components';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

export default function PendingScreen() {
  const { profile, profileError, refreshProfile, signOut } = useAuth();
  const [checking, setChecking] = useState(false);

  const status = profile?.status ?? 'pending';
  const rejected = status === 'rejected' || status === 'suspended';

  async function handleRefresh() {
    setChecking(true);
    try {
      await refreshProfile();
    } finally {
      setChecking(false);
    }
  }

  return (
    <Screen center>
      <View style={styles.wrap}>
        <View style={[styles.iconCircle, rejected && styles.iconCircleError]}>
          <Ionicons
            name={rejected ? 'close-circle-outline' : 'hourglass-outline'}
            size={44}
            color={rejected ? Colors.error : Colors.warning}
          />
        </View>

        <Text style={[Typography.h2, styles.center]}>
          {rejected ? 'Access not granted' : 'Pending approval'}
        </Text>
        <Text style={[Typography.bodySecondary, styles.center, styles.body]}>
          {rejected
            ? 'Your account is not currently active. Please contact your administrator for assistance.'
            : "Your account has been created and is awaiting administrator approval. You'll get access as soon as it's approved."}
        </Text>

        {profile?.email && (
          <Card style={styles.infoCard}>
            <Row label="Email" value={profile.email} />
            <Row label="Status" value={String(status)} />
            {profile.role ? <Row label="Role" value={String(profile.role)} /> : null}
          </Card>
        )}

        {profileError && <Text style={styles.error}>{profileError}</Text>}

        <View style={styles.actions}>
          {!rejected && (
            <PrimaryButton title="Check again" onPress={handleRefresh} loading={checking} />
          )}
          <PrimaryButton title="Sign out" variant="secondary" onPress={signOut} />
        </View>
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={Typography.label}>{label}</Text>
      <Text style={[Typography.body, { textTransform: 'capitalize' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 420, alignItems: 'center', gap: Spacing.md },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: Radius.pill,
    backgroundColor: '#FEF6EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleError: { backgroundColor: '#FDECEC' },
  center: { textAlign: 'center' },
  body: { paddingHorizontal: Spacing.md },
  infoCard: { width: '100%', gap: Spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  error: { ...Typography.bodySecondary, color: Colors.error, textAlign: 'center' },
  actions: { width: '100%', gap: Spacing.sm, marginTop: Spacing.sm },
});
