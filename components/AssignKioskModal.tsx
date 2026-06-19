import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
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
import { AdminKiosk, Ownership } from '../lib/types';
import { PrimaryButton } from './PrimaryButton';

export interface FranchiseOption {
  id: string;
  name: string;
  email: string;
}

interface Props {
  /** The kiosk being assigned/edited. null = hidden. */
  kiosk: AdminKiosk | null;
  /** Approved franchise_partner users to choose from. */
  franchisePartners: FranchiseOption[];
  onClose: () => void;
  /** Called after a successful save so the parent can refresh. */
  onAssigned: () => void;
}

/**
 * Assign / edit a kiosk: set its name + location (PATCH /api/admin/kiosks/[id])
 * and its ownership — PrintBuddy-owned or a specific franchise partner
 * (PATCH /api/admin/kiosks/[id]/ownership). Two endpoints, one save.
 */
export function AssignKioskModal({ kiosk, franchisePartners, onClose, onAssigned }: Props) {
  const visible = kiosk !== null;
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [ownership, setOwnership] = useState<Exclude<Ownership, null>>('printbuddy');
  const [franchiseId, setFranchiseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill whenever a new kiosk is opened.
  useEffect(() => {
    if (kiosk) {
      setName(kiosk.kiosk_name ?? '');
      setLocation(kiosk.location ?? '');
      setOwnership(kiosk.ownership === 'franchise' ? 'franchise' : 'printbuddy');
      setFranchiseId(kiosk.franchise_partner_id ?? null);
      setSaving(false);
      setError(null);
    }
  }, [kiosk]);

  if (!kiosk) return null;

  const nameValid = name.trim().length > 0;
  const franchiseChosen = ownership !== 'franchise' || !!franchiseId;
  const canSave = nameValid && franchiseChosen && !saving;

  async function save() {
    if (!kiosk) return;
    if (!nameValid) { setError('Give the kiosk a name.'); return; }
    if (ownership === 'franchise' && !franchiseId) {
      setError('Pick a franchise partner.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // 1. Name / location (admin-managed; webhook no longer overwrites these).
      await api.patch(`/api/admin/kiosks/${kiosk.kiosk_id}`, {
        kiosk_name: name.trim(),
        location: location.trim(),
      });
      // 2. Ownership.
      await api.patch(`/api/admin/kiosks/${kiosk.kiosk_id}/ownership`, {
        ownership,
        ...(ownership === 'franchise' ? { franchise_partner_id: franchiseId } : {}),
      });
      onAssigned();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to assign kiosk');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{kiosk.ownership ? 'Edit kiosk' : 'Assign kiosk'}</Text>
          <View style={{ width: 26 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {/* Identity */}
            <View style={styles.idRow}>
              <Ionicons name="print" size={16} color={Colors.accent} />
              <Text style={styles.idText} numberOfLines={1}>{kiosk.kiosk_id}</Text>
            </View>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Andheri West Kiosk"
              placeholderTextColor={Colors.textMuted}
            />
            {name.length > 0 && !nameValid && <Text style={styles.hint}>Name can't be blank.</Text>}

            <Text style={[styles.label, { marginTop: Spacing.lg }]}>Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Mumbai, MH"
              placeholderTextColor={Colors.textMuted}
            />

            {/* Ownership */}
            <Text style={[styles.label, { marginTop: Spacing.lg }]}>Ownership</Text>
            <View style={{ gap: Spacing.sm }}>
              <TouchableOpacity
                style={[styles.optRow, ownership === 'printbuddy' && styles.optRowActive]}
                onPress={() => setOwnership('printbuddy')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={ownership === 'printbuddy' ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={ownership === 'printbuddy' ? Colors.accent : Colors.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optTitle}>PrintBuddy-owned</Text>
                  <Text style={Typography.caption}>Managed directly by PrintBuddy ops.</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optRow, ownership === 'franchise' && styles.optRowActive]}
                onPress={() => setOwnership('franchise')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={ownership === 'franchise' ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={ownership === 'franchise' ? Colors.accent : Colors.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optTitle}>Assign to franchise partner</Text>
                  <Text style={Typography.caption}>The partner manages this kiosk.</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Franchise partner picker */}
            {ownership === 'franchise' && (
              <View style={{ marginTop: Spacing.md }}>
                <Text style={styles.label}>Franchise partner</Text>
                {franchisePartners.length === 0 ? (
                  <View style={styles.empty}>
                    <Text style={Typography.bodySecondary}>
                      No approved franchise partners yet. Approve one in the Users list first.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: Spacing.sm }}>
                    {franchisePartners.map((p) => {
                      const active = franchiseId === p.id;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={[styles.optRow, active && styles.optRowActive]}
                          onPress={() => setFranchiseId(p.id)}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={active ? 'radio-button-on' : 'radio-button-off'}
                            size={20}
                            color={active ? Colors.accent : Colors.textMuted}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.optTitle} numberOfLines={1}>{p.name || p.email}</Text>
                            {p.email ? <Text style={Typography.caption} numberOfLines={1}>{p.email}</Text> : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={{ height: Spacing.lg }} />
            <PrimaryButton title="Save" onPress={save} loading={saving} disabled={!canSave} />
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

  idRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.lg,
    backgroundColor: Colors.pillBg, borderRadius: Radius.md, padding: Spacing.sm,
  },
  idText: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },

  label: {
    fontSize: 13, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 14, fontSize: 15, color: Colors.textPrimary,
  },
  hint: { ...Typography.caption, color: Colors.error, marginTop: 6 },

  optRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  optRowActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '12' },
  optTitle: { ...Typography.body, fontWeight: '600' },

  empty: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md, ...Shadow.card },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md,
    backgroundColor: Colors.error + '12', borderRadius: Radius.md, padding: Spacing.sm,
  },
  errorText: { ...Typography.caption, color: Colors.error, flex: 1 },
});
