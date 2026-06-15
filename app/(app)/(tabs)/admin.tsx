import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Shadow, Spacing, Typography } from '../../../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import { Kiosk } from '../../../lib/types';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  phone?: string;
}

const ROLE_OPTIONS: { key: string; label: string }[] = [
  { key: 'onsite_partner', label: 'Onsite Partner' },
  { key: 'franchise_partner', label: 'Franchise Partner' },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

function titleCase(s: string): string {
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    admin: 'Admin',
    onsite_partner: 'Onsite Partner',
    franchise_partner: 'Franchise Partner',
    partner: 'Partner',
    staff: 'Staff',
  };
  return map[role] ?? titleCase(role || 'partner');
}

function statusColor(status: string): string {
  switch ((status || '').toLowerCase()) {
    case 'approved': return Colors.online;
    case 'pending': return Colors.warning;
    case 'rejected':
    case 'suspended': return Colors.error;
    default: return Colors.textMuted;
  }
}

function normalizeUsers(raw: unknown): AdminUser[] {
  let arr: any[] = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const key of ['users', 'data', 'results', 'profiles']) {
      if (Array.isArray(obj[key])) { arr = obj[key] as any[]; break; }
    }
  }
  return arr
    .map((u) => ({
      id: String(u.id ?? u.user_id ?? u.uuid ?? ''),
      name: String(u.name ?? u.full_name ?? u.display_name ?? '(no name)'),
      email: String(u.email ?? ''),
      role: String(u.role ?? 'partner'),
      status: String(u.status ?? 'pending'),
      phone: u.phone ? String(u.phone) : undefined,
    }))
    .filter((u) => u.id);
}

function normalizeAssignments(raw: unknown): string[] {
  let arr: any[] = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const key of ['assignments', 'kiosk_ids', 'kiosks', 'assigned', 'data', 'results']) {
      if (Array.isArray(obj[key])) { arr = obj[key] as any[]; break; }
    }
  }
  return arr
    .map((a) => (typeof a === 'string' ? a : (a?.kiosk_id ?? a?.id ?? a?.kioskId ?? '')))
    .map((s) => String(s))
    .filter(Boolean);
}

function unwrapKiosks(raw: unknown): Kiosk[] {
  if (Array.isArray(raw)) return raw as Kiosk[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const key of ['kiosks', 'data', 'results']) {
      if (Array.isArray(obj[key])) return obj[key] as Kiosk[];
    }
  }
  return [];
}

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const color = statusColor(status);
  return (
    <View style={[styles.badge, { backgroundColor: color + '18' }]}>
      <Text style={[styles.badgeText, { color }]}>{titleCase(status)}</Text>
    </View>
  );
}

// ─── Pending user card ───────────────────────────────────────────────────────

function PendingUserCard({
  user, busy, onApprove, onReject,
}: {
  user: AdminUser;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <View style={styles.pendingCard}>
      <View style={styles.pendingTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user.name[0] ?? '?').toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
          <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
          {user.phone ? <Text style={styles.userPhone}>{user.phone}</Text> : null}
        </View>
      </View>
      <View style={styles.pendingActions}>
        <TouchableOpacity
          style={[styles.rejectBtn, busy && styles.disabled]}
          onPress={onReject}
          disabled={busy}
        >
          <Ionicons name="close" size={16} color={Colors.error} />
          <Text style={styles.rejectText}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.approveBtn, busy && styles.disabled]}
          onPress={onApprove}
          disabled={busy}
        >
          {busy
            ? <ActivityIndicator size="small" color={Colors.white} />
            : (<><Ionicons name="checkmark" size={16} color={Colors.white} /><Text style={styles.approveText}>Approve</Text></>)}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── User row ────────────────────────────────────────────────────────────────

function UserRow({ user, onPress }: { user: AdminUser; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.userRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatarSm}>
        <Text style={styles.avatarSmText}>{(user.name[0] ?? '?').toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
        <Text style={styles.userRole}>{roleLabel(user.role)}</Text>
      </View>
      <StatusBadge status={user.status} />
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

// ─── Approve modal (role picker) ─────────────────────────────────────────────

function ApproveModal({
  user, saving, onClose, onConfirm,
}: {
  user: AdminUser | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: (role: string) => void;
}) {
  const [role, setRole] = useState<string>(ROLE_OPTIONS[0].key);
  const wasVisible = useRef(false);
  const visible = user !== null;

  useEffect(() => {
    if (visible && !wasVisible.current) setRole(ROLE_OPTIONS[0].key);
    wasVisible.current = visible;
  }, [visible]);

  if (!user) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mStyles.overlay}>
        <Pressable style={mStyles.backdrop} onPress={onClose} />
        <View style={mStyles.sheet}>
          <View style={mStyles.handle} />
          <Text style={[Typography.h3, mStyles.title]}>Approve {user.name}</Text>
          <Text style={[Typography.bodySecondary, mStyles.subtitle]}>Choose a role for this user.</Text>

          <View style={mStyles.roleList}>
            {ROLE_OPTIONS.map((opt) => {
              const active = role === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[mStyles.roleOption, active && mStyles.roleOptionActive]}
                  onPress={() => setRole(opt.key)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={active ? Colors.accent : Colors.textMuted}
                  />
                  <Text style={[mStyles.roleLabel, active && { color: Colors.textPrimary }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={mStyles.actions}>
            <TouchableOpacity style={mStyles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={mStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[mStyles.confirmBtn, saving && { opacity: 0.6 }]}
              onPress={() => onConfirm(role)}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={mStyles.confirmText}>Approve</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── User detail modal (kiosk assignments) ───────────────────────────────────

function UserDetailModal({
  user, kiosks, onClose,
}: {
  user: AdminUser | null;
  kiosks: Kiosk[];
  onClose: () => void;
}) {
  const visible = user !== null;
  const [assigned, setAssigned] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyKiosk, setBusyKiosk] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const fetchAssignments = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const raw = await api.get(`/api/admin/assignments/${userId}`);
      if (!mounted.current) return;
      setAssigned(normalizeAssignments(raw));
    } catch (e: any) {
      if (!mounted.current) return;
      setError(e?.message ?? 'Failed to load assignments');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible && user) fetchAssignments(user.id);
    else { setAssigned([]); setError(null); }
  }, [visible, user, fetchAssignments]);

  if (!user) return null;

  const kioskMap = new Map(kiosks.map((k) => [k.kiosk_id, k]));
  const assignedKiosks = assigned.map((id) => kioskMap.get(id) ?? ({ kiosk_id: id, kiosk_name: id, location: '' } as Kiosk));
  const unassignedKiosks = kiosks.filter((k) => !assigned.includes(k.kiosk_id));

  async function assign(kioskId: string, kioskName: string) {
    setBusyKiosk(kioskId);
    try {
      await api.post('/api/admin/assignments', { user_id: user!.id, kiosk_id: kioskId });
      if (mounted.current) setAssigned((prev) => [...new Set([...prev, kioskId])]);
      await fetchAssignments(user!.id);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? `Couldn't assign ${kioskName}.`);
    } finally {
      if (mounted.current) setBusyKiosk(null);
    }
  }

  async function unassign(kioskId: string, kioskName: string) {
    setBusyKiosk(kioskId);
    try {
      await api.delete('/api/admin/assignments', { body: { user_id: user!.id, kiosk_id: kioskId } });
      if (mounted.current) setAssigned((prev) => prev.filter((id) => id !== kioskId));
      await fetchAssignments(user!.id);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? `Couldn't remove ${kioskName}.`);
    } finally {
      if (mounted.current) setBusyKiosk(null);
    }
  }

  function confirmUnassign(kioskId: string, kioskName: string) {
    Alert.alert('Remove kiosk', `Remove "${kioskName}" from ${user!.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => unassign(kioskId, kioskName) },
    ]);
  }

  function confirmAssign(kioskId: string, kioskName: string) {
    Alert.alert('Assign kiosk', `Assign "${kioskName}" to ${user!.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Assign', onPress: () => assign(kioskId, kioskName) },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={dStyles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={dStyles.headerTitle}>Manage Access</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* User summary */}
          <View style={dStyles.userCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(user.name[0] ?? '?').toUpperCase()}</Text>
            </View>
            <Text style={[Typography.h3, { marginTop: Spacing.sm }]}>{user.name}</Text>
            <Text style={Typography.bodySecondary}>{user.email}</Text>
            <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
              <View style={[styles.badge, { backgroundColor: Colors.accent + '18' }]}>
                <Text style={[styles.badgeText, { color: Colors.accentDark }]}>{roleLabel(user.role)}</Text>
              </View>
              <StatusBadge status={user.status} />
            </View>
          </View>

          {/* Assigned kiosks */}
          <Text style={styles.sectionLabel}>Assigned kiosks</Text>
          {loading ? (
            <View style={styles.viewCenter}><ActivityIndicator color={Colors.accent} /></View>
          ) : error ? (
            <View style={styles.viewCenter}>
              <Text style={[Typography.bodySecondary, { textAlign: 'center' }]}>{error}</Text>
              <TouchableOpacity style={styles.smallRetry} onPress={() => fetchAssignments(user.id)}>
                <Text style={styles.smallRetryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : assignedKiosks.length === 0 ? (
            <View style={dStyles.emptyAssign}>
              <Text style={Typography.bodySecondary}>No kiosks assigned yet.</Text>
            </View>
          ) : (
            <View style={{ gap: Spacing.sm }}>
              {assignedKiosks.map((k) => (
                <View key={k.kiosk_id} style={dStyles.assignRow}>
                  <Ionicons name="print" size={18} color={Colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={dStyles.assignName} numberOfLines={1}>{k.kiosk_name}</Text>
                    {k.location ? <Text style={Typography.caption} numberOfLines={1}>{k.location}</Text> : null}
                  </View>
                  <TouchableOpacity
                    style={dStyles.removeBtn}
                    onPress={() => confirmUnassign(k.kiosk_id, k.kiosk_name)}
                    disabled={busyKiosk === k.kiosk_id}
                  >
                    {busyKiosk === k.kiosk_id
                      ? <ActivityIndicator size="small" color={Colors.error} />
                      : <Ionicons name="close-circle" size={22} color={Colors.error} />}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Add kiosk */}
          <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>Add kiosk</Text>
          {unassignedKiosks.length === 0 ? (
            <View style={dStyles.emptyAssign}>
              <Text style={Typography.bodySecondary}>
                {kiosks.length === 0 ? 'No kiosks available.' : 'All kiosks are assigned.'}
              </Text>
            </View>
          ) : (
            <View style={{ gap: Spacing.sm }}>
              {unassignedKiosks.map((k) => (
                <TouchableOpacity
                  key={k.kiosk_id}
                  style={dStyles.addRow}
                  onPress={() => confirmAssign(k.kiosk_id, k.kiosk_name)}
                  disabled={busyKiosk === k.kiosk_id}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={dStyles.assignName} numberOfLines={1}>{k.kiosk_name}</Text>
                    {k.location ? <Text style={Typography.caption} numberOfLines={1}>{k.location}</Text> : null}
                  </View>
                  {busyKiosk === k.kiosk_id
                    ? <ActivityIndicator size="small" color={Colors.accent} />
                    : <Ionicons name="add-circle" size={24} color={Colors.accent} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function AdminScreen() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [approveUser, setApproveUser] = useState<AdminUser | null>(null);
  const [savingApprove, setSavingApprove] = useState(false);
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  const fetchData = useCallback(async () => {
    try {
      const [usersRaw, kiosksRaw] = await Promise.all([
        api.get('/api/admin/users'),
        api.get('/api/kiosks'),
      ]);
      if (!isMounted.current) return;
      setUsers(normalizeUsers(usersRaw));
      setKiosks(unwrapKiosks(kiosksRaw));
      setError(null);
    } catch (e: any) {
      if (!isMounted.current) return;
      setError(e?.message ?? 'Failed to load admin data');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) fetchData();
      else setLoading(false);
    }, [isAdmin, fetchData]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await fetchData();
    if (isMounted.current) setRefreshing(false);
  }

  async function confirmApprove(role: string) {
    if (!approveUser) return;
    setSavingApprove(true);
    try {
      await api.post(`/api/admin/users/${approveUser.id}/approve`, { role });
      setApproveUser(null);
      await fetchData();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not approve user.');
    } finally {
      if (isMounted.current) setSavingApprove(false);
    }
  }

  function onReject(user: AdminUser) {
    Alert.alert('Reject registration', `Reject ${user.name}? They won't be able to access the app.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setBusyUserId(user.id);
          try {
            await api.post(`/api/admin/users/${user.id}/reject`);
            await fetchData();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not reject user.');
          } finally {
            if (isMounted.current) setBusyUserId(null);
          }
        },
      },
    ]);
  }

  // ── not authorised ─────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerStandalone}><Text style={Typography.h1}>Admin</Text></View>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color={Colors.textMuted} />
          <Text style={[Typography.h3, { marginTop: Spacing.md }]}>Admins only</Text>
          <Text style={[Typography.bodySecondary, { textAlign: 'center', marginTop: Spacing.xs }]}>
            You don't have permission to view this page.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerStandalone}><Text style={Typography.h1}>Admin</Text></View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={[Typography.bodySecondary, { marginTop: Spacing.sm }]}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── error ──────────────────────────────────────────────────────────────────
  if (error && users.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerStandalone}><Text style={Typography.h1}>Admin</Text></View>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.textMuted} />
          <Text style={[Typography.h3, { marginTop: Spacing.md, textAlign: 'center' }]}>Couldn't load admin data</Text>
          <Text style={[Typography.bodySecondary, { textAlign: 'center', marginTop: Spacing.xs }]}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchData(); }}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const pending = users.filter((u) => u.status.toLowerCase() === 'pending');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />
        }
      >
        <Text style={[Typography.h1, { marginBottom: Spacing.lg }]}>Admin</Text>

        {/* Section 1: Pending registrations */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Pending registrations</Text>
          {pending.length > 0 && (
            <View style={styles.countPill}><Text style={styles.countPillText}>{pending.length}</Text></View>
          )}
        </View>
        {pending.length === 0 ? (
          <View style={styles.emptyInline}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.online} />
            <Text style={[Typography.bodySecondary, { marginLeft: 6 }]}>No pending registrations.</Text>
          </View>
        ) : (
          <View style={{ gap: Spacing.md, marginBottom: Spacing.lg }}>
            {pending.map((u) => (
              <PendingUserCard
                key={u.id}
                user={u}
                busy={busyUserId === u.id}
                onApprove={() => setApproveUser(u)}
                onReject={() => onReject(u)}
              />
            ))}
          </View>
        )}

        {/* Section 2: All users */}
        <View style={[styles.sectionHeaderRow, { marginTop: Spacing.lg }]}>
          <Text style={styles.sectionTitle}>Users</Text>
          {users.length > 0 && (
            <View style={[styles.countPill, { backgroundColor: Colors.pillBg }]}>
              <Text style={[styles.countPillText, { color: Colors.textSecondary }]}>{users.length}</Text>
            </View>
          )}
        </View>
        {users.length === 0 ? (
          <View style={styles.emptyInline}>
            <Text style={Typography.bodySecondary}>No users yet.</Text>
          </View>
        ) : (
          <View style={styles.usersCard}>
            {users.map((u, i) => (
              <View key={u.id} style={i > 0 && styles.userDivider}>
                <UserRow user={u} onPress={() => setDetailUser(u)} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <ApproveModal
        user={approveUser}
        saving={savingApprove}
        onClose={() => setApproveUser(null)}
        onConfirm={confirmApprove}
      />
      <UserDetailModal
        user={detailUser}
        kiosks={kiosks}
        onClose={() => setDetailUser(null)}
      />
    </SafeAreaView>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  viewCenter: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.lg },
  headerStandalone: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  sectionTitle: {
    fontSize: 13, fontWeight: '700' as const, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  countPill: {
    backgroundColor: Colors.warning, borderRadius: Radius.pill,
    minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7,
  },
  countPillText: { fontSize: 12, fontWeight: '700' as const, color: Colors.white },

  sectionLabel: {
    fontSize: 13, fontWeight: '700' as const, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm,
  },

  emptyInline: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },

  // pending card
  pendingCard: { backgroundColor: Colors.card, borderRadius: Radius.card, padding: Spacing.md, gap: Spacing.md, ...Shadow.card },
  pendingTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: {
    width: 44, height: 44, borderRadius: Radius.pill, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.white, fontWeight: '800' as const, fontSize: 18 },
  userName: { ...Typography.body, fontWeight: '700' as const },
  userEmail: { ...Typography.caption },
  userPhone: { ...Typography.caption, marginTop: 1 },
  pendingActions: { flexDirection: 'row', gap: Spacing.sm },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Colors.error + '55', paddingVertical: 10,
  },
  rejectText: { color: Colors.error, fontWeight: '700' as const, fontSize: 14 },
  approveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    borderRadius: Radius.pill, backgroundColor: Colors.online, paddingVertical: 10,
  },
  approveText: { color: Colors.white, fontWeight: '700' as const, fontSize: 14 },
  disabled: { opacity: 0.5 },

  // users list
  usersCard: { backgroundColor: Colors.card, borderRadius: Radius.card, paddingHorizontal: Spacing.md, ...Shadow.card },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  userDivider: { borderTopWidth: 1, borderTopColor: Colors.border },
  avatarSm: {
    width: 36, height: 36, borderRadius: Radius.pill, backgroundColor: Colors.pillBg,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarSmText: { color: Colors.accentDark, fontWeight: '800' as const, fontSize: 15 },
  userRole: { ...Typography.caption, marginTop: 1 },

  badge: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' as const },

  smallRetry: {
    marginTop: Spacing.sm, backgroundColor: Colors.accent + '22', borderRadius: Radius.pill,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  smallRetryText: { fontSize: 13, fontWeight: '700' as const, color: Colors.accentDark },
  retryBtn: {
    marginTop: Spacing.lg, backgroundColor: Colors.accent, borderRadius: Radius.pill,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg,
  },
  retryText: { color: Colors.white, fontWeight: '700' as const, fontSize: 15 },
});

const dStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card,
  },
  headerTitle: { ...Typography.h3, fontSize: 16 },
  userCard: { alignItems: 'center', paddingVertical: Spacing.lg, marginBottom: Spacing.md },
  emptyAssign: {
    backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', ...Shadow.card,
  },
  assignRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md, ...Shadow.card,
  },
  assignName: { ...Typography.body, fontWeight: '600' as const },
  removeBtn: { padding: 2 },
  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
});

const mStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, paddingBottom: 36, gap: Spacing.md,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: Spacing.xs },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginTop: -Spacing.sm },
  roleList: { gap: Spacing.sm },
  roleOption: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, padding: Spacing.md,
  },
  roleOptionActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '12' },
  roleLabel: { ...Typography.body, fontWeight: '600' as const, color: Colors.textSecondary },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: Radius.pill,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
  },
  cancelText: { ...Typography.body, fontWeight: '600' as const, color: Colors.textSecondary },
  confirmBtn: { flex: 2, paddingVertical: 14, borderRadius: Radius.pill, backgroundColor: Colors.online, alignItems: 'center' },
  confirmText: { ...Typography.body, fontWeight: '700' as const, color: Colors.white },
});
