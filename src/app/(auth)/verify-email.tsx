import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Header, Icon, Screen, useToast } from '../../components/ui';
import { useAuth } from '../../providers/AuthProvider';
import { colors, radius, space, type } from '../../lib/theme';
import { isEmail } from '../../lib/format';
import { friendlyAuthError } from './login';

const COOLDOWN = 60; // seconds between resends (Supabase also rate-limits)

/**
 * Shown after sign-up (and when someone tries to log in before verifying).
 * The account can't be used until the link in the email is opened.
 */
export default function VerifyEmail() {
  const router = useRouter();
  const toast = useToast();
  const { resendVerification } = useAuth();
  const params = useLocalSearchParams<{ email?: string; resend?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const autoSent = useRef(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const resend = async (silentSuccess = false) => {
    if (!isEmail(email)) { setErr('Go back and enter your email again.'); return; }
    setBusy(true); setErr(null);
    try {
      await resendVerification(email);
      setWait(COOLDOWN);
      if (!silentSuccess) toast('Verification email sent', 'success');
    } catch (e: any) {
      setErr(friendlyAuthError(e?.message ?? 'Could not send the email.'));
    } finally { setBusy(false); }
  };

  // Coming from the login screen with an unverified account: send a fresh link straight away.
  useEffect(() => {
    if (params.resend === '1' && !autoSent.current) { autoSent.current = true; resend(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.resend]);

  // Just signed up: the first email is already on its way.
  useEffect(() => { if (params.resend !== '1') setWait(COOLDOWN); }, [params.resend]);

  return (
    <Screen keyboard>
      <Header onBack={() => router.replace('/login')} />
      <View style={{ alignItems: 'center', marginTop: space.xl }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="mark-email-unread" size={36} color={colors.primary} />
        </View>
        <Text style={[type.h2, { color: colors.text, marginTop: space.lg, textAlign: 'center' }]}>Verify your email</Text>
        <Text style={[type.body, { color: colors.muted, marginTop: space.sm, textAlign: 'center', maxWidth: 340 }]}>
          We sent a verification link to
        </Text>
        <Text style={[type.body, { color: colors.text, fontWeight: '700', marginTop: 2, textAlign: 'center' }]} selectable>{email || 'your email'}</Text>
      </View>

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.lg, marginTop: space.xl, gap: space.md }}>
        {[
          ['looks-one', 'Open the email from Travel OS'],
          ['looks-two', 'Tap “Confirm your email”'],
          ['looks-3', 'You’ll be signed in automatically'],
        ].map(([icon, label]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Icon name={icon as any} color={colors.primary} />
            <Text style={[type.body, { color: colors.text, flex: 1 }]}>{label}</Text>
          </View>
        ))}
      </View>

      <Text style={[type.small, { color: colors.muted, marginTop: space.lg, textAlign: 'center' }]}>
        Can’t find it? Check your spam or promotions folder.
      </Text>

      {err ? <Text style={[type.small, { color: colors.error, marginTop: space.md, textAlign: 'center' }]} accessibilityLiveRegion="polite">{err}</Text> : null}

      <Button
        title={wait > 0 ? `Resend email in ${wait}s` : 'Resend verification email'}
        icon="refresh" variant="secondary" onPress={() => resend()} loading={busy} disabled={wait > 0}
        style={{ marginTop: space.lg }}
      />
      <Button title="I’ve verified — Log in" onPress={() => router.replace('/login')} style={{ marginTop: space.md }} />
      <Button title="Wrong email? Sign up again" variant="ghost" onPress={() => router.replace('/register')} style={{ marginTop: space.sm }} />
    </Screen>
  );
}
