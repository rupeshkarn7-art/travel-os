import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Button, EmptyState, Field, Header, Icon, Screen } from '../../components/ui';
import { useAuth } from '../../providers/AuthProvider';
import { colors, space, type } from '../../lib/theme';
import { isEmail } from '../../lib/format';
import { friendlyAuthError } from './login';

export default function Register() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [v, setV] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [terms, setTerms] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const set = (k: keyof typeof v) => (t: string) => setV((p) => ({ ...p, [k]: t }));

  const submit = async () => {
    const e: Record<string, string> = {};
    if (v.name.trim().length < 2) e.name = 'Please enter your full name.';
    if (!isEmail(v.email)) e.email = 'Enter a valid email address.';
    if (v.phone && !/^\+?[0-9 ]{10,14}$/.test(v.phone.trim())) e.phone = 'Enter a valid mobile number or leave it blank.';
    if (v.password.length < 8 || !/[A-Za-z]/.test(v.password) || !/[0-9]/.test(v.password)) e.password = 'Use at least 8 characters with letters and numbers.';
    if (v.confirm !== v.password) e.confirm = 'Passwords do not match.';
    if (!terms) e.terms = 'Please accept the Terms & Privacy Policy to continue.';
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const r = await signUp(v.name, v.email, v.phone, v.password);
      if (r.needsConfirmation) setSent(true);
    } catch (err: any) {
      setErrs({ form: friendlyAuthError(err.message ?? 'Could not create account.') });
    } finally { setBusy(false); }
  };

  if (sent) {
    return (
      <Screen scroll={false}>
        <EmptyState icon="mark-email-read" title="Check your inbox" text={`We sent a confirmation link to ${v.email.trim()}. Open it, then come back and log in.`} action="Go to login" onAction={() => router.replace('/login')} />
      </Screen>
    );
  }

  return (
    <Screen keyboard>
      <Header onBack={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} />
      <Text style={[type.h1, { color: colors.text, marginBottom: space.xl }]}>Create your account</Text>
      <Field label="Full name" value={v.name} onChangeText={set('name')} autoComplete="name" textContentType="name" error={errs.name} placeholder="Rupesh Karn" />
      <Field label="Email" value={v.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" error={errs.email} placeholder="you@example.com" />
      <Field label="Mobile number (optional)" value={v.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" error={errs.phone} placeholder="+91 98765 43210" />
      <Field
        label="Password" value={v.password} onChangeText={set('password')} secureTextEntry={!show} autoCapitalize="none" textContentType="newPassword" error={errs.password}
        hint="At least 8 characters, with letters and numbers." placeholder="Create a password"
        right={<Pressable onPress={() => setShow(!show)} hitSlop={10} accessibilityLabel={show ? 'Hide password' : 'Show password'}><Icon name={show ? 'visibility-off' : 'visibility'} color={colors.muted} /></Pressable>}
      />
      <Field label="Confirm password" value={v.confirm} onChangeText={set('confirm')} secureTextEntry={!show} autoCapitalize="none" error={errs.confirm} placeholder="Repeat password" />
      <Pressable onPress={() => setTerms(!terms)} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: space.sm }} accessibilityRole="checkbox" accessibilityState={{ checked: terms }}>
        <Icon name={terms ? 'check-box' : 'check-box-outline-blank'} color={terms ? colors.primary : colors.faint} />
        <Text style={[type.small, { color: colors.text, flex: 1 }]}>
          I agree to the <Link href="/legal/terms" style={{ color: colors.primary, fontWeight: '600' }}>Terms</Link> & <Link href="/legal/privacy" style={{ color: colors.primary, fontWeight: '600' }}>Privacy Policy</Link>
        </Text>
      </Pressable>
      {errs.terms ? <Text style={[type.caption, { color: colors.error, marginBottom: space.sm }]}>{errs.terms}</Text> : null}
      {errs.form ? <Text style={[type.small, { color: colors.error, marginVertical: space.sm }]} accessibilityLiveRegion="polite">{errs.form}</Text> : null}
      <Button title="Create Account" onPress={submit} loading={busy} style={{ marginTop: space.md }} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.xl }}>
        <Text style={[type.body, { color: colors.muted }]}>Already have an account?</Text>
        <Link href="/login" style={[type.body, { color: colors.primary, fontWeight: '700' }]}>Login</Link>
      </View>
    </Screen>
  );
}
