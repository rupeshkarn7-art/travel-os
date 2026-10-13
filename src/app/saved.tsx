import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Card, EmptyState, ErrorState, Header, Loading, Screen, IconButton } from '../components/ui';
import { useSaved, useToggleSave } from '../hooks/data';
import { supabase } from '../lib/supabase';
import { colors, type } from '../lib/theme';
import { errMsg } from '../lib/format';

export default function Saved() {
  const router = useRouter();
  const saved = useSaved();
  const { toggle } = useToggleSave();
  const rows = saved.data ?? [];
  const names = useQuery({
    queryKey: ['saved-names', rows.map((r) => r.id).join(',')],
    enabled: rows.length > 0,
    queryFn: async () => {
      const out: Record<string, { name: string; sub: string }> = {};
      const ids = (t: string) => rows.filter((r) => r.item_type === t).map((r) => r.item_id);
      const d = ids('destination'); const a = ids('attraction');
      if (d.length) (await supabase.from('destinations').select('id,name,state').in('id', d)).data?.forEach((x: any) => (out[x.id] = { name: x.name, sub: x.state ?? 'Destination' }));
      if (a.length) (await supabase.from('attractions').select('id,name,category').in('id', a)).data?.forEach((x: any) => (out[x.id] = { name: x.name, sub: x.category ?? 'Attraction' }));
      return out;
    },
  });
  if (saved.isLoading) return <Screen><Loading /></Screen>;
  if (saved.isError) return <Screen><Header title="Saved" /><ErrorState message={errMsg(saved.error)} onRetry={() => saved.refetch()} /></Screen>;
  return (
    <Screen onRefresh={() => saved.refetch()}>
      <Header title="Saved places" />
      {rows.length === 0 ? <EmptyState icon="favorite-border" title="Nothing saved yet" text="Tap the heart on a destination or place to keep it here." action="Explore destinations" onAction={() => router.push('/explore')} /> : (
        <View style={{ gap: 10 }}>
          {rows.filter((r) => names.data?.[r.item_id]).map((r) => (
            <Card key={r.id} style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => router.push(r.item_type === 'destination' ? `/destination/${r.item_id}` : `/attraction/${r.item_id}`)}>
              <View style={{ flex: 1 }}>
                <Text style={[type.title, { color: colors.text }]}>{names.data![r.item_id].name}</Text>
                <Text style={[type.small, { color: colors.muted }]}>{names.data![r.item_id].sub}</Text>
              </View>
              <IconButton name="favorite" label="Remove from saved" color={colors.error} onPress={() => toggle(r.item_type, r.item_id)} />
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
