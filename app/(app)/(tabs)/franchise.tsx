import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InviteKioskOption, InviteModal, KioskCard, PrimaryButton } from '../../../components';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import { Kiosk, Partner } from '../../../lib/types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function titleCase(s: string): string {
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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

function normalizePartners(raw: unknown): Partner[] {
  let arr: any[] = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const key of ['partners', 'data', 'results']) {
      if (Array.isArray(obj[key])) { arr = obj[key] as any[]; break; }
    }
  }
  return arr
    .map((p) => ({
      id: String(p.id ?? p.user_id ?? ''),
      email: p.email ?? null,
      name: p.name ?? null,
      phone: p.phone ?? null,
      role: String(p.role ?? 'onsite_partner'),
      status: String(p.status ?? 'pending'),
      kiosk_ids: Array.isArray(p.kiosk_ids)
        ? p.kiosk_ids.map((k: unknown) => String(k)).filter(Boolean)
        : [],
    }))
    .filter((p) => p.id);
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

// ─── Partner card ────────────────────────────────────────────────────────────

function PartnerCard({ partner, kioskName }: { partner: Partner; kioskName: (id: string) => string }) {
  const display = partner.name || partner.email || '(no name)';
  return (
    <View style={styles.partnerCard}>
      <View style={styles.partnerTop}>
        <View style={styles.avatarSm}>
          <Text style={styles.avatarSmText}>{(display[0] ?? '?').toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName} numberOfLines={1}>{display}</Text>
          {partner.email ? <Text style={styles.userEmail} numberOfLines={1}>{partner.email}</Text> : null}
        </View>
        <StatusBadge status={partner.status} />
      </View>

      <View style={styles.kioskChips}>
        {partner.kiosk_ids.length === 0 ? (
          <Text style={Typography.caption}>Not on any of your kiosks</Text>
        ) : (
          partner.kiosk_ids.map((id) => (
            <View key={id} style={styles.chip}>
              <Ionicons name="print" size={12} color={Colors.accentDark} />
              <Text style={styles.chipText} numberOfLines={1}>{kioskName(id)}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function FranchiseScreen() {
  const { profile } = useAuth();
  const isFranchise = profile?.role === 'franchise_partner';

  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  const fetchData = useCallback(async () => {
    try {
      // Both endpoints are scoped server-side to this franchise partner:
      //   /api/kiosks   -> kiosks they OWN
      //   /api/partners -> onsite partners on those owned kiosks (kiosk_ids clipped to scope)
      const [kiosksRaw, partnersRaw] = await Promise.all([
        api.get('/api/kiosks'),
        api.get('/api/partners'),
      ]);
      if (!isMounted.current) return;
      setKiosks(unwrapKiosks(kiosksRaw));
      setPartners(normalizePartners(partnersRaw));
      setError(null);
    } catch (e: any) {
      if (!isMounted.current) return;
      setError(e?.message ?? 'Failed to load your data');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isFranchise) fetchData();
      else setLoading(false);
    }, [isFranchise, fetchData]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await fetchData();
    if (isMounted.current) setRefreshing(false);
  }

  // ── not authorised ─────────────────────────────────────────────────────────
  // Defense in depth only — the backend enforces all scoping (403s). This just
  // avoids rendering franchise UI for a non-franchise role that reached the route.
  if (!isFranchise) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerStandalone}><Text style={Typography.h1}>Franchise</Text></View>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color={Colors.textMuted} />
          <Text style={[Typography.h3, { marginTop: Spacing.md }]}>Franchise partners only</Text>
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
        <View style={styles.headerStandalone}><Text style={Typography.h1}>Franchise</Text></View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={[Typography.bodySecondary, { marginTop: Spacing.sm }]}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── error ──────────────────────────────────────────────────────────────────
  if (error && kiosks.length === 0 && partners.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerStandalone}><Text style={Typography.h1}>Franchise</Text></View>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.textMuted} />
          <Text style={[Typography.h3, { marginTop: Spacing.md, textAlign: 'center' }]}>Couldn't load your data</Text>
          <Text style={[Typography.bodySecondary, { textAlign: 'center', marginTop: Spacing.xs }]}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchData(); }}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Kiosk-id → friendly name, for partner chips and the invite picker. Built only
  // from the franchise's OWN kiosks, so the picker can never show a global list.
  const kioskNameById = new Map(kiosks.map((k) => [k.kiosk_id, k.kiosk_name || k.kiosk_id]));
  const kioskName = (id: string) => kioskNameById.get(id) ?? id;

  const inviteKiosks: InviteKioskOption[] = kiosks.map((k) => ({
    kiosk_id: k.kiosk_id,
    kiosk_name: k.kiosk_name,
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />
        }
      >
        <Text style={[Typography.h1, { marginBottom: Spacing.lg }]}>Franchise</Text>

        {/* Section: Your kiosks */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Your kiosks</Text>
          {kiosks.length > 0 && (
            <View style={[styles.countPill, { backgroundColor: Colors.pillBg }]}>
              <Text style={[styles.countPillText, { color: Colors.textSecondary }]}>{kiosks.length}</Text>
            </View>
          )}
        </View>
        {kiosks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="print-outline" size={32} color={Colors.textMuted} />
            <Text style={[Typography.body, { fontWeight: '700', marginTop: Spacing.sm }]}>No kiosks yet</Text>
            <Text style={[Typography.bodySecondary, { textAlign: 'center', marginTop: 2 }]}>
              Kiosks you own will appear here once PrintBuddy assigns them to you.
            </Text>
          </View>
        ) : (
          <View style={{ gap: Spacing.md }}>
            {kiosks.map((k) => <KioskCard key={k.kiosk_id} kiosk={k} />)}
          </View>
        )}

        {/* Section: Onsite partners (invite + roster) */}
        <View style={[styles.sectionHeaderRow, { marginTop: Spacing.lg }]}>
          <Text style={styles.sectionTitle}>Your onsite partners</Text>
          {partners.length > 0 && (
            <View style={[styles.countPill, { backgroundColor: Colors.pillBg }]}>
              <Text style={[styles.countPillText, { color: Colors.textSecondary }]}>{partners.length}</Text>
            </View>
          )}
        </View>

        <PrimaryButton
          title="Invite onsite partner"
          variant="secondary"
          onPress={() => setInviteOpen(true)}
          disabled={kiosks.length === 0}
        />
        {kiosks.length === 0 && (
          <Text style={[Typography.caption, { marginTop: Spacing.xs }]}>
            You need at least one kiosk before you can invite a partner.
          </Text>
        )}

        <View style={{ height: Spacing.md }} />

        {partners.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={32} color={Colors.textMuted} />
            <Text style={[Typography.body, { fontWeight: '700', marginTop: Spacing.sm }]}>No onsite partners yet</Text>
            <Text style={[Typography.bodySecondary, { textAlign: 'center', marginTop: 2 }]}>
              Invite someone by email — they'll appear here once they join.
            </Text>
          </View>
        ) : (
          <View style={{ gap: Spacing.md }}>
            {partners.map((p) => (
              <PartnerCard key={p.id} partner={p} kioskName={kioskName} />
            ))}
          </View>
        )}
      </ScrollView>

      <InviteModal
        visible={inviteOpen}
        kiosks={inviteKiosks}
        onClose={() => setInviteOpen(false)}
        onCreated={fetchData}
      />
    </SafeAreaView>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  headerStandalone: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  sectionTitle: {
    fontSize: 13, fontWeight: '700' as const, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  countPill: {
    backgroundColor: Colors.pillBg, borderRadius: Radius.pill,
    minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7,
  },
  countPillText: { fontSize: 12, fontWeight: '700' as const, color: Colors.textSecondary },

  emptyCard: {
    backgroundColor: Colors.card, borderRadius: Radius.card, padding: Spacing.lg,
    alignItems: 'center', ...Shadow.card,
  },

  // partner card
  partnerCard: {
    backgroundColor: Colors.card, borderRadius: Radius.card, padding: Spacing.md,
    gap: Spacing.sm, ...Shadow.card,
  },
  partnerTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatarSm: {
    width: 40, height: 40, borderRadius: Radius.pill, backgroundColor: Colors.pillBg,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarSmText: { color: Colors.accentDark, fontWeight: '800' as const, fontSize: 16 },
  userName: { ...Typography.body, fontWeight: '700' as const },
  userEmail: { ...Typography.caption },

  kioskChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.pillBg, borderRadius: Radius.pill,
    paddingVertical: 4, paddingHorizontal: 10, maxWidth: '100%',
  },
  chipText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accentDark, flexShrink: 1 },

  badge: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' as const },

  retryBtn: {
    marginTop: Spacing.lg, backgroundColor: Colors.accent, borderRadius: Radius.pill,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg,
  },
  retryText: { color: Colors.white, fontWeight: '700' as const, fontSize: 15 },
});
