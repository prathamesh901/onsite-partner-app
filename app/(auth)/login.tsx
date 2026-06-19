import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, PrimaryButton, Screen } from '../../components';
import { isConfigured } from '../../config/env';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen() {
  const { signIn, verifyOtp } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSendCode() {
    setError(null);
    setInfo(null);
    if (!email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      await signIn(email);
      setStep('code');
      setInfo(`We sent a 6-digit code to ${email.trim()}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send code.');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    setError(null);
    if (code.trim().length < 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    try {
      await verifyOtp(email, code);
      // On success the root navigator redirects automatically.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid or expired code.');
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
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Ionicons name="print" size={36} color={Colors.white} />
          </View>
          <Text style={styles.brand}>PB Partner</Text>
          <Text style={styles.tagline}>Partner Console</Text>
        </View>

        <Card style={styles.card}>
          {!isConfigured && (
            <View style={styles.configWarn}>
              <Ionicons name="warning-outline" size={16} color={Colors.warning} />
              <Text style={styles.configWarnText}>
                Supabase anon key not set. Paste it into `.env` and restart.
              </Text>
            </View>
          )}

          {step === 'email' ? (
            <>
              <Text style={Typography.h3}>Sign in</Text>
              <Text style={[Typography.bodySecondary, styles.sub]}>
                Enter your email and we'll send you a one-time code.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="you@company.com"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                editable={!busy}
              />
              <PrimaryButton title="Send code" onPress={handleSendCode} loading={busy} chevron />
            </>
          ) : (
            <>
              <Text style={Typography.h3}>Enter code</Text>
              {info && <Text style={[Typography.bodySecondary, styles.sub]}>{info}</Text>}
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="000000"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={setCode}
                editable={!busy}
              />
              <PrimaryButton title="Verify & continue" onPress={handleVerify} loading={busy} chevron />
              <PrimaryButton
                title="Use a different email"
                variant="secondary"
                onPress={() => {
                  setStep('email');
                  setCode('');
                  setError(null);
                  setInfo(null);
                }}
                style={{ marginTop: Spacing.sm }}
              />
            </>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 420 },
  logoWrap: { alignItems: 'center', marginBottom: Spacing.xl },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  brand: { ...Typography.h1, color: Colors.accent },
  tagline: { ...Typography.bodySecondary, marginTop: 2 },
  card: { gap: Spacing.md },
  sub: { marginTop: -Spacing.sm },
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
  codeInput: { textAlign: 'center', letterSpacing: 8, fontSize: 22, fontWeight: '700' },
  error: { ...Typography.bodySecondary, color: Colors.error, textAlign: 'center' },
  configWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF6EC',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  configWarnText: { ...Typography.caption, color: Colors.warning, flex: 1 },
});
