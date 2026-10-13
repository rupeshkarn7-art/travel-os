import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, EmptyState, ErrorState, Header, Loading, Screen } from '../components/ui';
import { compareStore, useCompare, useDestinationsByIds } from '../hooks/catalogue';
import type { Destination } from '../lib/types';
import { colors, space, type } from '../lib/theme';
import { cap, inrRange, monthsLabel } from '../lib/format';

const ROWS: [string, (d: Destination) => string][] = [
  ['State / UT', (d) => d.state],
  ['Type', (d) => cap(d.destination_type ?? '—')],
  ['Best months', (d) => monthsLabel(d.best_months) ?? d.best_time ?? '—'],
  ['Suggested stay', (d) => `${d.recommended_days} days`],
  ['Budget / person', (d) => `${inrRange(d.budget_min, d.budget_max)} (indicative)`],
  ['Budget level', (d) => cap(d.budget_tier ?? '—')],
  ['Good for', (d) => d.categories.slice(0, 4).map(cap).join(', ')],
  ['UNESCO', (d) => (d.unesco ? 'Yes' : '—')],
  ['Nearest airport', (d) => d.nearest_airport ?? 'Not listed'],
  ['Rail', (d) => d.nearest_railway ?? 'Not listed'],
  ['Data status', (d) => cap((d.verification_status ?? 'unverified').replace('_', ' '))],
];

export default function Compare() {
  const router = useRouter();
  const ids = useCompare();
  const q = useDestinationsByIds(ids);
  if (!ids.length) {
    return <Screen><Header title="Compare" /><EmptyState icon="compare-arrows" title="Nothing to compare yet" text="Open a destination and tap “Compare” to add up to three." action="Explore" onAction={() => router.replace('/explore')} /></Screen>;
  }
  if (q.isLoading) return <Screen><Header title="Compare" /><Loading /></Screen>;
  if (q.isError) return <Screen><Header title="Compare" /><ErrorState onRetry={() => q.refetch()} /></Screen>;
  const list = q.data ?? [];
  const colW = 170;
  return (
    <Screen>
      <Header title="Compare destinations" right={<Button small variant="ghost" title="Clear" onPress={() => compareStore.clear()} />} />
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', backgroundColor: colors.primaryTint }}>
            <View style={{ width: 120, padding: 10 }} />
            {list.map((d) => (
              <View key={d.id} style={{ width: colW, padding: 10 }}>
                <Text style={[type.title, { color: colors.text }]} numberOfLines={2} onPress={() => router.push(`/destination/${d.id}`)}>{d.name}</Text>
                <Text style={[type.caption, { color: colors.primary }]} onPress={() => compareStore.toggle(d.id)}>Remove</Text>
              </View>
            ))}
          </View>
          {ROWS.map(([label, fn], i) => (
            <View key={label} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: i % 2 ? '#FBFCFE' : colors.surface }}>
              <Text style={[type.caption, { width: 120, padding: 10, color: colors.muted }]}>{label}</Text>
              {list.map((d) => <Text key={d.id} style={[type.small, { width: colW, padding: 10, color: colors.text }]}>{fn(d)}</Text>)}
            </View>
          ))}
        </View>
      </ScrollView>
      <Text style={[type.caption, { color: colors.muted, marginTop: space.md }]}>Budgets are indicative estimates and best months are general climate guidance. Check official sources before booking.</Text>
    </Screen>
  );
}
