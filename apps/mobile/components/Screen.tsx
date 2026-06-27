import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '@/lib/theme';

export function Screen({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </ScrollView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Btn({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable style={[styles.btn, disabled && styles.btnDisabled]} onPress={onPress} disabled={disabled}>
      <Text style={styles.btnText}>{title}</Text>
    </Pressable>
  );
}

export function Field({ value, onChangeText, placeholder, secure }: {
  value: string; onChangeText: (t: string) => void; placeholder: string; secure?: boolean;
}) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.muted}
      secureTextEntry={secure}
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

export function Loader() {
  return <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 40 },
  title: { color: theme.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  card: {
    backgroundColor: theme.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.25)',
    padding: 16,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: theme.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: theme.bg, fontWeight: '700' },
  input: {
    backgroundColor: theme.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.2)',
    color: theme.text,
    padding: 14,
    marginBottom: 12,
  },
  muted: { color: theme.muted, fontSize: 13, marginTop: 8 },
});