import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Shadow, Spacing, Typography } from '../constants/theme';
import { api } from '../lib/api';
import { PrimaryButton } from './PrimaryButton';

export interface InviteKioskOption {
  kiosk_id: string;
  kiosk_name?: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  visible: boolean;
  /** Kiosks the caller may invite to (admin = all; franchise = their own). */
  kiosks: InviteKioskOption[];
  /** Optional kiosk to preselect (e.g. opened from a specific kiosk). */
  presetKioskId?: string | null;
  onClose: () => void;
  /** Called after the invite is created so the parent can refresh its list. */
  onCreated?: () => void;
}

/**
 * Invite an onsite partner by email to a kiosk → POST /api/invites.
 * The backend emails the invite link (token) directly; the token never comes back
 * in the response. The success screen reflects whether the email actually sent:
 *   email_sent    → "Invite sent to <email>"
 *   email_error   → created, but delivery failed (offer a retry)
 *   email_stubbed → email isn't configured on the server (local dev / no key)
 */
export function InviteModal({ visible, kiosks, presetKioskId, onClose, onCreated }: Props) {
  const [email, setEmail] = useState('');
  const [kioskId, setKioskId] = useState<string | null>(presetKioskId ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    { email: string; sent: boolean; stubbed: boolean; error: string | null } | null
  >(null);

  // Reset each time the modal opens.
  useEffect(() => {
    if (visible) {
      setEmail('');
      setKioskId(presetKioskId ?? (kiosks.length === 1 ? kiosks[0].kiosk_id : null));
      setSubmitting(false);
      setError(null);
      setResult(null);
    }
  }, [visible, presetKioskId, kiosks]);

  const emailValid = EMAIL_RE.test(email.trim());
  const canSubmit = emailValid && !!kioskId && !submitting;

  async function submit() {
    if (!kioskId || !emailValid) return;
    setSubmitting(true);
    setError(null);
    try {
      const res: any = await api.post('/api/invites', {
        email: email.trim().toLowerCase(),
        kiosk_id: kioskId,
      });
      setResult({
        email: email.trim().toLowerCase(),
        sent: res?.email_sent === true,
        stubbed: res?.email_stubbed === true,
        error: typeof res?.email_error === 'string' ? res.email_error : null,
      });
      onCreated?.();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create invite');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Invite onsite partner</Text>
          <View style={{ width: 26 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {result ? (
              // ─── Success state ──────────────────────────────────────────────
              <View>
                <View style={styles.successIcon}>
                  <Ionicons
                    name={result.sent ? 'checkmark-circle' : result.stubbed ? 'information-circle' : 'alert-circle'}
                    size={44}
                    color={result.sent ? Colors.online : result.stubbed ? Colors.warning : Colors.error}
                  />
                </View>
                <Text style={[Typography.h3, { textAlign: 'center', marginTop: Spacing.sm }]}>
                  {result.sent ? 'Invite sent' : result.stubbed ? 'Invite created' : 'Invite created — email not sent'}
                </Text>
                <Text style={[Typography.bodySecondary, { textAlign: 'center', marginTop: 4 }]}>
                  {result.sent
                    ? `We emailed ${result.email} an invite to join as an onsite partner.`
                    : `${result.email} is invited and the invite is saved.`}
                </Text>

                {/* Real send was attempted but failed — not silently swallowed. */}
                {!result.sent && !result.stubbed && (
                  <View style={styles.warnBox}>
                    <View style={styles.warnHeader}>
                      <Ionicons name="warning-outline" size={15} color={Colors.error} />
                      <Text style={styles.warnTitle}>Email failed to send</Text>
                    </View>
                    <Text style={Typography.caption}>
                      The invite was saved, so it isn't lost{result.error ? ` (${result.error})` : ''}. Tap
                      "Invite another" to retry sending — or they can sign up with this email and they'll be
                      linked automatically.
                    </Text>
                  </View>
                )}

                {/* No key configured server-side (local dev fallback). */}
                {result.stubbed && (
                  <View style={styles.noteBox}>
                    <View style={styles.noteHeader}>
                      <Ionicons name="information-circle-outline" size={15} color={Colors.warning} />
                      <Text style={styles.noteTitle}>Email not configured</Text>
                    </View>
                    <Text style={Typography.caption}>
                      Email delivery isn't set up on the server, so no message was sent. The invite is saved
                      and will link automatically when they sign up with this email.
                    </Text>
                  </View>
                )}

                <View style={{ height: Spacing.lg }} />
                <PrimaryButton
                  title={!result.sent && !result.stubbed ? 'Retry / invite another' : 'Invite another'}
                  variant="secondary"
                  onPress={() => setResult(null)}
                />
                <View style={{ height: Spacing.sm }} />
                <PrimaryButton title="Done" onPress={onClose} />
              </View>
            ) : (
              // ─── Form state ─────────────────────────────────────────────────
              <View>
                <Text style={styles.label}>Kiosk</Text>
                {kiosks.length === 0 ? (
                  <View style={styles.empty}>
                    <Text style={Typography.bodySecondary}>No kiosks available to invite to.</Text>
                  </View>
                ) : (
                  <View style={{ gap: Spacing.sm }}>
                    {kiosks.map((k) => {
                      const active = kioskId === k.kiosk_id;
                      const locked = !!presetKioskId;
                      return (
                        <TouchableOpacity
                          key={k.kiosk_id}
                          style={[styles.kioskRow, active && styles.kioskRowActive]}
                          onPress={() => !locked && setKioskId(k.kiosk_id)}
                          activeOpacity={locked ? 1 : 0.8}
                          disabled={locked}
                        >
                          <Ionicons
                            name={active ? 'radio-button-on' : 'radio-button-off'}
                            size={20}
                            color={active ? Colors.accent : Colors.textMuted}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.kioskName} numberOfLines={1}>
                              {k.kiosk_name || k.kiosk_id}
                            </Text>
                            {k.kiosk_name ? (
                              <Text style={Typography.caption} numberOfLines={1}>{k.kiosk_id}</Text>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <Text style={[styles.label, { marginTop: Spacing.lg }]}>Partner email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  inputMode="email"
                />
                {email.length > 0 && !emailValid && (
                  <Text style={styles.hint}>Enter a valid email address.</Text>
                )}

                {error && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={16} color={Colors.error} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={{ height: Spacing.lg }} />
                <PrimaryButton
                  title="Send invite"
                  onPress={submit}
                  loading={submitting}
                  disabled={!canSubmit}
                />
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card,
  },
  headerTitle: { ...Typography.h3, fontSize: 16 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xl },

  label: {
    fontSize: 13, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm,
  },
  empty: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md, ...Shadow.card },

  kioskRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  kioskRowActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '12' },
  kioskName: { ...Typography.body, fontWeight: '600' },

  input: {
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 14, fontSize: 15, color: Colors.textPrimary,
  },
  hint: { ...Typography.caption, color: Colors.error, marginTop: 6 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md,
    backgroundColor: Colors.error + '12', borderRadius: Radius.md, padding: Spacing.sm,
  },
  errorText: { ...Typography.caption, color: Colors.error, flex: 1 },

  successIcon: { alignItems: 'center', marginTop: Spacing.md },

  // Email send failed (key configured but provider/network errored).
  warnBox: {
    marginTop: Spacing.lg, backgroundColor: Colors.error + '10', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.error + '33', padding: Spacing.md, gap: 6,
  },
  warnHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  warnTitle: { fontSize: 12, fontWeight: '800', color: Colors.error, letterSpacing: 0.4 },

  // Email not configured server-side (local dev / no key).
  noteBox: {
    marginTop: Spacing.lg, backgroundColor: Colors.warning + '12', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.warning + '40', padding: Spacing.md, gap: 6,
  },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteTitle: { fontSize: 12, fontWeight: '800', color: Colors.warning, letterSpacing: 0.4 },
});
