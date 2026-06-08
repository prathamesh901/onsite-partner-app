import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Shadow, Spacing, Typography } from '../../../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import { Kiosk } from '../../../lib/types';

type View_ = 'stock' | 'history';

interface StockItem {
  item_type: string;
  label: string;
  quantity: number;
  low: boolean;
  threshold: number | null;
}

interface LedgerEntry {
  id: string;
  item_type: string;
  action: string;
  amount: number | null;
  reportedBy: string;
  at: string;
  note: string | null;
}

type ModalMode = 'delivery' | 'count' | null;

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatAgo(iso: string | undefined | null): string {
  if (!iso) return '—';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return '—';
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

/** Friendly label + colour + unit for a consumable item. */
function itemVisual(item_type: string, label: string): {
  color: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  unit: string;
} {
  const key = `${item_type} ${label}`.toLowerCase();
  if (key.includes('paper')) return { color: '#5A6B7C', icon: 'documents-outline', unit: 'reams' };
  if (key.includes('black')) return { color: '#1A2B3C', icon: 'color-fill-outline', unit: 'spares' };
  if (key.includes('cyan')) return { color: '#22B8CF', icon: 'color-fill-outline', unit: 'spares' };
  if (key.includes('magenta')) return { color: '#E64980', icon: 'color-fill-outline', unit: 'spares' };
  if (key.includes('yellow')) return { color: '#FAB005', icon: 'color-fill-outline', unit: 'spares' };
  return { color: Colors.accent, icon: 'cube-outline', unit: 'units' };
}

function friendlyLabel(item_type: string): string {
  const k = item_type.toLowerCase();
  if (k.includes('paper')) return 'Paper reams';
  if (k.includes('black')) return 'Black cartridge';
  if (k.includes('cyan')) return 'Cyan cartridge';
  if (k.includes('magenta')) return 'Magenta cartridge';
  if (k.includes('yellow')) return 'Yellow cartridge';
  // Title-case the raw type as a last resort.
  return item_type.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeStockItems(raw: unknown): StockItem[] {
  let arr: any[] = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const key of ['items', 'consumables', 'stock', 'supplies', 'data']) {
      if (Array.isArray(obj[key])) { arr = obj[key] as any[]; break; }
    }
  }
  return arr
    .map((it) => {
      const item_type = String(it.item_type ?? it.type ?? it.sku ?? it.key ?? it.id ?? '');
      const quantity =
        num(it.quantity) ?? num(it.count) ?? num(it.value) ?? num(it.qty) ??
        num(it.on_hand) ?? num(it.current) ?? num(it.stock) ?? 0;
      const threshold =
        num(it.threshold) ?? num(it.reorder_threshold) ?? num(it.reorder_point) ??
        num(it.min) ?? num(it.low_threshold) ?? null;
      const low =
        (typeof it.low === 'boolean' && it.low) ||
        (typeof it.is_low === 'boolean' && it.is_low) ||
        (typeof it.needs_reorder === 'boolean' && it.needs_reorder) ||
        (threshold != null && (quantity ?? 0) <= threshold);
      const label = String(it.label ?? it.name ?? friendlyLabel(item_type));
      return { item_type, quantity: quantity ?? 0, threshold, low, label };
    })
    .filter((it) => it.item_type);
}

/** When the backend returns no stock, synthesise the expected items from the kiosk. */
function deriveItemsFromKiosk(kiosk: Kiosk | null): StockItem[] {
  if (!kiosk) return [];
  const items: StockItem[] = [
    { item_type: 'paper', label: 'Paper reams', quantity: 0, low: false, threshold: null },
  ];
  const colors = (kiosk.cartridges ?? []).map((c) => (c.name || '').toLowerCase());
  const seen = new Set<string>();
  for (const c of colors) {
    const color = ['black', 'cyan', 'magenta', 'yellow'].find((x) => c.includes(x));
    if (color && !seen.has(color)) {
      seen.add(color);
      items.push({
        item_type: `cartridge_${color}`,
        label: friendlyLabel(color),
        quantity: 0,
        low: false,
        threshold: null,
      });
    }
  }
  // Mono / e-Stamp kiosks may report no cartridges — default to a black spare.
  if (seen.size === 0) {
    items.push({ item_type: 'cartridge_black', label: 'Black cartridge', quantity: 0, low: false, threshold: null });
  }
  return items;
}

function extractReorderTarget(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as any;
  const t =
    obj.reorder_target ?? obj.reorder_to ?? obj.reorder_contact ?? obj.notify ??
    obj.reorder?.target ?? obj.reorder?.contact ?? null;
  if (!t) return null;
  if (typeof t === 'string') return t;
  if (typeof t === 'object') return t.name ?? t.email ?? t.contact ?? null;
  return String(t);
}

function normalizeLedger(raw: unknown): LedgerEntry[] {
  let arr: any[] = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const key of ['ledger', 'entries', 'history', 'data', 'results']) {
      if (Array.isArray(obj[key])) { arr = obj[key] as any[]; break; }
    }
  }
  return arr.map((e, i) => {
    const action = String(e.action ?? e.type ?? e.event ?? e.kind ?? 'entry').toLowerCase();
    const amount =
      num(e.amount) ?? num(e.quantity) ?? num(e.delta) ?? num(e.counted_value) ??
      num(e.change) ?? num(e.value) ?? null;
    return {
      id: String(e.id ?? e.uuid ?? `${i}-${e.created_at ?? ''}`),
      item_type: String(e.item_type ?? e.type ?? ''),
      action,
      amount,
      reportedBy: String(e.reported_by ?? e.by ?? e.user ?? e.actor ?? e.created_by ?? 'unknown'),
      at: String(e.created_at ?? e.at ?? e.timestamp ?? e.date ?? ''),
      note: e.note ?? e.discrepancy ?? e.message ?? null,
    };
  });
}

function ledgerVisual(action: string): {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  verb: string;
} {
  if (action.includes('deliver')) return { icon: 'arrow-down-circle', color: Colors.online, verb: 'Delivery' };
  if (action.includes('count') || action.includes('stocktake')) return { icon: 'checkmark-circle', color: Colors.accent, verb: 'Count' };
  if (action.includes('consum') || action.includes('use') || action.includes('install')) return { icon: 'arrow-up-circle', color: Colors.warning, verb: 'Used' };
  if (action.includes('discrep')) return { icon: 'alert-circle', color: Colors.error, verb: 'Discrepancy' };
  return { icon: 'ellipse', color: Colors.textMuted, verb: action.charAt(0).toUpperCase() + action.slice(1) };
}

// ─── Stock card ──────────────────────────────────────────────────────────────

function StockCard({
  item,
  onDelivery,
  onCount,
}: {
  item: StockItem;
  onDelivery: () => void;
  onCount: () => void;
}) {
  const v = itemVisual(item.item_type, item.label);
  return (
    <View style={styles.stockCard}>
      <View style={styles.stockTop}>
        <View style={[styles.itemDot, { backgroundColor: v.color }]} />
        <Text style={styles.itemLabel} numberOfLines={1}>{item.label}</Text>
        {item.low && (
          <View style={styles.lowPill}>
            <Text style={styles.lowPillText}>Low</Text>
          </View>
        )}
      </View>

      <View style={styles.qtyRow}>
        <Text style={styles.qtyValue}>{item.quantity}</Text>
        <Text style={styles.qtyUnit}>{v.unit}</Text>
        {item.threshold != null && (
          <Text style={styles.threshold}>· reorder at {item.threshold}</Text>
        )}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.deliveryBtn} onPress={onDelivery} activeOpacity={0.85}>
          <Ionicons name="add" size={16} color={Colors.white} />
          <Text style={styles.deliveryBtnText}>Log delivery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.countBtn} onPress={onCount} activeOpacity={0.85}>
          <Ionicons name="create-outline" size={16} color={Colors.accentDark} />
          <Text style={styles.countBtnText}>Count</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Ledger row ──────────────────────────────────────────────────────────────

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const v = ledgerVisual(entry.action);
  const itemLabel = entry.item_type ? friendlyLabel(entry.item_type) : '';
  const amountText =
    entry.amount == null ? ''
    : v.verb === 'Delivery' ? `+${entry.amount}`
    : v.verb === 'Used' ? `−${Math.abs(entry.amount)}`
    : `${entry.amount}`;

  return (
    <View style={styles.ledgerRow}>
      <Ionicons name={v.icon} size={20} color={v.color} style={{ marginTop: 1 }} />
      <View style={styles.ledgerBody}>
        <Text style={styles.ledgerTitle}>
          {v.verb}{itemLabel ? ` · ${itemLabel}` : ''}{amountText ? `  ${amountText}` : ''}
        </Text>
        {entry.note ? <Text style={styles.ledgerNote}>{entry.note}</Text> : null}
        <Text style={styles.ledgerMeta}>{entry.reportedBy} · {formatAgo(entry.at)}</Text>
      </View>
    </View>
  );
}

// ─── Supply modal (delivery / count) ─────────────────────────────────────────

function SupplyModal({
  mode,
  item,
  saving,
  onClose,
  onConfirm,
}: {
  mode: ModalMode;
  item: StockItem | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: (value: number) => void;
}) {
  const visible = mode !== null && item !== null;
  const [value, setValue] = useState('');
  const wasVisible = useRef(false);

  useEffect(() => {
    if (visible && !wasVisible.current) {
      // Opening: count prefills the current quantity; delivery starts empty.
      setValue(mode === 'count' ? String(item?.quantity ?? 0) : '');
    }
    wasVisible.current = visible;
  }, [visible, mode, item]);

  if (!item) return null;
  const v = itemVisual(item.item_type, item.label);
  const isCount = mode === 'count';

  function confirm() {
    const n = parseInt(value || '', 10);
    if (isNaN(n) || n < 0) {
      Alert.alert('Invalid value', 'Enter a valid number.');
      return;
    }
    onConfirm(n);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={mStyles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={mStyles.backdrop} onPress={onClose} />
        <View style={mStyles.sheet}>
          <View style={mStyles.handle} />
          <Text style={[Typography.h3, mStyles.title]}>
            {isCount ? 'Count stock' : 'Log delivery'}
          </Text>
          <Text style={[Typography.bodySecondary, mStyles.subtitle]}>
            {item.label} · {isCount
              ? `How many ${v.unit} are there right now?`
              : `How many ${v.unit} were delivered?`}
          </Text>

          <TextInput
            style={mStyles.input}
            value={value}
            onChangeText={(t) => setValue(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            maxLength={5}
            autoFocus
          />

          <Text style={mStyles.hint}>
            {isCount
              ? `Sets the on-hand count. Current: ${item.quantity} ${v.unit}.`
              : `Adds to stock. Current: ${item.quantity} ${v.unit}.`}
          </Text>

          <View style={mStyles.actions}>
            <TouchableOpacity style={mStyles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={mStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[mStyles.confirmBtn, saving && { opacity: 0.6 }]}
              onPress={confirm}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={mStyles.confirmText}>{isCount ? 'Save count' : 'Add delivery'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function SuppliesScreen() {
  const { profile, session } = useAuth();
  const reportedBy = profile?.name ?? profile?.email ?? session?.user?.email ?? 'unknown';

  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View_>('stock');

  const [items, setItems] = useState<StockItem[]>([]);
  const [reorderTarget, setReorderTarget] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [modalItem, setModalItem] = useState<StockItem | null>(null);
  const [saving, setSaving] = useState(false);

  const isMounted = useRef(true);
  const selectedRef = useRef<string | null>(null);

  useEffect(() => () => { isMounted.current = false; }, []);

  const fetchKiosks = useCallback(async () => {
    try {
      const raw = await api.get('/api/kiosks');
      if (!isMounted.current) return;
      const list = unwrapKiosks(raw);
      setKiosks(list);
      setError(null);
      const stillValid = selectedRef.current && list.some((k) => k.kiosk_id === selectedRef.current);
      if (!stillValid && list.length > 0) {
        selectedRef.current = list[0].kiosk_id;
        setSelectedId(list[0].kiosk_id);
      }
    } catch (e: any) {
      if (!isMounted.current) return;
      setError(e?.message ?? 'Failed to load kiosks');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  const fetchStock = useCallback(async (id: string, kioskForFallback: Kiosk | null) => {
    if (!id) return;
    setStockLoading(true);
    setStockError(null);
    try {
      const raw = await api.get(`/api/consumables/${id}`);
      if (!isMounted.current || selectedRef.current !== id) return;
      let parsed = normalizeStockItems(raw);
      if (parsed.length === 0) parsed = deriveItemsFromKiosk(kioskForFallback);
      setItems(parsed);
      setReorderTarget(extractReorderTarget(raw));
    } catch (e: any) {
      if (!isMounted.current || selectedRef.current !== id) return;
      setStockError(e?.message ?? 'Failed to load stock');
      setItems(deriveItemsFromKiosk(kioskForFallback));
    } finally {
      if (isMounted.current && selectedRef.current === id) setStockLoading(false);
    }
  }, []);

  const fetchLedger = useCallback(async (id: string) => {
    if (!id) return;
    setLedgerLoading(true);
    try {
      const raw = await api.get(`/api/consumables/${id}/ledger`);
      if (!isMounted.current || selectedRef.current !== id) return;
      const entries = normalizeLedger(raw);
      entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setLedger(entries);
    } catch {
      if (selectedRef.current === id) setLedger([]);
    } finally {
      if (isMounted.current && selectedRef.current === id) setLedgerLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchKiosks();
    }, [fetchKiosks]),
  );

  // Load stock + ledger whenever the selected kiosk changes.
  useEffect(() => {
    if (!selectedId) return;
    const kiosk = kiosks.find((k) => k.kiosk_id === selectedId) ?? null;
    fetchStock(selectedId, kiosk);
    fetchLedger(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function selectKiosk(id: string) {
    if (id === selectedId) return;
    selectedRef.current = id;
    setSelectedId(id);
    setItems([]);
    setLedger([]);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchKiosks();
    if (selectedRef.current) {
      const kiosk = kiosks.find((k) => k.kiosk_id === selectedRef.current) ?? null;
      await Promise.all([fetchStock(selectedRef.current, kiosk), fetchLedger(selectedRef.current)]);
    }
    if (isMounted.current) setRefreshing(false);
  }

  function openModal(mode: ModalMode, item: StockItem) {
    setModalItem(item);
    setModalMode(mode);
  }
  function closeModal() {
    setModalMode(null);
    setModalItem(null);
  }

  async function submitModal(value: number) {
    if (!selectedId || !modalItem || !modalMode) return;
    setSaving(true);
    try {
      if (modalMode === 'delivery') {
        await api.post(`/api/consumables/${selectedId}/delivery`, {
          item_type: modalItem.item_type,
          quantity: value,
          reported_by: reportedBy,
        });
      } else {
        await api.post(`/api/consumables/${selectedId}/count`, {
          item_type: modalItem.item_type,
          counted_value: value,
          reported_by: reportedBy,
        });
      }
      closeModal();
      const kiosk = kiosks.find((k) => k.kiosk_id === selectedId) ?? null;
      await Promise.all([fetchStock(selectedId, kiosk), fetchLedger(selectedId)]);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save. Try again.');
    } finally {
      if (isMounted.current) setSaving(false);
    }
  }

  const lowItems = items.filter((i) => i.low);

  // ── initial loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerStandalone}><Text style={Typography.h1}>Supplies</Text></View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={[Typography.bodySecondary, { marginTop: Spacing.sm }]}>Loading supplies…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── kiosks error ───────────────────────────────────────────────────────────
  if (error && kiosks.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerStandalone}><Text style={Typography.h1}>Supplies</Text></View>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.textMuted} />
          <Text style={[Typography.h3, { marginTop: Spacing.md, textAlign: 'center' }]}>Couldn't load supplies</Text>
          <Text style={[Typography.bodySecondary, { textAlign: 'center', marginTop: Spacing.xs }]}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchKiosks(); }}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />
        }
      >
        <Text style={[Typography.h1, { marginBottom: Spacing.md }]}>Supplies</Text>

        {kiosks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={40} color={Colors.textMuted} />
            <Text style={[Typography.h3, { marginTop: Spacing.sm }]}>No kiosks assigned</Text>
            <Text style={[Typography.bodySecondary, { textAlign: 'center', marginTop: 2 }]}>
              Consumables stock will appear once kiosks are assigned to you.
            </Text>
          </View>
        ) : (
          <>
            {/* Kiosk selector */}
            <Text style={styles.sectionLabel}>Kiosk</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {kiosks.map((k) => {
                const active = k.kiosk_id === selectedId;
                return (
                  <TouchableOpacity
                    key={k.kiosk_id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => selectKiosk(k.kiosk_id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                      {k.kiosk_name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Stock / History toggle */}
            <View style={styles.segment}>
              {(['stock', 'history'] as View_[]).map((key) => {
                const active = key === view;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                    onPress={() => setView(key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {key === 'stock' ? 'Stock' : 'History'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {view === 'stock' ? (
              <StockView
                items={items}
                loading={stockLoading}
                error={stockError}
                lowItems={lowItems}
                reorderTarget={reorderTarget}
                onRetry={() => {
                  const kiosk = kiosks.find((k) => k.kiosk_id === selectedId) ?? null;
                  if (selectedId) fetchStock(selectedId, kiosk);
                }}
                onDelivery={(it) => openModal('delivery', it)}
                onCount={(it) => openModal('count', it)}
              />
            ) : (
              <HistoryView loading={ledgerLoading} ledger={ledger} />
            )}
          </>
        )}
      </ScrollView>

      <SupplyModal
        mode={modalMode}
        item={modalItem}
        saving={saving}
        onClose={closeModal}
        onConfirm={submitModal}
      />
    </SafeAreaView>
  );
}

// ─── Stock view ──────────────────────────────────────────────────────────────

function StockView({
  items, loading, error, lowItems, reorderTarget, onRetry, onDelivery, onCount,
}: {
  items: StockItem[];
  loading: boolean;
  error: string | null;
  lowItems: StockItem[];
  reorderTarget: string | null;
  onRetry: () => void;
  onDelivery: (it: StockItem) => void;
  onCount: (it: StockItem) => void;
}) {
  if (loading && items.length === 0) {
    return <View style={styles.viewCenter}><ActivityIndicator color={Colors.accent} /></View>;
  }
  if (error && items.length === 0) {
    return (
      <View style={styles.viewCenter}>
        <Ionicons name="cloud-offline-outline" size={28} color={Colors.textMuted} />
        <Text style={[Typography.bodySecondary, { textAlign: 'center', marginTop: 6 }]}>{error}</Text>
        <TouchableOpacity style={styles.smallRetry} onPress={onRetry}>
          <Text style={styles.smallRetryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (items.length === 0) {
    return (
      <View style={styles.viewCenter}>
        <Ionicons name="cube-outline" size={28} color={Colors.textMuted} />
        <Text style={[Typography.bodySecondary, { textAlign: 'center', marginTop: 6 }]}>No stock items for this kiosk.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: Spacing.md }}>
      {lowItems.length > 0 && (
        <View style={styles.reorderBanner}>
          <Ionicons name="alert-circle" size={20} color={Colors.error} />
          <View style={{ flex: 1 }}>
            <Text style={styles.reorderTitle}>
              Reorder needed{reorderTarget ? ` — notify ${reorderTarget}` : ''}
            </Text>
            <Text style={styles.reorderSub}>
              Low: {lowItems.map((i) => i.label).join(', ')}
            </Text>
          </View>
        </View>
      )}

      {items.map((it) => (
        <StockCard
          key={it.item_type}
          item={it}
          onDelivery={() => onDelivery(it)}
          onCount={() => onCount(it)}
        />
      ))}
    </View>
  );
}

// ─── History view ────────────────────────────────────────────────────────────

function HistoryView({ loading, ledger }: { loading: boolean; ledger: LedgerEntry[] }) {
  if (loading && ledger.length === 0) {
    return <View style={styles.viewCenter}><ActivityIndicator color={Colors.accent} /></View>;
  }
  if (ledger.length === 0) {
    return (
      <View style={styles.viewCenter}>
        <Ionicons name="receipt-outline" size={28} color={Colors.textMuted} />
        <Text style={[Typography.bodySecondary, { textAlign: 'center', marginTop: 6 }]}>No history yet.</Text>
        <Text style={[Typography.caption, { textAlign: 'center', marginTop: 2 }]}>
          Deliveries and counts will be logged here.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.ledgerCard}>
      {ledger.map((e, i) => (
        <View key={e.id} style={i > 0 && styles.ledgerDivider}>
          <LedgerRow entry={e} />
        </View>
      ))}
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  viewCenter: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl * 1.5 },
  headerStandalone: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },

  sectionLabel: {
    fontSize: 13, fontWeight: '700' as const, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm,
  },
  chipsRow: { gap: Spacing.sm, paddingRight: Spacing.sm, marginBottom: Spacing.md },
  chip: {
    backgroundColor: Colors.card, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1.5, borderColor: Colors.border, maxWidth: 200,
  },
  chipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: { fontSize: 14, fontWeight: '600' as const, color: Colors.textSecondary },
  chipTextActive: { color: Colors.white },

  segment: {
    flexDirection: 'row', backgroundColor: Colors.pillBg, borderRadius: Radius.pill,
    padding: 4, gap: 4, marginBottom: Spacing.lg,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: Radius.pill, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: Colors.card, ...Shadow.card },
  segmentText: { fontSize: 14, fontWeight: '600' as const, color: Colors.textSecondary },
  segmentTextActive: { color: Colors.accentDark },

  reorderBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.error + '14', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.error + '33', padding: Spacing.md,
  },
  reorderTitle: { fontSize: 14, fontWeight: '700' as const, color: Colors.error },
  reorderSub: { ...Typography.caption, marginTop: 2 },

  stockCard: {
    backgroundColor: Colors.card, borderRadius: Radius.card, padding: Spacing.md,
    gap: Spacing.sm, ...Shadow.card,
  },
  stockTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  itemDot: { width: 12, height: 12, borderRadius: 6 },
  itemLabel: { ...Typography.h3, fontSize: 16, flex: 1 },
  lowPill: { backgroundColor: Colors.error, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  lowPillText: { fontSize: 11, fontWeight: '700' as const, color: Colors.white },

  qtyRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  qtyValue: { fontSize: 32, fontWeight: '800' as const, color: Colors.textPrimary },
  qtyUnit: { ...Typography.bodySecondary },
  threshold: { ...Typography.caption },

  cardActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 2 },
  deliveryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: Colors.accent, borderRadius: Radius.pill, paddingVertical: 11,
  },
  deliveryBtnText: { color: Colors.white, fontWeight: '700' as const, fontSize: 14 },
  countBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: Colors.accent + '18', borderRadius: Radius.pill, paddingVertical: 11,
  },
  countBtnText: { color: Colors.accentDark, fontWeight: '700' as const, fontSize: 14 },

  ledgerCard: { backgroundColor: Colors.card, borderRadius: Radius.card, padding: Spacing.md, ...Shadow.card },
  ledgerRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: Spacing.sm, alignItems: 'flex-start' },
  ledgerDivider: { borderTopWidth: 1, borderTopColor: Colors.border },
  ledgerBody: { flex: 1, gap: 2 },
  ledgerTitle: { ...Typography.body, fontWeight: '600' as const },
  ledgerNote: { ...Typography.caption, color: Colors.warning },
  ledgerMeta: { ...Typography.caption },

  emptyCard: {
    backgroundColor: Colors.card, borderRadius: Radius.card, padding: Spacing.xl,
    alignItems: 'center', ...Shadow.card,
  },

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

const mStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, paddingBottom: 36, gap: Spacing.md,
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, marginBottom: Spacing.xs,
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginTop: -Spacing.sm },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: 28, fontWeight: '700' as const, color: Colors.textPrimary, textAlign: 'center',
  },
  hint: { ...Typography.caption, textAlign: 'center', marginTop: -Spacing.xs },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: Radius.pill,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
  },
  cancelText: { ...Typography.body, fontWeight: '600' as const, color: Colors.textSecondary },
  confirmBtn: { flex: 2, paddingVertical: 14, borderRadius: Radius.pill, backgroundColor: Colors.accent, alignItems: 'center' },
  confirmText: { ...Typography.body, fontWeight: '700' as const, color: Colors.white },
});
