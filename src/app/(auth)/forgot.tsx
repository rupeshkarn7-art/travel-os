import React, { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, EmptyState, Field, Header, Screen } from '../../components/ui';
import { useAuth } from '../../providers/AuthProvider';
import { colors, space, type } from '../../lib/theme';
import { isEmail } from '../../lib/format';
import { friendlyAuthError } from './login';

export default function Forgot() {
  const router = useRouter();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!isEmail(email)) { setErr('Enter a valid email address.'); return; }
    setErr(null); setBusy(true);
    try { await resetPassword(email); setDone(true); }
    catch (e: any) { setErr(friendlyAuthError(e.message)); }
    finally { setBusy(false); }
  };

  if (done) return (
    <Screen scroll={false}>
      <EmptyState icon="mark-email-read" title="Check your inbox" text="If an account exists for that email, we've sent instructions to reset your password." action="Back to login" onAction={() => router.replace('/login')} />
    </Screen>
  );
  return (
    <Screen keyboard>
      <Header onBack={() => (router.canGoBack() ? router.back() : router.replace('/login'))} />
      <Text style={[type.h1, { color: colors.text }]}>Reset your password</Text>
      <Text style={[type.body, { color: colors.muted, marginVertical: space.md }]}>Enter your email and we'll send you a reset link.</Text>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={err} placeholder="you@example.com" onSubmitEditing={submit} />
      <Button title="Send Reset Link" onPress={submit} loading={busy} />
    </Screen>
  );
}
