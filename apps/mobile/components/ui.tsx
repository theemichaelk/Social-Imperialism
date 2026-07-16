import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
  TextStyle,
  RefreshControl,
} from 'react-native';
import { theme } from '@/lib/theme';

export function Screen({
  children,
  title,
  subtitle,
  refreshing,
  onRefresh,
  right,
  noPad,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  right?: ReactNode;
  noPad?: boolean;
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, noPad && { paddingHorizontal: 0 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh
          ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
          : undefined
      }
    >
      {(title || right) ? (
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  style,
  accent,
}: {
  children: ReactNode;
  style?: ViewStyle;
  accent?: 'cyan' | 'purple' | 'none';
}) {
  const borderColor =
    accent === 'purple'
      ? theme.panelBorderStrong
      : accent === 'none'
        ? 'transparent'
        : theme.panelBorder;
  return (
    <View style={[styles.card, { borderColor }, style]}>
      {children}
    </View>
  );
}

export function Btn({
  title,
  onPress,
  disabled,
  variant = 'primary',
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'purple' | 'danger';
  style?: ViewStyle;
}) {
  const bg =
    variant === 'ghost'
      ? 'transparent'
      : variant === 'purple'
        ? theme.accent2
        : variant === 'danger'
          ? theme.danger
          : theme.accent;
  const color = variant === 'ghost' ? theme.accent : theme.bg;
  return (
    <Pressable
      style={[
        styles.btn,
        { backgroundColor: bg, borderColor: variant === 'ghost' ? theme.panelBorder : 'transparent' },
        disabled && styles.btnDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.btnText, { color }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({
  value,
  onChangeText,
  placeholder,
  secure,
  multiline,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  secure?: boolean;
  multiline?: boolean;
}) {
  return (
    <TextInput
      style={[styles.input, multiline && { minHeight: 110, textAlignVertical: 'top' }]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.muted}
      secureTextEntry={secure}
      autoCapitalize="none"
      autoCorrect={false}
      multiline={multiline}
    />
  );
}

export function Loader({ label }: { label?: string }) {
  return (
    <View style={styles.loader}>
      <ActivityIndicator color={theme.accent} size="large" />
      {label ? <Text style={styles.loaderLabel}>{label}</Text> : null}
    </View>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionLabel}>{children}</Text>
      {right}
    </View>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorBody}>{message}</Text>
      {onRetry ? <Btn title="Retry" onPress={onRetry} variant="ghost" style={{ marginTop: 8 }} /> : null}
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 48 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 10,
  },
  title: { color: theme.text, fontSize: 24, fontWeight: '800', letterSpacing: 0.2 },
  subtitle: { color: theme.muted, fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: theme.panel,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    padding: 16,
    marginBottom: 12,
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontWeight: '800', fontSize: 14 },
  input: {
    backgroundColor: theme.panelSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    color: theme.text,
    padding: 14,
    marginBottom: 12,
    fontSize: 15,
  },
  loader: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  loaderLabel: { color: theme.muted, marginTop: 12, fontSize: 13 },
  muted: { color: theme.muted, fontSize: 13, lineHeight: 18 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 6,
  },
  sectionLabel: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 92, 122, 0.1)',
    borderColor: 'rgba(255, 92, 122, 0.35)',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 12,
  },
  errorTitle: { color: theme.danger, fontWeight: '800', marginBottom: 4 },
  errorBody: { color: theme.textSoft, fontSize: 13, lineHeight: 18 },
  empty: {
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: { color: theme.text, fontWeight: '700', fontSize: 16 },
  emptyBody: { color: theme.muted, textAlign: 'center', marginTop: 6, fontSize: 13, lineHeight: 18 },
});
