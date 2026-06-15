import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Radius, Shadow, Spacing, Typography } from '../constants/theme';
import {
  AlertFilters,
  AlertStatus,
  DATE_PRESETS,
  DatePreset,
  STATUS_OPTIONS,
  TYPE_GROUPS,
  dateRangeLabel,
} from '../lib/alertFilters';
import { DateRangePicker } from './DateRangePicker';

interface Props {
  filters: AlertFilters;
  onChange: (next: AlertFilters) => void;
}

/** Compact label for the type dropdown button. */
function typeButtonLabel(groups: string[]): string {
  const n = groups.length;
  if (n === 0 || n === TYPE_GROUPS.length) return 'All types';
  if (n <= 2) {
    return TYPE_GROUPS.filter((g) => groups.includes(g.key))
      .map((g) => g.label)
      .join(', ');
  }
  return `${n} types`;
}

/**
 * Shared filter bar for both Alerts levels: an Active/Resolved/All segment, then
 * a single row of two compact dropdowns — a single-select Date control and a
 * multi-select Type control. Both drive the existing backend query params
 * (date range + comma-separated alert_type list); only the UI changed.
 */
export function AlertFilterBar({ filters, onChange }: Props) {
  const [sheet, setSheet] = useState<null | 'date' | 'type'>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  function setStatus(status: AlertStatus) {
    if (status !== filters.status) onChange({ ...filters, status });
  }

  function selectPreset(key: DatePreset) {
    if (key === 'custom') {
      setSheet(null);
      setPickerOpen(true);
      return;
    }
    onChange({ ...filters, datePreset: key, from: null, to: null });
    setSheet(null);
  }

  function toggleGroup(key: string) {
    const groups = filters.groups.includes(key)
      ? filters.groups.filter((g) => g !== key)
      : [...filters.groups, key];
    onChange({ ...filters, groups });
  }

  const typesActive = filters.groups.length > 0;

  return (
    <View style={styles.container}>
      {/* Status segment (unchanged) */}
      <View style={styles.segment}>
        {STATUS_OPTIONS.map(({ key, label }) => {
          const active = key === filters.status;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
              onPress={() => setStatus(key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Two dropdowns in one row */}
      <View style={styles.dropdownRow}>
        <DropdownButton
          icon="calendar-outline"
          label={dateRangeLabel(filters)}
          onPress={() => setSheet('date')}
        />
        <DropdownButton
          icon="funnel-outline"
          label={typeButtonLabel(filters.groups)}
          active={typesActive}
          onPress={() => setSheet('type')}
        />
      </View>

      {/* Date sheet — single select */}
      <BottomSheet visible={sheet === 'date'} title="Date range" onClose={() => setSheet(null)}>
        {DATE_PRESETS.map(({ key, label }) => {
          const selected = filters.datePreset === key;
          const display = key === 'custom' && selected ? dateRangeLabel(filters) : label;
          return (
            <TouchableOpacity
              key={key}
              style={styles.optionRow}
              onPress={() => selectPreset(key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.optionLabel, selected && styles.optionLabelActive]}>
                {display}
              </Text>
              {key === 'custom' ? (
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              ) : selected ? (
                <Ionicons name="checkmark" size={20} color={Colors.accentDark} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </BottomSheet>

      {/* Type sheet — multi select */}
      <BottomSheet
        visible={sheet === 'type'}
        title="Alert types"
        onClose={() => setSheet(null)}
        footer={
          <View style={styles.sheetFooter}>
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => onChange({ ...filters, groups: [] })}
              disabled={!typesActive}
            >
              <Text style={[styles.clearText, !typesActive && { color: Colors.textMuted }]}>
                Clear
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.doneBtn} onPress={() => setSheet(null)}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        }
      >
        {TYPE_GROUPS.map(({ key, label }) => {
          const checked = filters.groups.includes(key);
          return (
            <TouchableOpacity
              key={key}
              style={styles.optionRow}
              onPress={() => toggleGroup(key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.optionLabel, checked && styles.optionLabelActive]}>{label}</Text>
              <Ionicons
                name={checked ? 'checkbox' : 'square-outline'}
                size={22}
                color={checked ? Colors.accent : Colors.textMuted}
              />
            </TouchableOpacity>
          );
        })}
      </BottomSheet>

      <DateRangePicker
        visible={pickerOpen}
        initialFrom={filters.from}
        initialTo={filters.to}
        onClose={() => setPickerOpen(false)}
        onApply={(from, to) => {
          setPickerOpen(false);
          onChange({ ...filters, datePreset: 'custom', from, to });
        }}
      />
    </View>
  );
}

// ─── dropdown button ─────────────────────────────────────────────────────────

function DropdownButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.dropdown, active && styles.dropdownActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons name={icon} size={15} color={active ? Colors.accentDark : Colors.textSecondary} />
      <Text style={[styles.dropdownText, active && styles.dropdownTextActive]} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-down" size={15} color={active ? Colors.accentDark : Colors.textMuted} />
    </TouchableOpacity>
  );
}

// ─── lightweight bottom sheet ────────────────────────────────────────────────

function BottomSheet({
  visible,
  title,
  onClose,
  footer,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          {children}
          {footer}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },

  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.pillBg,
    borderRadius: Radius.pill,
    padding: 4,
    gap: 4,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: Radius.pill, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: Colors.card, ...Shadow.card },
  segmentText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  segmentTextActive: { color: Colors.accentDark },

  dropdownRow: { flexDirection: 'row', gap: Spacing.sm },
  dropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  dropdownActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '12' },
  dropdownText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  dropdownTextActive: { color: Colors.accentDark },

  // Sheet
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  sheetTitle: {
    ...Typography.label,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionLabel: { ...Typography.body, color: Colors.textPrimary },
  optionLabelActive: { fontWeight: '700', color: Colors.accentDark },

  sheetFooter: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  clearBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  clearText: { ...Typography.body, fontWeight: '600', color: Colors.textSecondary },
  doneBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  doneText: { ...Typography.body, fontWeight: '700', color: Colors.white },
});
