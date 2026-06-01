import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Shadow, Spacing, Typography } from '../constants/theme';
import { Alert, AlertSeverity } from '../lib/types';
import { timeAgoStr } from './TimeAgo';

const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  critical: Colors.error,
  warning: Colors.tertiaryContainer,
  info: Colors.primaryContainer,
};

const SEVERITY_ICON_BG: Record<AlertSeverity, string> = {
  critical: Colors.errorContainer,
  warning: Colors.tertiaryFixed,
  info: Colors.primaryFixed,
};

const TYPE_ICON: Record<string, string> = {
  door: '🚪',
  ink: '🖨️',
  paper: '📄',
  jam: '⚠️',
  cartridge: '🖨️',
  tray: '📋',
};

interface Props {
  alert: Alert;
  onResolve?: (id: string) => void;
  resolving?: boolean;
}

export function AlertCard({ alert, onResolve, resolving }: Props) {
  const stripeColor = SEVERITY_COLOR[alert.severity] ?? Colors.primaryContainer;
  const iconBg = SEVERITY_ICON_BG[alert.severity] ?? Colors.primaryFixed;
  const icon = TYPE_ICON[alert.type] ?? '⚠️';
  const isCritical = alert.severity === 'critical';

  return (
    <View style={[styles.card, { borderLeftColor: stripeColor }]}>
      <View style={styles.top}>
        <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          {alert.kiosk_name && (
            <Text style={[Typography.headlineSm, { color: Colors.onSurface }]}>{alert.kiosk_name}</Text>
          )}
          <View style={[styles.descBox, { borderLeftColor: stripeColor }]}>
            <Text style={[Typography.bodyMd, { color: Colors.onSurface, fontWeight: '600' }]}>
              {alert.message}
            </Text>
          </View>
        </View>
        <View style={[styles.severityBadge, { backgroundColor: stripeColor }]}>
          <Text style={[Typography.labelSm, { color: isCritical ? Colors.onError : Colors.onTertiaryContainer }]}>
            {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <Text style={[Typography.labelSm, { color: Colors.onSurfaceVariant }]}>
          {timeAgoStr(alert.created_at)}
        </Text>
        {alert.status === 'active' && onResolve && (
          <TouchableOpacity
            style={styles.resolveBtn}
            onPress={() => onResolve(alert.id)}
            disabled={resolving}
          >
            {resolving ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Text style={[Typography.labelMd, { color: Colors.primary }]}>Resolve →</Text>
            )}
          </TouchableOpacity>
        )}
        {alert.status === 'resolved' && (
          <View style={styles.resolvedPill}>
            <Text style={[Typography.labelSm, { color: Colors.online }]}>✓ Resolved</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.card,
    borderLeftWidth: 4,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
    ...Shadow.card,
  },
  top: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 20 },
  descBox: {
    backgroundColor: Colors.surfaceContainerLow,
    borderLeftWidth: 4,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    paddingLeft: Spacing.sm,
  },
  severityBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resolveBtn: {
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: Radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  resolvedPill: {
    backgroundColor: Colors.zoneGoodBg,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
});
