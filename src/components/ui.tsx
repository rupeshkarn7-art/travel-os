import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, TextInputProps, View, ViewStyle, StyleProp, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, radius, shadow, space, type } from '../lib/theme';
import { fmtDateLong, parseDate, toISO, todayISO } from '../lib/format';
import type { ReviewStatus, Source } from '../lib/types';

export type IconName = React.ComponentProps<typeof MaterialIcons>['name'];
export const Icon = ({ name, size = 24, color = colors.text }: { name: IconName; size?: number; color?: string }) => (
  <MaterialIcons name={name} size={size} color={color} />
);

/* ---------- layout ---------- */
export function Screen({
  children, scroll = true, onRefresh, refreshing, pad = true, style, bottom = true, keyboard = false,
}: {
  children: React.ReactNode; scroll?: boolean; onRefresh?: () => void; refreshing?: boolean; pad?: boolean;
  style?: StyleProp<ViewStyle>; bottom?: boolean; keyboard?: boolean;
}) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[{ paddingBottom: space.huge * 2 }, pad && { paddingHorizontal: space.lg }, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, pad && { paddingHorizontal: space.lg }, style]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={bottom ? ['top', 'left', 'right'] : ['top', 'left', 'right']}>
      {keyboard ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{content}</KeyboardAvoidingView>
      ) : content}
    </SafeAreaView>
  );
}

export function Header({
  title, subtitle, back = true, right, onBack,
}: { title?: string; subtitle?: string; back?: boolean; right?: React.ReactNode; onBack?: () => void }) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable
          accessibilityLabel="Go back"
          hitSlop={12}
          onPress={() => (onBack ? onBack() : router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.iconBtn}
        >
          <Icon name="arrow-back" />
        </Pressable>
      ) : <View style={{ width: 8 }} />}
      <View style={{ flex: 1 }}>
        {title ? <Text style={[type.title, { color: colors.text }]} numberOfLines={1}>{title}</Text> : null}
        {subtitle ? <Text style={[type.small, { color: colors.muted }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export const Spacer = ({ h = space.lg }: { h?: number }) => <View style={{ height: h }} />;

export function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children?: React.ReactNode }) {
  return (
    <View style={{ marginTop: space.xl }}>
      <View style={styles.sectionHead}>
        <Text style={[type.h3, { color: colors.text }]}>{title}</Text>
        {action ? (
          <Pressable onPress={onAction} hitSlop={8}>
            <Text style={[type.button, { color: colors.primary }]}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string;
}) {
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
        style={({ pressed }) => [styles.card, shadow.card, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, shadow.card, style]}>{children}</View>;
}

/* ---------- actions ---------- */
export function Button({
  title, onPress, variant = 'primary', loading, disabled, icon, style, small,
}: {
  title: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
  loading?: boolean; disabled?: boolean; icon?: IconName; style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const v = {
    primary: { bg: colors.primary, fg: '#fff', bd: colors.primary },
    accent: { bg: colors.accent, fg: '#fff', bd: colors.accent },
    secondary: { bg: colors.surface, fg: colors.primary, bd: colors.primary },
    ghost: { bg: 'transparent', fg: colors.primary, bd: 'transparent' },
    danger: { bg: colors.surface, fg: colors.error, bd: colors.error },
  }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn, small && { minHeight: 40, paddingHorizontal: 14 },
        { backgroundColor: v.bg, borderColor: v.bd, opacity: off ? 0.55 : pressed ? 0.85 : 1 }, style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : (
        <>
          {icon ? <Icon name={icon} size={20} color={v.fg} /> : null}
          <Text style={[type.button, { color: v.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ name, onPress, label, color = colors.text, bg, disabled }: { name: IconName; onPress?: () => void; label: string; color?: string; bg?: string; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}
      disabled={disabled} onPress={onPress} hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, bg ? { backgroundColor: bg } : null, pressed && !disabled && { opacity: 0.6 }]}>
      <Icon name={name} size={22} color={disabled ? colors.faint : color} />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Text style={[type.small, { color: selected ? '#fff' : colors.text, fontWeight: '600' }]}>{icon ? `${icon} ` : ''}{label}</Text>
    </Pressable>
  );
}

export const ChipRow = ({ children }: { children: React.ReactNode }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: 2 }}>{children}</ScrollView>
);

/* ---------- forms ---------- */
export function Field({
  label, error, hint, right, ...props
}: TextInputProps & { label?: string; error?: string | null; hint?: string; right?: React.ReactNode }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: space.lg }}>
      {label ? <Text style={[type.small, styles.label]}>{label}</Text> : null}
      <View style={[styles.input, focus && { borderColor: colors.primary }, !!error && { borderColor: colors.error }]}>
        <TextInput
          placeholderTextColor={colors.faint}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          accessibilityLabel={label}
          {...props}
          style={[{ flex: 1, fontSize: 16, color: colors.text, paddingVertical: 0, minHeight: 48 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null, props.style]}
        />
        {right}
      </View>
      {error ? <Text style={[type.caption, { color: colors.error, marginTop: 4 }]}>{error}</Text> : hint ? <Text style={[type.caption, { color: colors.muted, marginTop: 4 }]}>{hint}</Text> : null}
    </View>
  );
}

export function Stepper({ value, onChange, min = 1, max = 50, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <View style={styles.stepper} accessibilityLabel={label}>
      <IconButton name="remove" label={`Decrease ${label}`} onPress={() => onChange(Math.max(min, value - 1))} bg={colors.primaryTint} color={colors.primary} />
      <Text style={[type.h3, { minWidth: 48, textAlign: 'center', color: colors.text }]}>{value}</Text>
      <IconButton name="add" label={`Increase ${label}`} onPress={() => onChange(Math.min(max, value + 1))} bg={colors.primaryTint} color={colors.primary} />
    </View>
  );
}

export function OptionCard({ label, emoji, selected, onPress, sub }: { label: string; emoji?: string; selected?: boolean; onPress: () => void; sub?: string }) {
  return (
    <Pressable
      accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={onPress}
      style={[styles.option, selected && { borderColor: colors.primary, backgroundColor: colors.primaryTint }]}
    >
      {emoji ? <Text style={{ fontSize: 26 }}>{emoji}</Text> : null}
      <View style={{ flex: 1 }}>
        <Text style={[type.title, { color: colors.text }]}>{label}</Text>
        {sub ? <Text style={[type.small, { color: colors.muted }]}>{sub}</Text> : null}
      </View>
      {selected ? <Icon name="check-circle" color={colors.primary} /> : <Icon name="radio-button-unchecked" color={colors.muted} />}
    </Pressable>
  );
}

/* ---------- date picker (pure JS: works on web + native) ---------- */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function DateField({ label, value, onChange, min, error }: { label: string; value: string | null; onChange: (iso: string) => void; min?: string; error?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: space.lg }}>
      <Text style={[type.small, styles.label]}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)}
        style={[styles.input, !!error && { borderColor: colors.error }]}>
        <Icon name="calendar-month" color={colors.primary} />
        <Text style={[type.body, { flex: 1, marginLeft: 8, color: value ? colors.text : colors.faint }]}>{value ? fmtDateLong(value) : 'Select date'}</Text>
      </Pressable>
      {error ? <Text style={[type.caption, { color: colors.error, marginTop: 4 }]}>{error}</Text> : null}
      <Calendar visible={open} value={value} min={min} onClose={() => setOpen(false)} onPick={(d) => { onChange(d); setOpen(false); }} />
    </View>
  );
}

function Calendar({ visible, value, min, onClose, onPick }: { visible: boolean; value: string | null; min?: string; onClose: () => void; onPick: (iso: string) => void }) {
  const base = value ? parseDate(value) : min ? parseDate(min) : new Date();
  const [view, setView] = useState(new Date(base.getFullYear(), base.getMonth(), 1));
  const minISO = min ?? todayISO();
  const first = view.getDay();
  const dim = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  return (
    <Sheet visible={visible} onClose={onClose} title="Select date">
      <View style={styles.calHead}>
        <IconButton name="chevron-left" label="Previous month" onPress={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} />
        <Text style={[type.title, { color: colors.text }]}>{MONTHS[view.getMonth()]} {view.getFullYear()}</Text>
        <IconButton name="chevron-right" label="Next month" onPress={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} />
      </View>
      <View style={styles.calRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <Text key={i} style={[styles.calCell, type.caption, { color: colors.muted }]}>{d}</Text>)}
      </View>
      <View style={[styles.calRow, { flexWrap: 'wrap' }]}>
        {cells.map((d, i) => {
          if (d == null) return <View key={i} style={styles.calCell} />;
          const iso = toISO(new Date(view.getFullYear(), view.getMonth(), d));
          const disabled = iso < minISO;
          const sel = iso === value;
          return (
            <Pressable key={i} disabled={disabled} onPress={() => onPick(iso)} style={styles.calCell} accessibilityLabel={iso}>
              <View style={[styles.calDay, sel && { backgroundColor: colors.primary }]}>
                <Text style={{ color: sel ? '#fff' : disabled ? colors.border : colors.text, fontWeight: sel ? '700' : '500' }}>{d}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

/* ---------- bottom sheet ---------- */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap} pointerEvents="box-none">
        <View style={[styles.sheet, shadow.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.grab} />
          {title ? <Text style={[type.h3, { color: colors.text, marginBottom: space.md }]}>{title}</Text> : null}
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------- status + trust ---------- */
export function Badge({ label, tone = 'info', icon }: { label: string; tone?: 'info' | 'success' | 'warning' | 'error' | 'accent' | 'neutral'; icon?: IconName }) {
  const t = {
    info: [colors.infoTint, colors.info], success: [colors.successTint, colors.success], warning: [colors.warningTint, '#B45309'],
    error: [colors.errorTint, colors.error], accent: [colors.accentTint, '#C2410C'], neutral: ['#EEF2F6', colors.muted],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t[0] }]}>
      {icon ? <Icon name={icon} size={14} color={t[1]} /> : null}
      <Text style={[type.caption, { color: t[1] }]}>{label}</Text>
    </View>
  );
}

/** Trust model (PRD §61): official / verified / community / AI never look equivalent. */
export function TrustBadge({ source, status, lastVerified }: { source: Source; status?: ReviewStatus; lastVerified?: string | null }) {
  if (status === 'expired') return <Badge tone="error" icon="error-outline" label="Expired — verify before travel" />;
  if (!lastVerified || status === 'needs_review' || status === 'under_review') {
    return <Badge tone="warning" icon="schedule" label={source === 'ai' ? 'Starter info · not yet verified' : 'Needs review'} />;
  }
  if (source === 'official') return <Badge tone="success" icon="verified" label={`Official · verified ${fmtDateLong(lastVerified)}`} />;
  if (source === 'verified' || status === 'verified') return <Badge tone="success" icon="verified-user" label={`Verified ${fmtDateLong(lastVerified)}`} />;
  if (source === 'community') return <Badge tone="neutral" icon="groups" label="Community submitted" />;
  return <Badge tone="accent" icon="auto-awesome" label="AI suggested" />;
}

export function VerifyNotice({ lastVerified, extra }: { lastVerified?: string | null; extra?: string }) {
  return (
    <View style={[styles.notice, { backgroundColor: colors.infoTint }]}>
      <Icon name="info-outline" size={20} color={colors.info} />
      <Text style={[type.small, { flex: 1, color: colors.primaryDark }]}>
        {lastVerified ? `Information last verified: ${fmtDateLong(lastVerified)}. ` : 'This information has not been verified yet. '}
        Verify with the official authority before travel.{extra ? ' ' + extra : ''}
      </Text>
    </View>
  );
}

export function ProgressBar({ value, color = colors.success, height = 8 }: { value: number; color?: string; height?: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: colors.border, overflow: 'hidden' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}>
      <View style={{ width: `${v * 100}%`, height, backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

/* ---------- states ---------- */
export const Loading = ({ label }: { label?: string }) => (
  <View style={styles.center}>
    <ActivityIndicator size="large" color={colors.primary} />
    {label ? <Text style={[type.small, { color: colors.muted, marginTop: 12 }]}>{label}</Text> : null}
  </View>
);

export function EmptyState({ icon = 'explore', title, text, action, onAction }: { icon?: IconName; title: string; text?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.center}>
      <View style={styles.emptyIcon}><Icon name={icon} size={32} color={colors.primary} /></View>
      <Text style={[type.title, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      {text ? <Text style={[type.small, { color: colors.muted, textAlign: 'center', marginTop: 6, maxWidth: 300 }]}>{text}</Text> : null}
      {action ? <Button title={action} onPress={onAction} style={{ marginTop: space.lg }} small /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.errorTint }]}><Icon name="cloud-off" size={32} color={colors.error} /></View>
      <Text style={[type.title, { color: colors.text }]}>Something went wrong</Text>
      <Text style={[type.small, { color: colors.muted, textAlign: 'center', marginTop: 6, maxWidth: 300 }]}>{message ?? 'We could not load this. Please try again.'}</Text>
      {onRetry ? <Button title="Try again" onPress={onRetry} style={{ marginTop: space.lg }} small /> : null}
    </View>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[type.caption, { color: colors.muted }]}>{label}</Text>
      <Text style={[type.title, { color: tone ?? colors.text, marginTop: 2 }]}>{value}</Text>
    </View>
  );
}

export function Row({ icon, label, value, onPress, danger, right }: { icon?: IconName; label: string; value?: string; onPress?: () => void; danger?: boolean; right?: React.ReactNode }) {
  const body = (
    <View style={styles.row}>
      {icon ? <Icon name={icon} color={danger ? colors.error : colors.primary} size={22} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: danger ? colors.error : colors.text }]}>{label}</Text>
        {value ? <Text style={[type.small, { color: colors.muted }]}>{value}</Text> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" color={colors.faint} /> : null)}
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>{body}</Pressable> : body;
}

/* ---------- toast + confirm ---------- */
const ToastCtx = createContext<(msg: string, tone?: 'info' | 'error' | 'success') => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [t, setT] = useState<{ msg: string; tone: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((msg: string, tone: 'info' | 'error' | 'success' = 'info') => {
    setT({ msg, tone });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(null), 3200);
  }, []);
  const bg = t?.tone === 'error' ? colors.error : t?.tone === 'success' ? colors.success : colors.primaryDark;
  const value = useMemo(() => show, [show]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      {t ? (
        <View pointerEvents="none" style={styles.toastWrap}>
          <View style={[styles.toast, { backgroundColor: bg }]} accessibilityLiveRegion="polite">
            <Text style={[type.small, { color: '#fff' }]}>{t.msg}</Text>
          </View>
        </View>
      ) : null}
    </ToastCtx.Provider>
  );
}

export function confirmAction(title: string, message: string, confirmLabel = 'Confirm', destructive = true): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.lg, paddingVertical: space.sm, minHeight: 56 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  btn: { minHeight: 48, borderRadius: radius.button, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  chip: { paddingHorizontal: 14, minHeight: 36, borderRadius: radius.chip, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.text, fontWeight: '600', marginBottom: 6 },
  input: { flexDirection: 'row', alignItems: 'center', minHeight: 50, borderRadius: radius.input, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 10 },
  overlay: { ...StyleSheet.absoluteFill as object, backgroundColor: colors.overlay },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: space.lg, maxHeight: '88%', width: '100%', maxWidth: 640, alignSelf: 'center' },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: space.md },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.chip },
  notice: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.card, alignItems: 'flex-start' },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xxl, flex: 1 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, minHeight: 52 },
  toastWrap: { position: 'absolute', left: 16, right: 16, bottom: 90, alignItems: 'center' },
  toast: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, maxWidth: 480 },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  calRow: { flexDirection: 'row' },
  calCell: { width: '14.2857%', alignItems: 'center', justifyContent: 'center', height: 44, textAlign: 'center' },
  calDay: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
