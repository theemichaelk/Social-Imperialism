import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBrand } from '@/context/BrandContext';
import { theme } from '@/lib/theme';
import { Btn, Field } from '@/components/ui';
import { webUrl } from '@/lib/api';

export function BrandSwitcherCard() {
  const {
    activeBrand,
    brands,
    loading,
    error,
    planLimit,
    platformCount,
    selectBrand,
    createBrand,
    refresh,
  } = useBrand();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState('');
  const [busy, setBusy] = useState(false);

  const statusLine = activeBrand
    ? `Active · ${platformCount || 0} platform${platformCount === 1 ? '' : 's'}`
    : loading
      ? 'Loading brands…'
      : error
        ? 'Could not load brands'
        : 'No brand yet';

  async function onSelect(id: string) {
    setBusy(true);
    try {
      await selectBrand(id);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function onCreate() {
    setCreateError('');
    setBusy(true);
    try {
      const res = await createBrand(newName);
      if (!res.ok) {
        setCreateError(res.error || 'Create failed');
        if (res.planLimit) setCreating(false);
        return;
      }
      setNewName('');
      setCreating(false);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable style={styles.card} onPress={() => setOpen(true)}>
        <View style={styles.left}>
          <Text style={styles.label}>BRAND</Text>
          <Text style={styles.name} numberOfLines={1}>
            {activeBrand?.brandName || activeBrand?.name || 'Select brand'}
          </Text>
          <Text style={[styles.status, error ? { color: theme.danger } : null]} numberOfLines={1}>
            {statusLine}
          </Text>
        </View>
        {loading ? (
          <ActivityIndicator color={theme.accent} />
        ) : (
          <Ionicons name="chevron-down" size={20} color={theme.accent} />
        )}
      </Pressable>

      {error ? (
        <Pressable style={styles.errorRow} onPress={() => refresh()}>
          <Text style={styles.errorText}>{error} — tap to retry</Text>
        </Pressable>
      ) : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Your brands</Text>
            <Text style={styles.sheetSub}>Switch the active campaign for Mission Control.</Text>

            {brands.length === 0 ? (
              <Text style={styles.empty}>No brands loaded yet.</Text>
            ) : (
              brands.map((b) => {
                const active = b.id === activeBrand?.id;
                return (
                  <Pressable
                    key={b.id}
                    style={[styles.brandRow, active && styles.brandRowActive]}
                    onPress={() => onSelect(b.id)}
                    disabled={busy}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.brandRowName}>{b.brandName || b.name}</Text>
                      {b.domain ? <Text style={styles.brandRowDomain}>{b.domain}</Text> : null}
                    </View>
                    {active ? <Ionicons name="checkmark-circle" size={20} color={theme.accent} /> : null}
                  </Pressable>
                );
              })
            )}

            {planLimit || createError ? (
              <View style={styles.limitBox}>
                <Text style={styles.limitTitle}>Reached free plan limit</Text>
                <Text style={styles.limitBody}>
                  {createError || 'Free plan allows 1 brand. Upgrade to create more.'}
                </Text>
                <Btn
                  title="Upgrade plan"
                  variant="purple"
                  onPress={() => Linking.openURL(webUrl('/subscribe'))}
                  style={{ marginTop: 10 }}
                />
              </View>
            ) : null}

            {creating ? (
              <View style={{ marginTop: 12 }}>
                <Field value={newName} onChangeText={setNewName} placeholder="New brand name" />
                <Btn title={busy ? 'Creating…' : 'Create brand'} onPress={onCreate} disabled={busy} />
                <Btn title="Cancel" variant="ghost" onPress={() => setCreating(false)} style={{ marginTop: 8 }} />
              </View>
            ) : (
              <Btn
                title="+ New brand"
                variant="ghost"
                onPress={() => {
                  setCreateError('');
                  setCreating(true);
                }}
                style={{ marginTop: 14 }}
              />
            )}

            <Btn title="Close" variant="ghost" onPress={() => setOpen(false)} style={{ marginTop: 8 }} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.panel,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.panelBorderStrong,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  left: { flex: 1 },
  label: {
    color: theme.accent2,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  name: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '800',
  },
  status: {
    color: theme.muted,
    fontSize: 13,
    marginTop: 3,
  },
  errorRow: {
    marginTop: -6,
    marginBottom: 12,
  },
  errorText: {
    color: theme.danger,
    fontSize: 12,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: theme.bgElevated,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    padding: 18,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.mutedDim,
    marginBottom: 14,
  },
  sheetTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: '800',
  },
  sheetSub: {
    color: theme.muted,
    fontSize: 13,
    marginBottom: 14,
    marginTop: 4,
  },
  empty: { color: theme.muted, marginVertical: 12 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    backgroundColor: theme.panel,
    marginBottom: 8,
  },
  brandRowActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accentGlow,
  },
  brandRowName: { color: theme.text, fontWeight: '700', fontSize: 15 },
  brandRowDomain: { color: theme.muted, fontSize: 12, marginTop: 2 },
  limitBox: {
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,176,32,0.4)',
    backgroundColor: 'rgba(255,176,32,0.08)',
  },
  limitTitle: { color: theme.warn, fontWeight: '800', fontSize: 14 },
  limitBody: { color: theme.textSoft, fontSize: 13, marginTop: 4, lineHeight: 18 },
});
