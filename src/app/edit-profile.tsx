import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { Button, Field, Header, Screen, useToast } from '../components/ui';
import { useAuth } from '../providers/AuthProvider';
import { supabase } from '../lib/supabase';
import { colors, space, type } from '../lib/theme';
import { errMsg } from '../lib/format';

export default function EditProfile() {
  const router = useRouter();
  const toast = useToast();
  const { profile, user, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar_url ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ name?: string; phone?: string }>({});

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { toast('Allow photo access in settings to choose a picture.', 'error'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true });
    if (r.canceled || !r.assets[0]?.base64 || !user) return;
    const a = r.assets[0];
    if ((a.base64!.length * 3) / 4 > 5 * 1024 * 1024) { toast('Image is too large (max 5 MB).', 'error'); return; }
    setBusy(true);
    try {
      const path = `${user.id}/avatar-${Date.now()}.jpg`;
      const up = await supabase.storage.from('avatars').upload(path, decode(a.base64!), { contentType: 'image/jpeg', upsert: true });
      if (up.error) throw up.error;
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
      if (error) throw error;
      setAvatar(url); await refreshProfile(); toast('Photo updated', 'success');
    } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };

  const save = async () => {
    const e: typeof err = {};
    if (name.trim().length < 2) e.name = 'Enter your name.';
    if (phone && !/^[+0-9 ()-]{7,16}$/.test(phone.trim())) e.phone = 'Enter a valid phone number.';
    setErr(e); if (Object.keys(e).length || !user) return;
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ full_name: name.trim(), phone: phone.trim() || null }).eq('id', user.id);
    setBusy(false);
    if (error) { toast(errMsg(error), 'error'); return; }
    await refreshProfile(); toast('Profile saved', 'success'); router.back();
  };

  return (
    <Screen keyboard>
      <Header title="Edit profile" />
      <Pressable onPress={pick} accessibilityRole="button" accessibilityLabel="Change profile photo" style={{ alignSelf: 'center', marginVertical: space.lg, alignItems: 'center' }}>
        {avatar ? <Image source={{ uri: avatar }} style={{ width: 96, height: 96, borderRadius: 48 }} /> : <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}><Text style={[type.h1, { color: colors.primary }]}>{(name || user?.email || '?')[0].toUpperCase()}</Text></View>}
        <Text style={[type.small, { color: colors.primary, marginTop: 8 }]}>Change photo</Text>
      </Pressable>
      <Field label="Full name" value={name} onChangeText={setName} error={err.name} autoCapitalize="words" />
      <Field label="Phone (optional)" value={phone} onChangeText={setPhone} error={err.phone} keyboardType="phone-pad" />
      <Field label="Email" value={user?.email ?? ''} editable={false} />
      <Button title="Save" onPress={save} loading={busy} />
    </Screen>
  );
}
