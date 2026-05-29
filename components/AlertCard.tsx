import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Shadow } from '../constants/theme';
import { Alert, AlertSeverity } from '../lib/types';
import { TimeAgo } from './TimeAgo';

const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  critical: Colors.alertCritical,
  warning: Colors.alertWarning,
  info: Colors.alertInfo,
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
  const color = SEVERITY_COLOR[alert.severity] ?? Colors.alertInfo;
  const icon = TYPE_ICON[alert.type] ?? '⚠️';

  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <View style={styles.top}>
        <Text style={styles.icon}>{icon}</Text>
        <View style={{ flex: 1 }}>
          {alert.kiosk_name && <Text style={styles.kioskName}>{alert.kiosk_name}</Text>}
          <Text style={styles.message}>{alert.message}</Text>
        </View>
        <View style={[styles.severityPill, { backgroundColor: color + '22' }]}>
          <Text style={[styles.severityText, { color }]}>
            {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
          </Text>
        </View>
      </View>
      <View style={styles.bottom}>
        <TimeAgo iso={alert.created_at} prefix="" />
        {alert.status === 'active' && onResolve && (
          <TouchableOpacity
            style={styles.resolveBtn}
            onPress={() => onResolve(alert.id)}
            disabled={resolving}
          >
            {resolving ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Text style={styles.resolveText}>Resolve</Text>
            )}
          </TouchableOpacity>
        )}
        {alert.status === 'resolved' && (
          <View style={styles.resolvedPill}>
            <Text style={styles.resolvedText}>Resolved</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 10,
    ...Shadow.card,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  icon: { fontSize: 20 },
  kioskName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  message: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  severityPill: { borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  severityText: { fontSize: 11, fontWeight: '700' },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resolveBtn: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 5,
    minWidth: 70,
    alignItems: 'center',
  },
  resolveText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  resolvedPill: { backgroundColor: Colors.zoneGood + '22', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  resolvedText: { color: Colors.zoneGood, fontSize: 12, fontWeight: '600' },
});
