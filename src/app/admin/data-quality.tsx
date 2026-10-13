import React from 'react';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card, ErrorState, Header, Loading, Screen, Section, Stat } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { colors, space, type } from '../../lib/theme';
import { cap, errMsg } from '../../lib/format';

type Audit = {
  destinations: number; attractions: number; states_covered: number; unlinked_destinations: number; avg_completeness: number;
  by_status: Record<string, number>; permits_needing_review: number; permits_stale: number; no_attractions: number; missing_coordinates: number;
  possible_duplicates: { name: string; state: string; count: number }[]; per_state: { state: string; destinations: number }[];
};

export default function DataQuality() {
  const q = useQuery({ queryKey: ['catalogue-audit'], queryFn: async () => { const { data, error } = await supabase.rpc('catalogue_audit'); if (error) throw error; return data as Audit; } });
  if (q.isLoading) return <Screen><Header title="Data quality" /><Loading /></Screen>;
  if (q.isError) return <Screen><Header title="Data quality" /><ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /></Screen>;
  const a = q.data!;
  const tiles: [string, string | number][] = [
    ['Destinations', a.destinations], ['Attractions', a.attractions], ['States/UTs covered', `${a.states_covered}/36`], ['Avg completeness', `${a.avg_completeness}%`],
    ['Permits to review', a.permits_needing_review], ['Stale verified permits', a.permits_stale], ['No attractions yet', a.no_attractions], ['Places without coordinates', a.missing_coordinates],
  ];
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Header title="Data quality" subtitle="India catalogue audit" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {tiles.map(([l, v]) => <Card key={l} style={{ width: '48%' }}><Stat label={l} value={String(v)} /></Card>)}
      </View>
      <Section title="Verification status">
        <Card>{Object.entries(a.by_status ?? {}).map(([k, v]) => <Text key={k} style={[type.small, { color: colors.text, paddingVertical: 2 }]}>{cap(k.replace('_', ' '))}: {v}</Text>)}</Card>
      </Section>
      <Section title="Possible duplicates">
        <Card>{a.possible_duplicates.length ? a.possible_duplicates.map((d) => <Text key={d.name + d.state} style={[type.small, { color: colors.error }]}>{d.name} ({d.state}) × {d.count}</Text>)
          : <Text style={[type.small, { color: colors.success }]}>None detected</Text>}</Card>
      </Section>
      <Section title="Coverage by state / UT">
        <Card>
          {a.per_state.map((s) => (
            <View key={s.state} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
              <Text style={[type.small, { color: colors.text }]}>{s.state}</Text>
              <Text style={[type.small, { color: s.destinations ? colors.text : colors.error, fontWeight: '700' }]}>{s.destinations}</Text>
            </View>
          ))}
        </Card>
      </Section>
      <Text style={[type.caption, { color: colors.muted, marginTop: space.md }]}>
        To import or update the catalogue, edit data/india in the repository, run `python3 data/india/build.py`, push, then run
        {' '}`select public.import_india_catalogue_from_url('…/catalogue.json')` in the Supabase SQL editor. Imports are idempotent.
      </Text>
    </Screen>
  );
}
