import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '../constants/theme';

// A dependency-free month-grid range picker — pure RN core components so the
// Alerts feature stays JS-only (Metro reload, no native rebuild).

interface Props {
  visible: boolean;
  /** Initial selection as ISO strings (start-of-day / end-of-day). */
  initialFrom: string | null;
  initialTo: string | null;
  onClose: () => void;
  /** Returns ISO bounds: from = 00:00:00.000, to = 23:59:59.999. */
  onApply: (from: string, to: string) => void;
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function sameDay(a: Date, b: Date): boolean {
  return ymd(a) === ymd(b);
}
function atStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function atEnd(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function DateRangePicker({ visible, initialFrom, initialTo, onClose, onApply }: Props) {
  const initStart = initialFrom ? new Date(initialFrom) : null;
  const initEnd = initialTo ? new Date(initialTo) : null;

  const [start, setStart] = useState<Date | null>(initStart);
  const [end, setEnd] = useState<Date | null>(initEnd);
  // The month currently shown in the grid.
  const [cursor, setCursor] = useState<Date>(() => initStart ?? new Date());

  const days = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const today = atStart(new Date());

  function pickDay(d: Date) {
    // First tap (or restart) sets the start; second tap sets the end.
    if (!start || (start && end)) {
      setStart(d);
      setEnd(null);
      return;
    }
    if (d < start) {
      // Tapped before the start — treat as a new start.
      setStart(d);
      setEnd(null);
    } else {
      setEnd(d);
    }
  }

  function inRange(d: Date): boolean {
    if (!start || !end) return false;
    return d > start && d < end;
  }

  function apply() {
    if (!start) return;
    const s = atStart(start);
    const e = atEnd(end ?? start); // single-day range when no end picked
    onApply(s.toISOString(), e.toISOString());
  }

  const rangeLabel =
    start && end
      ? `${fmt(start)} – ${fmt(end)}`
      : start
        ? `${fmt(start)} – …`
        : 'Tap a start date';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={[Typography.h3, styles.title]}>Custom range</Text>
          <Text style={styles.rangeLabel}>{rangeLabel}</Text>

          {/* Month navigation */}
          <View style={styles.monthRow}>
            <TouchableOpacity
              onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </Text>
            <TouchableOpacity
              onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              hitSlop={8}
            >
              <Ionicons name="chevron-forward" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Weekday header */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={styles.weekday}>{w}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.grid}>
            {days.map((d, i) => {
              if (!d) return <View key={i} style={styles.cell} />;
              const isStart = start && sameDay(d, start);
              const isEnd = end && sameDay(d, end);
              const selected = isStart || isEnd;
              const between = inRange(d);
              const future = atStart(d) > today;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.cell, between && styles.cellBetween]}
                  onPress={() => !future && pickDay(d)}
                  disabled={future}
                  activeOpacity={0.7}
                >
                  <View style={[styles.dayWrap, selected && styles.daySelected]}>
                    <Text
                      style={[
                        styles.dayText,
                        future && styles.dayDisabled,
                        selected && styles.daySelectedText,
                      ]}
                    >
                      {d.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyBtn, !start && { opacity: 0.5 }]}
              onPress={apply}
              disabled={!start}
            >
              <Text style={styles.applyText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function fmt(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Build a 6-week grid (nulls for leading/trailing blanks), Monday-first. */
function buildMonthGrid(cursor: Date): (Date | null)[] {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    paddingBottom: 36,
    gap: Spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  title: { textAlign: 'center' },
  rangeLabel: { ...Typography.bodySecondary, textAlign: 'center', color: Colors.accentDark, fontWeight: '600' },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.sm,
  },
  monthLabel: { ...Typography.body, fontWeight: '700' },
  weekRow: { flexDirection: 'row', marginTop: Spacing.sm },
  weekday: { flex: 1, textAlign: 'center', ...Typography.caption, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellBetween: { backgroundColor: Colors.accent + '22' },
  dayWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: Colors.accent },
  dayText: { ...Typography.body },
  daySelectedText: { color: Colors.white, fontWeight: '700' },
  dayDisabled: { color: Colors.border },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelText: { ...Typography.body, fontWeight: '600', color: Colors.textSecondary },
  applyBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  applyText: { ...Typography.body, fontWeight: '700', color: Colors.white },
});
