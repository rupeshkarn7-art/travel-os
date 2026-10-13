import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Chip, ChipRow, EmptyState, ErrorState, Header, Icon, Loading, Screen } from '../../components/ui';
import { useAttractions, useDestination } from '../../hooks/data';
import { colors, space, type, placeEmoji } from '../../lib/theme';
import { cap, inr } from '../../lib/format';

export default function Attractions() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const d = useDestination(id);
  const q = useAttractions(id);
  const [cat, setCat] = useState<string | null>(null);
  const cats = Array.from(new Set((q.data ?? []).map((a) => a.category)));
  const list = (q.data ?? []).filter((a) => !cat || a.category === cat);
  return (
    <Screen>
      <Header title="Things to do" subtitle={d.data?.name} />
      {cats.length > 1 ? <ChipRow><Chip label="All" selected={!cat} onPress={() => setCat(null)} />{cats.map((c) => <Chip key={c} label={cap(c)} selected={cat === c} onPress={() => setCat(c)} />)}</ChipRow> : null}
      <View style={{ gap: 10, marginTop: space.lg }}>
        {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : !list.length ? <EmptyState title="Nothing here yet" /> : list.map((a) => (
          <Card key={a.id} onPress={() => router.push(`/attraction/${a.id}`)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 26 }}>{placeEmoji[a.category] ?? '📍'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.title, { color: colors.text }]}>{a.name}</Text>
              <Text style={[type.small, { color: colors.muted }]} numberOfLines={2}>{a.description}</Text>
              <Text style={[type.caption, { color: colors.primary, marginTop: 4 }]}>{cap(a.category)} · {a.estimated_cost ? inr(a.estimated_cost) : 'Free / varies'}</Text>
            </View>
            <Icon name="chevron-right" color={colors.faint} />
          </Card>
        ))}
      </View>
    </Screen>
  );
}
