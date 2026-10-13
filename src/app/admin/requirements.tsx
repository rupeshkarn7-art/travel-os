import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Chip, ChipRow, ErrorState, Field, Header, Loading, Screen, Sheet, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { colors, space, type } from '../../lib/theme';
import { errMsg, isHttpUrl } from '../../lib/format';

const SOURCES = ['official', 'verified', 'community', 'ai'];
const STATUSES = ['verified', 'needs_review', 'under_review', 'expired', 'community'];

export default function AdminRequirements() {
  const toast = useToast();
  const qc = useQueryClient();
  const [kind, setKind] = useState<'documents' | 'permits'>('permits');
  const [f, setF] = useState<any>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const nameCol = kind === 'documents' ? 'document_name' : 'permit_name';
  const q = useQuery({ queryKey: ['admin-req', kind], queryFn: async () => { const { data, error } = await supabase.from(kind).select('*, destinations(name)').order('status').order('created_at'); if (error) throw error; return data as any[]; } });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['admin-req'] }), qc.invalidateQueries({ queryKey: ['requirements'] }), qc.invalidateQueries({ queryKey: ['admin-stats'] })]);

  const save = async () => {
    const e: Record<string, string> = {};
    if (f.source_url && !isHttpUrl(f.source_url)) e.url = 'Enter a valid http(s) link.';
    if (f.last_verified && !/^\d{4}-\d{2}-\d{2}$/.test(f.last_verified)) e.lv = 'Use YYYY-MM-DD.';
    if (f.status === 'verified' && !(f.last_verified && f.source_url)) e.status = 'Verified items need a source link and verification date.';
    setErr(e); if (Object.keys(e).length) return;
    setBusy(true);
    const { error } = await supabase.from(kind).update({
      description: f.description || null, source: f.source || null, source_url: f.source_url || null, source_type: f.source_type,
      last_verified: f.last_verified || null, status: f.status, required: f.required,
    }).eq('id', f.id);
    setBusy(false);
    if (error) { toast(errMsg(error), 'error'); return; }
    await refresh(); setF(null); toast('Saved', 'success');
  };

  return (
    <Screen onRefresh={() => q.refetch()}>
      <Header title="Documents & permits" />
      <ChipRow><Chip label="Permits" selected={kind === 'permits'} onPress={() => setKind('permits')} /><Chip label="Documents" selected={kind === 'documents'} onPress={() => setKind('documents')} /></ChipRow>
      <View style={{ height: space.md }} />
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /> : (
        <View style={{ gap: 10 }}>
          {q.data!.map((r) => (
            <Card key={r.id} onPress={() => { setErr({}); setF({ ...r }); }} accessibilityLabel={`Edit ${r[nameCol]}`}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}><Text style={[type.body, { color: colors.text, fontWeight: '600' }]}>{r[nameCol]}</Text><Text style={[type.small, { color: colors.muted }]}>{r.destinations?.name} · {r.source_type}</Text></View>
                <Badge label={r.status.replace('_', ' ')} tone={r.status === 'verified' ? 'success' : 'warning'} />
              </View>
            </Card>
          ))}
        </View>
      )}
      <Sheet visible={!!f} onClose={() => setF(null)} title={f ? f[nameCol] : ''}>
        {f ? (
          <>
            <Field label="Description" value={f.description ?? ''} onChangeText={(x) => setF({ ...f, description: x })} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
            <Field label="Source name" value={f.source ?? ''} onChangeText={(x) => setF({ ...f, source: x })} />
            <Field label="Source link" value={f.source_url ?? ''} onChangeText={(x) => setF({ ...f, source_url: x })} autoCapitalize="none" error={err.url} />
            <Field label="Last verified (YYYY-MM-DD)" value={f.last_verified ?? ''} onChangeText={(x) => setF({ ...f, last_verified: x })} error={err.lv} />
            <Text style={[type.small, { color: colors.text, fontWeight: '600', marginBottom: 8 }]}>Source type</Text>
            <ChipRow>{SOURCES.map((c) => <Chip key={c} label={c} selected={f.source_type === c} onPress={() => setF({ ...f, source_type: c })} />)}</ChipRow>
            <Text style={[type.small, { color: colors.text, fontWeight: '600', marginVertical: 8 }]}>Status</Text>
            <ChipRow>{STATUSES.map((c) => <Chip key={c} label={c.replace('_', ' ')} selected={f.status === c} onPress={() => setF({ ...f, status: c })} />)}</ChipRow>
            {err.status ? <Text style={[type.caption, { color: colors.error, marginTop: 6 }]}>{err.status}</Text> : null}
            <View style={{ height: space.lg }} />
            <Button title="Save" onPress={save} loading={busy} />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
