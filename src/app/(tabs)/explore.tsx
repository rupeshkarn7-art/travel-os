import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Chip, ChipRow, EmptyState, ErrorState, Icon, Loading, Screen, Section, Sheet } from '../../components/ui';
import { DestinationCard } from '../../components/DestinationCard';
import { useCompare, useRegions, useSearchDestinations, useStates } from '../../hooks/catalogue';
import { colors, radius, space, type, categoryArt, REGION_ART } from '../../lib/theme';
import { cap, MONTH_NAMES } from '../../lib/format';
import type { SearchFilters } from '../../lib/types';

const CATS = ['heritage', 'spiritual', 'mountains', 'beaches', 'nature', 'wildlife', 'adventure', 'culture', 'food', 'wellness', 'islands', 'family', 'romantic', 'weekend'];
const TYPES: [string, string][] = [['city', 'Cities'], ['hill_station', 'Hill stations'], ['beach', 'Beaches'], ['heritage_site', 'Heritage sites'], ['pilgrimage', 'Pilgrimage'],
  ['wildlife', 'Wildlife'], ['island', 'Islands'], ['lake', 'Lakes'], ['waterfall', 'Waterfalls'], ['valley', 'Valleys'], ['trek', 'Treks'], ['village', 'Villages']];
const DURATIONS: [number, string][] = [[2, 'Up to 2 days'], [3, 'Up to 3 days'], [5, 'Up to 5 days'], [7, 'Up to a week']];
const TIERS: [string, string][] = [['budget', '₹ Budget'], ['standard', '₹₹ Standard'], ['premium', '₹₹₹ Premium']];

export default function Explore() {
  const router = useRouter();
  const params = useLocalSearchParams<{ cat?: string; region?: string }>();
  const [f, setF] = useState<SearchFilters>({ category: params.cat ?? null, region: params.region ?? null });
  const [sheet, setSheet] = useState(false);
  useEffect(() => { if (params.cat) setF((p) => ({ ...p, category: params.cat })); }, [params.cat]);
  useEffect(() => { if (params.region) setF((p) => ({ ...p, region: params.region })); }, [params.region]);

  const regions = useRegions();
  const states = useStates();
  const q = useSearchDestinations(f);
  const compare = useCompare();
  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const total = q.data?.pages[0]?.total ?? 0;
  const activeCount = [f.region, f.state, f.month, f.maxDays, f.tier, f.type].filter((x) => x != null).length;
  const set = (patch: Partial<SearchFilters>) => setF((p) => ({ ...p, ...patch }));

  const { width } = useWindowDimensions();
  const cols = width >= 720 ? 3 : 2;
  const gap = 12;
  const cw = Math.min(width, 1000) - space.lg * 2;
  const itemW = (cw - gap * (cols - 1)) / cols;
  const stateName = states.data?.find((s) => s.id === f.state)?.name;

  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Text style={[type.h1, { color: colors.text, paddingTop: space.lg }]}>Explore India</Text>
      <Pressable onPress={() => router.push('/search')} accessibilityRole="search" accessibilityLabel="Search destinations"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14, minHeight: 48, marginVertical: space.md }}>
        <Icon name="search" color={colors.primary} />
        <Text style={[type.body, { color: colors.muted }]}>Destination, state, attraction…</Text>
      </Pressable>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button small variant="secondary" icon="map" title="All states" onPress={() => router.push('/states')} />
        <Button small variant="secondary" icon="route" title="Circuits" onPress={() => router.push('/circuits')} />
        <Button small variant="secondary" icon="near-me" title="Near me" onPress={() => router.push('/nearby')} />
        <Button small variant="secondary" icon="calculate" title="Budget" onPress={() => router.push('/budget-calculator')} />
      </View>

      <Section title="Browse by region">
        <ChipRow>
          {(regions.data ?? []).map((r) => {
            const art = REGION_ART[r.id] ?? REGION_ART.north;
            const on = f.region === r.id;
            return (
              <Pressable key={r.id} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={r.name}
                onPress={() => set({ region: on ? null : r.id, state: null })}>
                <LinearGradient colors={art.colors} style={{ width: 118, height: 76, borderRadius: radius.card, padding: 10, justifyContent: 'space-between', borderWidth: on ? 3 : 0, borderColor: colors.accent }}>
                  <Text style={{ fontSize: 22 }}>{art.emoji}</Text>
                  <Text style={[type.small, { color: '#fff', fontWeight: '700' }]} numberOfLines={1}>{r.name.replace(' India', '')}</Text>
                </LinearGradient>
              </Pressable>
            );
          })}
        </ChipRow>
      </Section>

      <View style={{ marginTop: space.lg }}>
        <ChipRow>
          <Chip label={activeCount ? `Filters · ${activeCount}` : 'Filters'} icon="⚙️" selected={activeCount > 0} onPress={() => setSheet(true)} />
          <Chip label="All" selected={!f.category} onPress={() => set({ category: null })} />
          {CATS.map((c) => <Chip key={c} label={cap(c)} icon={categoryArt[c]?.emoji} selected={f.category === c} onPress={() => set({ category: f.category === c ? null : c })} />)}
        </ChipRow>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.lg, marginBottom: space.sm }}>
        <Text style={[type.small, { color: colors.muted }]} accessibilityLiveRegion="polite">
          {q.isLoading ? 'Loading…' : `${total} destination${total === 1 ? '' : 's'}${stateName ? ` in ${stateName}` : ''}`}
        </Text>
        {activeCount || f.category ? <Pressable onPress={() => setF({})} hitSlop={8}><Text style={[type.small, { color: colors.primary, fontWeight: '700' }]}>Clear all</Text></Pressable> : null}
      </View>

      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : !items.length ? (
        <EmptyState icon="travel-explore" title="No destinations match" text="Try removing a filter or choosing another month." action="Clear filters" onAction={() => setF({})} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
            {items.map((d) => <DestinationCard key={d.id} d={d} width={itemW} compact />)}
          </View>
          {q.hasNextPage ? (
            <Button title={q.isFetchingNextPage ? 'Loading…' : `Show more (${total - items.length} left)`} variant="secondary" loading={q.isFetchingNextPage}
              onPress={() => q.fetchNextPage()} style={{ marginTop: space.lg }} />
          ) : null}
        </>
      )}

      {compare.length > 0 ? (
        <Button title={`Compare ${compare.length} selected`} icon="compare-arrows" onPress={() => router.push('/compare')} style={{ marginTop: space.lg }} />
      ) : null}

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Filter destinations">
        <Text style={[type.small, styles.h]}>State / union territory</Text>
        <ChipRow>
          <Chip label="Any" selected={!f.state} onPress={() => set({ state: null })} />
          {(states.data ?? []).filter((s) => !f.region || s.region_id === f.region).map((s) => (
            <Chip key={s.id} label={s.name} selected={f.state === s.id} onPress={() => set({ state: f.state === s.id ? null : s.id })} />
          ))}
        </ChipRow>
        <Text style={[type.small, styles.h]}>Travel month</Text>
        <ChipRow>
          <Chip label="Any" selected={!f.month} onPress={() => set({ month: null })} />
          {MONTH_NAMES.map((m, i) => <Chip key={m} label={m} selected={f.month === i + 1} onPress={() => set({ month: f.month === i + 1 ? null : i + 1 })} />)}
        </ChipRow>
        <Text style={[type.small, styles.h]}>Trip length</Text>
        <ChipRow>
          <Chip label="Any" selected={!f.maxDays} onPress={() => set({ maxDays: null })} />
          {DURATIONS.map(([d, l]) => <Chip key={d} label={l} selected={f.maxDays === d} onPress={() => set({ maxDays: f.maxDays === d ? null : d })} />)}
        </ChipRow>
        <Text style={[type.small, styles.h]}>Budget level</Text>
        <ChipRow>
          <Chip label="Any" selected={!f.tier} onPress={() => set({ tier: null })} />
          {TIERS.map(([k, l]) => <Chip key={k} label={l} selected={f.tier === k} onPress={() => set({ tier: f.tier === k ? null : k })} />)}
        </ChipRow>
        <Text style={[type.small, styles.h]}>Type of place</Text>
        <ChipRow>
          <Chip label="Any" selected={!f.type} onPress={() => set({ type: null })} />
          {TYPES.map(([k, l]) => <Chip key={k} label={l} selected={f.type === k} onPress={() => set({ type: f.type === k ? null : k })} />)}
        </ChipRow>
        <Text style={[type.caption, { color: colors.muted, marginTop: space.md }]}>Month filter uses general climate guidance, not a weather forecast. Budget level is indicative.</Text>
        <Button title={`Show ${total} result${total === 1 ? '' : 's'}`} onPress={() => setSheet(false)} style={{ marginTop: space.lg }} />
      </Sheet>
    </Screen>
  );
}

const styles = { h: { color: colors.text, fontWeight: '700' as const, marginTop: space.lg, marginBottom: 8 } };
