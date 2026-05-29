import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Colors, Radius } from '../constants/theme';
import { api } from '../lib/api';
import { PaperLevel } from '../lib/types';

const PRESETS: Record<string, { label: string; sheets: number }[]> = {
  tray_2: [
    { label: 'Quarter', sheets: 60 },
    { label: 'Half', sheets: 125 },
    { label: '¾ Full', sheets: 185 },
    { label: 'Full', sheets: 250 },
  ],
  tray_3: [
    { label: 'Quarter', sheets: 135 },
    { label: 'Half', sheets: 275 },
    { label: '¾ Full', sheets: 410 },
    { label: 'Full', sheets: 550 },
  ],
};

function getPresets(trayId: string) {
  return PRESETS[trayId] ?? PRESETS.tray_2;
}

interface Props {
  visible: boolean;
  tray: PaperLevel;
  kioskId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RefillSheet({ visible, tray, kioskId, onClose, onSuccess }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const presets = getPresets(tray.tray_id);
  const sheets = custom ? parseInt(custom, 10) : selected;

  async function confirm() {
    if (!sheets || isNaN(sheets) || sheets <= 0) {
      setError('Please select or enter a valid amount.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.refill(kioskId, tray.tray_id, sheets);
      onSuccess();
      onClose();
      setSelected(null);
      setCustom('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refill failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Refill {tray.tray_name}</Text>
          <Text style={styles.subtitle}>How much paper did you add?</Text>
          <View style={styles.presetGrid}>
            {presets.map((p) => {
              const isSelected = selected === p.sheets && !custom;
              return (
                <TouchableOpacity
                  key={p.sheets}
                  style={[styles.presetPill, isSelected && styles.presetSelected]}
                  onPress={() => { setSelected(p.sheets); setCustom(''); }}
                >
                  <Text style={[styles.presetLabel, isSelected && styles.presetLabelSelected]}>{p.label}</Text>
                  <Text style={[styles.presetSheets, isSelected && styles.presetSheetsSelected]}>{p.sheets} sheets</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.orText}>Or enter exact amount</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 150"
            keyboardType="number-pad"
            value={custom}
            onChangeText={(t) => { setCustom(t); setSelected(null); }}
            placeholderTextColor={Colors.textMuted}
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={confirm} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.confirmText}>Confirm Refill</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  container: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#F8FBFE',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  presetPill: {
    width: '47%',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: '#FFF',
    padding: 14,
    alignItems: 'center',
  },
  presetSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '12' },
  presetLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  presetLabelSelected: { color: Colors.primary },
  presetSheets: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  presetSheetsSelected: { color: Colors.primary },
  orText: { fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.textPrimary,
    backgroundColor: '#FFF',
    marginBottom: 20,
  },
  error: { color: Colors.alertCritical, fontSize: 13, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.pillUnselectedBg,
  },
  cancelText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  confirmBtn: {
    flex: 2,
    borderRadius: Radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  confirmText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
