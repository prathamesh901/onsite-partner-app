import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Radius, Shadow, Spacing, Typography } from '../constants/theme';
import { AlertStatus } from '../lib/alertFilters';
import { KioskAlertSummary } from '../lib/types';

interface Props {
  summary: KioskAlertSummary;
  /** Drives which count the badge emphasises, so cards track the filter bar. */
  status: AlertStatus;
  onPress: (summary: KioskAlertSummary) => void;
}

/**
 * Level-1 overview card: one per kiosk the user can access. Always shows the
 * active/total breakdown; the badge reflects the currently selected status so
 * the cards visibly respond to the shared filter bar.
 */
export function AlertKioskCard({ summary, status, onPress }: Props) {
  const { active_count, total_count } = summary;
  const resolvedCount = Math.max(0, total_count - active_count);

  const badgeValue =
    status === 'resolved' ? resolvedCount : status === 'all' ? total_count : active_count;
  // Active alerts are the urgent case — red. Resolved/all are neutral.
  const urgent = status === 'active' && active_count > 0;
  const badgeColor = urgent ? Colors.error : badgeValue > 0 ? Colors.accent : Colors.textMuted;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(summary)}
      activeOpacity={0.85}
    >
      <View style={styles.body}>
        <Text style={[Typography.h3, styles.name]} numberOfLines={1}>
          {summary.kiosk_name ?? summary.kiosk_id}
        </Text>
        {summary.location ? (
          <Text style={Typography.bodySecondary} numberOfLines={1}>
            {summary.location}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <View style={[styles.dot, { backgroundColor: active_count > 0 ? Colors.error : Colors.online }]} />
          <Text style={styles.metaText}>
            {active_count} active · {total_count} total
          </Text>
        </View>
      </View>

      <View style={[styles.badge, { backgroundColor: badgeColor }]}>
        <Text style={styles.badgeText}>{badgeValue}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    padding: Spacing.md,
    ...Shadow.card,
  },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  metaText: { ...Typography.caption },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  badgeText: { fontSize: 14, fontWeight: '700', color: Colors.white },
});
