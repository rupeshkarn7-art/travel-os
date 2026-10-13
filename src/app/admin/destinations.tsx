import React, { useState } from 'react';
import { Image, Switch, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Chip, ChipRow, ErrorState, Field, Header, Loading, Screen, Sheet, confirmAction, useToast } from '../../components/ui';
import { useAuth } from '../../providers/AuthProvider';
import { supabase } from '../../lib/supabase';
import { colors, space, type } from '../../lib/theme';
import { errMsg, isHttpUrl } from '../../lib/format';
import { useQuery } from '@tanstack/react-query';

const CATS = ['mountains', 'beaches', 'heritage', 'spiritual', 'adventure', 'wildlife', 'family', 'romantic', 'weekend', 'budget', 'luxury'];
const SOURCES = ['official', 'verified', 'community', 'ai'];
const blank = { id: '', name: '', slug: '', state: '', tagline: '', description: '', best_time: '', recommended_days: '3', budget_min: '', budget_max: '', latitude: '', longitude: '', categories: [] as string[], hero_image: '', source_type: 'community', source_url: '', last_verified: '', published: false };

export default function AdminDestinations() {
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [f, setF] = useState<typeof blank | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['admin-destinations'], queryFn: async () => { const { data, error } = await supabase.from('destinations').select('*').order('name'); if (error) throw error; return data as any[]; } });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['admin-destinations'] }), qc.invalidateQueries({ queryKey: ['destinations'] }), qc.invalidateQueries({ queryKey: ['destination'] })]);

  const edit = (d?: any) => { setErr({}); setF(d ? { id: d.id, name: d.name, slug: d.slug, state: d.state, tagline: d.tagline ?? '', description: d.description ?? '', best_time: d.best_time ?? '', recommended_days: String(d.recommended_days), budget_min: d.budget_min != null ? String(d.budget_min) : '', budget_max: d.budget_max != null ? String(d.budget_max) : '', latitude: d.latitude != null ? String(d.latitude) : '', longitude: d.longitude != null ? String(d.longitude) : '', categories: d.categories ?? [], hero_image: d.hero_image ?? '', source_type: d.source_type, source_url: d.source_url ?? '', last_verified: d.last_verified ?? '', published: d.status === 'published' } : { ...blank }); };

  const upload = async () => {
    if (!f) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { toast('Allow photo access to upload.', 'error'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.7, base64: true });
    if (r.canceled || !r.assets[0]?.base64) return;
    setBusy(true);
    try {
      const path = `${f.slug || 'new'}/${Date.now()}.jpg`;
      const up = await supabase.storage.from('destination-images').upload(path, decode(r.assets[0].base64!), { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      setF({ ...f, hero_image: supabase.storage.from('destination-images').getPublicUrl(path).data.publicUrl });
    } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };

  const save = async () => {
    if (!f) return;
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Required';
    if (!/^[a-z0-9-]+$/.test(f.slug)) e.slug = 'Lowercase letters, numbers and hyphens only.';
    if (!f.state.trim()) e.state = 'Required';
    const days = Number(f.recommended_days); if (!(days >= 1 && days <= 30)) e.days = '1–30';
    const lat = f.latitude ? Number(f.latitude) : null; const lng = f.longitude ? Number(f.longitude) : null;
    if ((lat != null && !(lat >= -90 && lat <= 90)) || (lng != null && !(lng >= -180 && lng <= 180))) e.geo = 'Invalid coordinates.';
    if (f.source_url && !isHttpUrl(f.source_url)) e.url = 'Enter a valid http(s) link.';
    if (f.last_verified && !/^\d{4}-\d{2}-\d{2}$/.test(f.last_verified)) e.lv = 'Use YYYY-MM-DD.';
    if (f.published && (f.source_type === 'official' || f.source_type === 'verified') && !f.last_verified) e.lv = 'Add the verification date for official/verified content.';
    setErr(e); if (Object.keys(e).length) return;
    setBusy(true);
    const row = {
      name: f.name.trim(), slug: f.slug.trim(), state: f.state.trim(), tagline: f.tagline || null, description: f.description || null, best_time: f.best_time || null,
      recommended_days: days, budget_min: f.budget_min ? Number(f.budget_min) : null, budget_max: f.budget_max ? Number(f.budget_max) : null,
      latitude: lat, longitude: lng, categories: f.categories, hero_image: f.hero_image || null, source_type: f.source_type, source_url: f.source_url || null,
      last_verified: f.last_verified || null, status: f.published ? 'published' : 'draft',
    };
    const { error } = f.id ? await supabase.from('destinations').update(row).eq('id', f.id) : await supabase.from('destinations').insert(row);
    setBusy(false);
    if (error) { toast(errMsg(error), 'error'); return; }
    await refresh(); setF(null); toast('Saved', 'success');
  };

  const archive = async (d: any) => {
    if (!(await confirmAction('Unpublish destination?', `${d.name} will be hidden from users.`, 'Unpublish'))) return;
    const { error } = await supabase.from('destinations').update({ status: 'archived' }).eq('id', d.id);
    if (error) toast(errMsg(error), 'error'); else refresh();
  };

  if (q.isLoading) return <Screen><Loading /></Screen>;
  if (q.isError) return <Screen><Header title="Destinations" /><ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /></Screen>;
  const set = (k: keyof typeof blank) => (v: string) => setF((p) => (p ? { ...p, [k]: v } : p));
  return (
    <Screen onRefresh={() => q.refetch()}>
      <Header title="Destinations" right={<Button title="New" small icon="add" onPress={() => edit()} />} />
      <View style={{ gap: 10 }}>
        {q.data!.map((d) => (
          <Card key={d.id} onPress={() => edit(d)} accessibilityLabel={`Edit ${d.name}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}><Text style={[type.title, { color: colors.text }]}>{d.name}</Text><Text style={[type.small, { color: colors.muted }]}>{d.state} · {d.source_type}{d.last_verified ? ` · verified ${d.last_verified}` : ' · not verified'}</Text></View>
              <Badge label={d.status} tone={d.status === 'published' ? 'success' : 'neutral'} />
            </View>
            {d.status === 'published' ? <Button title="Unpublish" small variant="ghost" onPress={() => archive(d)} style={{ alignSelf: 'flex-start', marginTop: 6 }} /> : null}
          </Card>
        ))}
      </View>

      <Sheet visible={!!f} onClose={() => setF(null)} title={f?.id ? 'Edit destination' : 'New destination'}>
        {f ? (
          <>
            {f.hero_image ? <Image source={{ uri: f.hero_image }} style={{ height: 120, borderRadius: 12, marginBottom: 8 }} /> : null}
            <Button title={f.hero_image ? 'Replace image' : 'Upload image'} variant="secondary" small icon="image" onPress={upload} loading={busy} />
            <View style={{ height: space.md }} />
            <Field label="Name" value={f.name} onChangeText={set('name')} error={err.name} />
            <Field label="Slug" value={f.slug} onChangeText={set('slug')} autoCapitalize="none" error={err.slug} />
            <Field label="State / region" value={f.state} onChangeText={set('state')} error={err.state} />
            <Field label="Tagline" value={f.tagline} onChangeText={set('tagline')} />
            <Field label="Description" value={f.description} onChangeText={set('description')} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
            <Field label="Best time to visit" value={f.best_time} onChangeText={set('best_time')} />
            <Field label="Recommended days" value={f.recommended_days} onChangeText={set('recommended_days')} keyboardType="number-pad" error={err.days} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><Field label="Budget min (₹)" value={f.budget_min} onChangeText={set('budget_min')} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Field label="Budget max (₹)" value={f.budget_max} onChangeText={set('budget_max')} keyboardType="number-pad" /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><Field label="Latitude" value={f.latitude} onChangeText={set('latitude')} keyboardType="numbers-and-punctuation" error={err.geo} /></View>
              <View style={{ flex: 1 }}><Field label="Longitude" value={f.longitude} onChangeText={set('longitude')} keyboardType="numbers-and-punctuation" /></View>
            </View>
            <Text style={[type.small, { color: colors.text, fontWeight: '600', marginBottom: 8 }]}>Categories</Text>
            <ChipRow>{CATS.map((c) => <Chip key={c} label={c} selected={f.categories.includes(c)} onPress={() => setF({ ...f, categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c] })} />)}</ChipRow>
            <Text style={[type.small, { color: colors.text, fontWeight: '600', marginVertical: 8 }]}>Source type</Text>
            <ChipRow>{SOURCES.map((c) => <Chip key={c} label={c} selected={f.source_type === c} onPress={() => setF({ ...f, source_type: c })} />)}</ChipRow>
            <View style={{ height: space.md }} />
            <Field label="Source link" value={f.source_url} onChangeText={set('source_url')} autoCapitalize="none" error={err.url} />
            <Field label="Last verified (YYYY-MM-DD)" value={f.last_verified} onChangeText={set('last_verified')} error={err.lv} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.lg }}>
              <Text style={[type.body, { color: colors.text }]}>Published</Text>
              <Switch value={f.published} onValueChange={(v) => setF({ ...f, published: v })} trackColor={{ true: colors.primary, false: colors.border }} />
            </View>
            <Button title="Save destination" onPress={save} loading={busy} />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
