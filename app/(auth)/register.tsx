import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, PrimaryButton, Screen } from '../../components';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

// Registration form for an authenticated user who has no profile row yet.
// Collects name (+ optional phone) ONLY — role is decided by an admin at
// approval, never self-selected. Submitting creates a pending request that
// shows up in the admin console.
export default function RegisterScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = profile?.email ?? session?.user?.email ?? '';

  async function submit() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter your name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // No role sent — the backend records a pending placeholder and an admin
      // assigns the real role at approval. refreshProfile then re-reads
      // /api/auth/me (now registered + pending) so routing moves to the
      // pending screen automatically.
      await api.post('/api/auth/register', { name: trimmedName, phone: phone.trim() });
      await refreshProfile();
    } catch (e: any) {
      setError(e?.message ?? 'Could not submit your request. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen center>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.wrap}
      >
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="person-add-outline" size={36} color={Colors.accent} />
          </View>
          <Text style={[Typography.h2, styles.center]}>Complete your profile</Text>
          <Text style={[Typography.bodySecondary, styles.center, styles.sub]}>
            Tell us who you are. An administrator will review your request and grant access.
          </Text>
        </View>

        <Card style={styles.card}>
          {email ? (
            <View style={styles.emailRow}>
              <Text style={Typography.label}>Email</Text>
              <Text style={Typography.body} numberOfLines={1}>{email}</Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={Typography.label}>Full name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
              value={name}
              onChangeText={setName}
              editable={!busy}
            />
          </View>

          <View style={styles.field}>
            <Text style={Typography.label}>Phone (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Phone number"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              editable={!busy}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <PrimaryButton title="Submit request" onPress={submit} loading={busy} chevron />
          <PrimaryButton
            title="Sign out"
            variant="secondary"
            onPress={signOut}
            style={{ marginTop: Spacing.sm }}
          />
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 420 },
  header: { alignItems: 'center', marginBottom: Spacing.xl, gap: Spacing.sm },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: Radius.pill,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  center: { textAlign: 'center' },
  sub: { paddingHorizontal: Spacing.md },
  card: { gap: Spacing.md },
  emailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  field: { gap: Spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  error: { ...Typography.bodySecondary, color: Colors.error, textAlign: 'center' },
});
