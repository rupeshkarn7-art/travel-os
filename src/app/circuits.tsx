import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { Card, Chip, ChipRow, EmptyState, ErrorState, Header, Icon, Loading, Screen } from '../components/ui';
import { useCircuits, useRegions } from '../hooks/catalogue';
import { colors, space, type } from '../lib/theme';
import { monthsLabel } from '../lib/format';

export default function Circuits() {
  const router = useRouter();
  const [region, setRegion] = useState<string | null>(null);
  const regions = useRegions();
  const q = useCircuits(region);
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Head><title>Travel circuits and road trips in India · Travel OS</title></Head>
      <Header title="Travel circuits" subtitle="Multi-stop routes you can plan stop by stop" />
      <ChipRow>
        <Chip label="All regions" selected={!region} onPress={() => setRegion(null)} />
        {(regions.data ?? []).map((r) => <Chip key={r.id} label={r.name} selected={region === r.id} onPress={() => setRegion(region === r.id ? null : r.id)} />)}
      </ChipRow>
      <View style={{ height: space.lg }} />
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <EmptyState icon="route" title="No circuits in this region yet" action="Show all" onAction={() => setRegion(null)} />
      ) : (
        <View style={{ gap: 12 }}>
          {q.data.map((c) => (
            <Card key={c.id} onPress={() => router.push(`/circuit/${c.slug}`)} accessibilityLabel={c.name}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon name="route" color={colors.primary} />
                <Text style={[type.title, { color: colors.text, flex: 1 }]}>{c.name}</Text>
                <Text style={[type.small, { color: colors.primary, fontWeight: '700' }]}>{c.days} days</Text>
              </View>
              <Text style={[type.small, { color: colors.muted, marginTop: 6 }]}>{c.description}</Text>
              <Text style={[type.caption, { color: colors.text, marginTop: 8 }]} numberOfLines={2}>
                {(c.circuit_stops ?? []).map((s) => s.destinations?.name).filter((v, i, arr) => arr.indexOf(v) === i).join(' → ')}
              </Text>
              {monthsLabel(c.best_months) ? <Text style={[type.caption, { color: colors.muted, marginTop: 4 }]}>Best: {monthsLabel(c.best_months)}</Text> : null}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
