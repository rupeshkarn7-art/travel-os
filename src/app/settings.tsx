import React, { useState } from 'react';
import { Switch, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Field, Header, Row, Screen, Section, Sheet, confirmAction, useToast } from '../components/ui';
import { useAuth } from '../providers/AuthProvider';
import { supabase } from '../lib/supabase';
import { colors, type } from '../lib/theme';
import { errMsg } from '../lib/format';
import { ensureNotificationPermission } from '../lib/notify';

export default function Settings() {
  const router = useRouter();
  const toast = useToast();
  const { profile, user, refreshProfile, signOut, updatePassword } = useAuth();
  const [pw, setPw] = useState(false);
  const [p1, setP1] = useState(''); const [p2, setP2] = useState(''); const [pe, setPe] = useState('');
  const [busy, setBusy] = useState(false);

  const setPref = async (k: 'notif_push' | 'notif_email' | 'notif_trip_reminders' | 'notif_promos', v: boolean) => {
    if (!user) return;
    if (v && (k === 'notif_push' || k === 'notif_trip_reminders')) await ensureNotificationPermission();
    const { error } = await supabase.from('profiles').update({ [k]: v }).eq('id', user.id);
    if (error) toast(errMsg(error), 'error'); else refreshProfile();
  };
  const sw = (k: any, v?: boolean) => <Switch value={!!v} onValueChange={(x) => setPref(k, x)} trackColor={{ true: colors.primary, false: colors.border }} />;

  const changePw = async () => {
    if (p1.length < 8) { setPe('Use at least 8 characters.'); return; }
    if (p1 !== p2) { setPe('Passwords do not match.'); return; }
    setBusy(true);
    try { await updatePassword(p1); toast('Password updated', 'success'); setPw(false); setP1(''); setP2(''); setPe(''); }
    catch (e) { setPe(errMsg(e)); } finally { setBusy(false); }
  };

  const deleteAccount = async () => {
    if (!(await confirmAction('Delete your account?', 'Your profile, trips, budgets, checklists and saved places are permanently deleted. This cannot be undone.', 'Delete account'))) return;
    if (!user) return;
    try {
      const files = await supabase.storage.from('avatars').list(user.id);
      if (files.data?.length) await supabase.storage.from('avatars').remove(files.data.map((f) => `${user.id}/${f.name}`));
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw error;
      await signOut(); toast('Your account has been deleted', 'success');
    } catch (e) { toast(`Could not delete account: ${errMsg(e)}`, 'error'); }
  };

  return (
    <Screen>
      <Header title="Settings & privacy" />
      <Section title="Notifications">
        <Card style={{ paddingVertical: 4 }}>
          <Row label="Trip reminders" value="Before your trip starts" right={sw('notif_trip_reminders', profile?.notif_trip_reminders)} />
          <Row label="Push notifications" right={sw('notif_push', profile?.notif_push)} />
          <Row label="Email updates" right={sw('notif_email', profile?.notif_email)} />
          <Row label="Offers & news" right={sw('notif_promos', profile?.notif_promos)} />
        </Card>
      </Section>
      <Section title="Security">
        <Card style={{ paddingVertical: 4 }}><Row icon="lock-outline" label="Change password" onPress={() => setPw(true)} /></Card>
      </Section>
      <Section title="Your data">
        <Card style={{ paddingVertical: 4 }}>
          <Row icon="privacy-tip" label="Privacy policy" onPress={() => router.push('/legal/privacy')} />
          <Row icon="delete-forever" label="Delete my account" danger onPress={deleteAccount} />
        </Card>
        <Text style={[type.caption, { color: colors.muted, marginTop: 8 }]}>We store only what the app needs. Deleting your account removes your data from our database.</Text>
      </Section>
      <Sheet visible={pw} onClose={() => setPw(false)} title="Change password">
        <Field label="New password" value={p1} onChangeText={setP1} secureTextEntry autoCapitalize="none" />
        <Field label="Confirm password" value={p2} onChangeText={setP2} secureTextEntry autoCapitalize="none" error={pe} />
        <Button title="Update password" onPress={changePw} loading={busy} />
      </Sheet>
    </Screen>
  );
}
