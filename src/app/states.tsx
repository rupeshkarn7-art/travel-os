import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { Card, ErrorState, Header, Icon, Loading, Screen, Section } from '../components/ui';
import { useRegions, useStates } from '../hooks/catalogue';
import { colors, space, type, REGION_ART } from '../lib/theme';

export default function StatesScreen() {
  const router = useRouter();
  const regions = useRegions();
  const states = useStates();
  if (regions.isLoading || states.isLoading) return <Screen><Header title="States & union territories" /><Loading /></Screen>;
  if (regions.isError || states.isError) return <Screen><Header title="States & union territories" /><ErrorState onRetry={() => { regions.refetch(); states.refetch(); }} /></Screen>;
  const all = states.data ?? [];
  return (
    <Screen>
      <Head><title>All states and union territories · Travel OS</title></Head>
      <Header title="States & union territories" subtitle={`${all.filter((s) => s.kind === 'state').length} states · ${all.filter((s) => s.kind === 'ut').length} union territories`} />
      {(regions.data ?? []).map((r) => {
        const list = all.filter((s) => s.region_id === r.id);
        if (!list.length) return null;
        return (
          <Section key={r.id} title={`${REGION_ART[r.id]?.emoji ?? ''} ${r.name}`}>
            {r.description ? <Text style={[type.small, { color: colors.muted, marginBottom: space.sm }]}>{r.description}</Text> : null}
            <View style={{ gap: 8 }}>
              {list.map((s) => (
                <Card key={s.id} onPress={() => router.push(`/state/${s.slug}`)} accessibilityLabel={s.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.title, { color: colors.text }]}>{s.name}</Text>
                    <Text style={[type.caption, { color: colors.muted }]} numberOfLines={1}>{s.kind === 'ut' ? 'Union territory' : 'State'}{s.capital ? ` · ${s.capital}` : ''}</Text>
                  </View>
                  <Icon name="chevron-right" color={colors.muted} />
                </Card>
              ))}
            </View>
          </Section>
        );
      })}
    </Screen>
  );
}
