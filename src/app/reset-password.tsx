import React, { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Field, Header, Screen, useToast } from '../components/ui';
import { useAuth } from '../providers/AuthProvider';
import { colors, space, type } from '../lib/theme';

export default function ResetPassword() {
  const router = useRouter();
  const { updatePassword, clearRecovery, session } = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) { setErr('Use at least 8 characters with letters and numbers.'); return; }
    if (pw !== pw2) { setErr('Passwords do not match.'); return; }
    setBusy(true); setErr(null);
    try { await updatePassword(pw); clearRecovery(); toast('Password updated', 'success'); router.replace('/'); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Screen keyboard>
      <Header back={false} />
      <Text style={[type.h1, { color: colors.text }]}>Choose a new password</Text>
      {!session ? <Text style={[type.small, { color: colors.error, marginVertical: space.md }]}>This reset link is invalid or has expired. Request a new one from the login page.</Text> : null}
      <Field label="New password" value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" />
      <Field label="Confirm new password" value={pw2} onChangeText={setPw2} secureTextEntry autoCapitalize="none" error={err} />
      <Button title="Update password" onPress={submit} loading={busy} disabled={!session} />
    </Screen>
  );
}
