import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radius, Shadow } from '../../constants/theme';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.avatarWrap}>
          <Ionicons name="person-circle" size={80} color={Colors.primary} />
        </View>
        <Text style={styles.name}>Onsite Partner</Text>
        <Text style={styles.role}>PrintBuddy Partner App</Text>
        <View style={styles.card}>
          <Row icon="print-outline" label="App Version" value="1.0.0" />
          <Row icon="server-outline" label="API" value="Connected" />
          <Row icon="shield-checkmark-outline" label="Auth" value="Coming soon" muted />
          <Row icon="notifications-outline" label="Notifications" value="Coming soon" muted />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Row({ icon, label, value, muted }: { icon: string; label: string; value: string; muted?: boolean }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon as any} size={18} color={muted ? Colors.textMuted : Colors.primary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, muted && { color: Colors.textMuted }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, marginBottom: 24 },
  avatarWrap: { alignItems: 'center', marginBottom: 12 },
  name: { textAlign: 'center', fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  role: { textAlign: 'center', fontSize: 14, color: Colors.textSecondary, marginBottom: 24 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.card, padding: 4, ...Shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowLabel: { flex: 1, fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  rowValue: { fontSize: 13, color: Colors.textSecondary },
});
