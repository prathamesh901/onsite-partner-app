import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Badge, Card, PrimaryButton, Screen } from '../../../components';
import { Colors, Radius, Spacing, Typography } from '../../../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import { registerForPushNotificationsAsync, sendTokenToBackend } from '../../../lib/notifications';

export default function ProfileScreen() {
  const { profile, session, signOut, refreshProfile } = useAuth();

  const email = profile?.email ?? session?.user?.email ?? '—';
  const name = String(profile?.name ?? 'Onsite Partner');
  const phone = String((profile?.phone as string | undefined) ?? '');
  const role = String(profile?.role ?? 'partner');
  const status = String(profile?.status ?? 'approved');

  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  // Notification toggle state.
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifPermission, setNotifPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  const mounted = useRef(true);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      mounted.current = false;
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  // Read current permission status.
  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      if (mounted.current) setNotifPermission(status as any);
    });
  }, []);

  async function handleNotifToggle(value: boolean) {
    setNotifEnabled(value);
    if (value) {
      const token = await registerForPushNotificationsAsync();
      if (token) await sendTokenToBackend(token);
      const { status } = await Notifications.getPermissionsAsync();
      if (mounted.current) setNotifPermission(status as any);
    }
    // When toggled off we just stop sending; no way to revoke permission in-app.
  }

  function startEdit() {
    // Prefill from the actual stored values (blank if unset) — not the
    // friendly "Onsite Partner" display fallback.
    setNameInput(String(profile?.name ?? ''));
    setPhoneInput(phone);
    setFormError(null);
    setJustSaved(false);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setFormError(null);
  }

  async function save() {
    const trimmedName = nameInput.trim();
    const trimmedPhone = phoneInput.trim();
    if (!trimmedName) {
      setFormError('Display name is required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      // /api/auth/register completes/updates the authenticated user's profile.
      await api.post('/api/auth/register', {
        name: trimmedName,
        phone: trimmedPhone,
        email: profile?.email ?? session?.user?.email,
      });
      await refreshProfile();
      if (!mounted.current) return;
      setEditing(false);
      setJustSaved(true);
      savedTimer.current = setTimeout(() => {
        if (mounted.current) setJustSaved(false);
      }, 2500);
    } catch (e: any) {
      if (mounted.current) setFormError(e?.message ?? 'Could not save. Please try again.');
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <Screen>
      <Text style={[Typography.h1, styles.header]}>Profile</Text>

      {justSaved && (
        <View style={styles.savedBanner}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.online} />
          <Text style={styles.savedText}>Profile updated</Text>
        </View>
      )}

      <Card style={styles.identity}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color={Colors.white} />
        </View>

        {editing ? (
          <>
            <Text style={Typography.bodySecondary}>{email}</Text>
            <Text style={styles.emailNote}>Email can't be changed</Text>

            <View style={styles.form}>
              <Text style={styles.formLabel}>Display name</Text>
              <TextInput
                style={styles.input}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Your name"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
                returnKeyType="next"
                maxLength={80}
              />

              <Text style={styles.formLabel}>Phone</Text>
              <TextInput
                style={styles.input}
                value={phoneInput}
                onChangeText={(t) => setPhoneInput(t.replace(/[^0-9+\-\s]/g, ''))}
                placeholder="Phone number"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                maxLength={20}
              />

              {formError && <Text style={styles.errorText}>{formError}</Text>}

              <View style={styles.formActions}>
                <PrimaryButton
                  title="Cancel"
                  variant="secondary"
                  onPress={cancelEdit}
                  disabled={saving}
                  style={styles.flex1}
                />
                <PrimaryButton
                  title="Save"
                  onPress={save}
                  loading={saving}
                  style={styles.flex1}
                />
              </View>
            </View>
          </>
        ) : (
          <>
            <Text style={Typography.h3}>{name}</Text>
            <Text style={Typography.bodySecondary}>{email}</Text>
            {phone ? <Text style={styles.phoneText}>{phone}</Text> : null}
            <View style={styles.badges}>
              <Badge label={role} selected color={Colors.accent} />
              <Badge label={status} selected color={Colors.online} />
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={startEdit} activeOpacity={0.8}>
              <Ionicons name="create-outline" size={16} color={Colors.accentDark} />
              <Text style={styles.editBtnText}>Edit profile</Text>
            </TouchableOpacity>
          </>
        )}
      </Card>

      <Card style={styles.list}>
        <Row icon="server-outline" label="Backend" value="Connected" valueColor={Colors.online} />
        <Row icon="key-outline" label="Auth" value="Supabase OTP" />
        <Row icon="information-circle-outline" label="App version" value="1.0.0" />
        <Row
          icon="notifications-outline"
          label="Notifications"
          value={notifPermission === 'granted' ? (notifEnabled ? 'Enabled' : 'Disabled') : 'Permission denied'}
          valueColor={notifPermission === 'granted' && notifEnabled ? Colors.online : Colors.textMuted}
        />
        <View style={styles.notifToggleRow}>
          <Ionicons name="notifications" size={18} color={Colors.accent} style={styles.notifIcon} />
          <Text style={[Typography.body, { flex: 1 }]}>Push notifications</Text>
          <Switch
            value={notifEnabled && notifPermission === 'granted'}
            onValueChange={handleNotifToggle}
            trackColor={{ false: Colors.border, true: Colors.accent }}
            thumbColor={Colors.white}
          />
        </View>
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
  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: Colors.online + '18',
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: Spacing.md,
  },
  savedText: { fontSize: 13, fontWeight: '700' as const, color: Colors.online },
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
  phoneText: { ...Typography.caption, marginTop: 1 },
  badges: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  editBtnText: { fontSize: 14, fontWeight: '700' as const, color: Colors.accentDark },

  // edit form
  emailNote: { ...Typography.caption, marginTop: -2 },
  form: { width: '100%', marginTop: Spacing.md, gap: 4 },
  formLabel: {
    alignSelf: 'flex-start',
    ...Typography.label,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  errorText: { ...Typography.caption, color: Colors.error, marginTop: Spacing.xs, alignSelf: 'flex-start' },
  formActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md, width: '100%' },
  flex1: { flex: 1 },

  list: { gap: Spacing.md, marginBottom: Spacing.lg },
  notifToggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  notifIcon: { width: 34, textAlign: 'center' },
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
