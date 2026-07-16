import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { invoke, webUrl } from '@/lib/api';
import { theme } from '@/lib/theme';
import { useBrand } from '@/context/BrandContext';
import { Btn, Card, Field, Muted, Screen, SectionLabel } from '@/components/ui';

const PRESETS = [
  'Launch reel — neon command aesthetic, 9:16',
  'Carousel — 5 tips for AI social growth',
  'LinkedIn thought leadership banner 1200×627',
  'Story series — brand authority in 4 frames',
];

const STUDIOS = [
  { label: 'Design Studio', path: '/design-studio', icon: 'color-palette-outline' as const, desc: 'Compositor + Grok Imagine' },
  { label: 'Video Studio', path: '/video-studio', icon: 'videocam-outline' as const, desc: 'Imperial video pipelines' },
  { label: 'Prompt Vault', path: '/prompt-vault', icon: 'lock-closed-outline' as const, desc: 'Reusable creative prompts' },
  { label: 'Content Library', path: '/content-library', icon: 'folder-outline' as const, desc: 'Assets & past creatives' },
];

export default function StudioScreen() {
  const { activeBrand } = useBrand();
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function runDesignBrief() {
    if (!prompt.trim()) {
      setMessage('Describe the visual you need.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const brand = activeBrand?.brandName || activeBrand?.name || 'the brand';
      const res = await invoke<string | { text?: string }>('generate-ai',
        `You are Social Imperialism Design Studio for ${brand}. Create a concise production brief for: ${prompt.trim()}.
Include:
1) Concept (2 sentences)
2) Palette (4 hex colors)
3) Composition / hierarchy
4) On-image copy (headline + CTA)
5) Platform crops (1:1, 9:16, 16:9 notes)
6) Motion note if video/reel
Keep it production-ready and tight.`);
      const text = typeof res === 'string' ? res : res?.text || JSON.stringify(res);
      setResult(String(text || '').trim());
      setMessage('Brief ready. Open full Design Studio on web for renders.');
    } catch (e) {
      setMessage((e as Error).message || 'Studio request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Studio" subtitle="Mobile creative command · finish on full studio">
      <Card accent="purple">
        <Text style={styles.kicker}>IMPERIAL CREATIVE</Text>
        <Text style={styles.title}>Brief on the go</Text>
        <Muted>
          Generate production briefs for {activeBrand?.brandName || activeBrand?.name || 'your brand'}, then finish in Design or Video Studio.
        </Muted>
      </Card>

      <SectionLabel>Presets</SectionLabel>
      <View style={styles.presets}>
        {PRESETS.map((p) => (
          <Pressable key={p} style={styles.preset} onPress={() => setPrompt(p)}>
            <Text style={styles.presetText} numberOfLines={2}>{p}</Text>
          </Pressable>
        ))}
      </View>

      <SectionLabel>Creative prompt</SectionLabel>
      <Field
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Describe the asset, platform, and mood…"
        multiline
      />
      <Btn title={busy ? 'Generating…' : 'Generate brief'} onPress={runDesignBrief} disabled={busy} />
      {message ? <Muted style={{ marginTop: 10 }}>{message}</Muted> : null}

      {result ? (
        <Card style={{ marginTop: 14 }}>
          <Text style={styles.resultLabel}>BRIEF</Text>
          <Text style={styles.result} selectable>{result}</Text>
          <Btn
            title="Copy workflow → Design Studio"
            variant="ghost"
            onPress={() => Linking.openURL(webUrl('/design-studio'))}
            style={{ marginTop: 12 }}
          />
        </Card>
      ) : null}

      <SectionLabel>Full studios</SectionLabel>
      <View style={styles.grid}>
        {STUDIOS.map((item) => (
          <Pressable
            key={item.path}
            style={styles.tile}
            onPress={() => Linking.openURL(webUrl(item.path))}
          >
            <View style={styles.tileIcon}>
              <Ionicons name={item.icon} size={18} color={theme.accent} />
            </View>
            <Text style={styles.tileTitle}>{item.label}</Text>
            <Text style={styles.tileDesc}>{item.desc}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: theme.accent2,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 6,
  },
  title: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  preset: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: theme.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    padding: 10,
  },
  presetText: {
    color: theme.textSoft,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  resultLabel: {
    color: theme.accent,
    fontWeight: '800',
    marginBottom: 8,
    fontSize: 12,
    letterSpacing: 1,
  },
  result: {
    color: theme.textSoft,
    fontSize: 13,
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: theme.panel,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    padding: 14,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileTitle: {
    color: theme.text,
    fontWeight: '700',
    fontSize: 14,
  },
  tileDesc: {
    color: theme.muted,
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
  },
});
