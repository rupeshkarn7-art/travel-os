import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Button, Field, Header, Icon, Screen, useToast } from '../../components/ui';
import { useAuth } from '../../providers/AuthProvider';
import { colors, space, type } from '../../lib/theme';
import { isEmail } from '../../lib/format';

export function friendlyAuthError(msg: string) {
  if (/invalid login credentials/i.test(msg)) return 'Incorrect email or password.';
  if (/email not confirmed/i.test(msg)) return 'Please confirm your email first — check your inbox for the link.';
  if (/already registered|already been registered/i.test(msg)) return 'An account with this email already exists. Try logging in.';
  if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Please wait a few minutes and try again.';
  if (/Failed to fetch|network/i.test(msg)) return 'No internet connection. Please try again.';
  if (/password/i.test(msg) && /weak|least|short/i.test(msg)) return 'Choose a stronger password (8+ characters with letters and numbers).';
  return msg;
}

export default function Login() {
  const router = useRouter();
  const { signIn, signInWithGoogle } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<{ email?: string; password?: string; form?: string }>({});

  const submit = async () => {
    const e: typeof errs = {};
    if (!isEmail(email)) e.email = 'Enter a valid email address.';
    if (!password) e.password = 'Enter your password.';
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      setErrs({ form: friendlyAuthError(err.message ?? 'Could not sign in.') });
    } finally { setBusy(false); }
  };

  return (
    <Screen keyboard>
      <Header title="" onBack={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} />
      <Text style={[type.h1, { color: colors.text }]}>Welcome back</Text>
      <Text style={[type.body, { color: colors.muted, marginBottom: space.xl }]}>Continue your travel planning.</Text>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" error={errs.email} placeholder="you@example.com" />
      <Field
        label="Password" value={password} onChangeText={setPassword} secureTextEntry={!show} autoCapitalize="none" autoComplete="password" textContentType="password"
        error={errs.password} placeholder="Your password" onSubmitEditing={submit}
        right={<Pressable onPress={() => setShow(!show)} hitSlop={10} accessibilityLabel={show ? 'Hide password' : 'Show password'}><Icon name={show ? 'visibility-off' : 'visibility'} color={colors.muted} /></Pressable>}
      />
      <Link href="/forgot" style={[type.small, { color: colors.primary, fontWeight: '600', alignSelf: 'flex-end', marginTop: -8, marginBottom: space.lg }]}>Forgot password?</Link>
      {errs.form ? <Text style={[type.small, { color: colors.error, marginBottom: space.md }]} accessibilityLiveRegion="polite">{errs.form}</Text> : null}
      <Button title="Login" onPress={submit} loading={busy} />
      {process.env.EXPO_PUBLIC_ENABLE_GOOGLE === 'true' ? (
        <>
          <Text style={[type.small, { color: colors.muted, textAlign: 'center', marginVertical: space.lg }]}>──────── OR ────────</Text>
          <Button title="Continue with Google" variant="secondary" icon="login" onPress={() => signInWithGoogle().catch((e) => toast(e.message, 'error'))} />
        </>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.xl }}>
        <Text style={[type.body, { color: colors.muted }]}>Don't have an account?</Text>
        <Link href="/register" style={[type.body, { color: colors.primary, fontWeight: '700' }]}>Create account</Link>
      </View>
    </Screen>
  );
}
