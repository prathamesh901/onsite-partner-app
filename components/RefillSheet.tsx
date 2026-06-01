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
import { Colors, Radius, Shadow, Spacing, Typography } from '../constants/theme';
import { api } from '../lib/api';
import { PaperLevel } from '../lib/types';

const PRESETS: Record<string, { label: string; sub: string; sheets: number }[]> = {
  tray_2: [
    { label: 'Quarter', sub: '60 sheets', sheets: 60 },
    { label: 'Half', sub: '125 sheets', sheets: 125 },
    { label: '¾ Full', sub: '185 sheets', sheets: 185 },
    { label: 'Full', sub: '250 sheets', sheets: 250 },
  ],
  tray_3: [
    { label: 'Quarter', sub: '135 sheets', sheets: 135 },
    { label: 'Half', sub: '275 sheets', sheets: 275 },
    { label: '¾ Full', sub: '410 sheets', sheets: 410 },
    { label: 'Full', sub: '550 sheets', sheets: 550 },
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
      setError(e instanceof Error ? e.message : 'Refill failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setSelected(null);
    setCustom('');
    setError('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[Typography.headlineMd, { color: Colors.onSurface }]}>
                Refill {tray.tray_name}
              </Text>
              <Text style={[Typography.bodyMd, { color: Colors.onSurfaceVariant, marginTop: 4 }]}>
                How much paper did you add?
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Text style={[Typography.headlineSm, { color: Colors.onSurfaceVariant }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 2×2 preset grid */}
          <View style={styles.presetGrid}>
            {presets.map((p) => {
              const isSelected = selected === p.sheets && !custom;
              return (
                <TouchableOpacity
                  key={p.sheets}
                  style={[styles.presetPill, isSelected && styles.presetSelected]}
                  onPress={() => { setSelected(p.sheets); setCustom(''); }}
                  activeOpacity={0.85}
                >
                  <Text style={[Typography.headlineSm, { color: isSelected ? Colors.primary : Colors.onSurface }]}>
                    {p.label}
                  </Text>
                  <Text style={[Typography.bodySm, { color: isSelected ? Colors.onPrimaryContainer : Colors.onSurfaceVariant, marginTop: 4 }]}>
                    {p.sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom input */}
          <View style={styles.customSection}>
            <Text style={[Typography.bodySm, { color: Colors.onSurfaceVariant, marginBottom: 8 }]}>
              Or enter exact amount
            </Text>
            <TextInput
              style={[styles.input, custom ? styles.inputActive : {}]}
              placeholder="e.g. 150"
              keyboardType="number-pad"
              value={custom}
              onChangeText={(t) => { setCustom(t); setSelected(null); }}
              placeholderTextColor={Colors.outline}
            />
          </View>

          {!!error && (
            <Text style={[Typography.bodySm, { color: Colors.error, marginBottom: 8 }]}>{error}</Text>
          )}

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
              <Text style={[Typography.labelMd, { color: Colors.onSurface }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (!sheets) && styles.confirmDisabled]}
              onPress={confirm}
              disabled={loading || !sheets}
            >
              {loading ? (
                <ActivityIndicator color={Colors.onPrimaryContainer} />
              ) : (
                <Text style={[Typography.labelMd, { color: Colors.onPrimaryContainer }]}>
                  Confirm Refill
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(23,28,31,0.4)' },
  container: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
    paddingHorizontal: Spacing.gutter,
    paddingBottom: 40,
    ...Shadow.modal,
  },
  handleWrap: { alignItems: 'center', paddingVertical: Spacing.sm },
  handle: { width: 40, height: 6, borderRadius: Radius.pill, backgroundColor: Colors.outlineVariant },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.md },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  presetPill: {
    width: '46%',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.md,
    alignItems: 'center',
  },
  presetSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFixed + '20',
  },
  customSection: { marginBottom: Spacing.md },
  input: {
    height: 56,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: Spacing.md,
    ...Typography.bodyLg,
    color: Colors.onSurface,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  inputActive: {
    borderColor: Colors.primaryContainer,
  },
  actions: { flexDirection: 'row', gap: Spacing.md },
  cancelBtn: {
    flex: 1,
    height: 56,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtn: {
    flex: 2,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  confirmDisabled: { opacity: 0.5 },
});
