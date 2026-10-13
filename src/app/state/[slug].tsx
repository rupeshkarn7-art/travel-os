import React, { useMemo, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { Badge, Button, Card, Chip, ChipRow, EmptyState, ErrorState, Header, Icon, Loading, Screen, Section } from '../../components/ui';
import { DestinationCard } from '../../components/DestinationCard';
import { useSearchDestinations, useStatePermits, useStateUT } from '../../hooks/catalogue';
import { colors, space, type, categoryArt } from '../../lib/theme';
import { cap } from '../../lib/format';
import { openUrl } from '../../lib/maps';

const CATS = ['heritage', 'spiritual', 'mountains', 'beaches', 'nature', 'wildlife', 'adventure', 'culture'];

export default function StatePage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const st = useStateUT(slug);
  const [cat, setCat] = useState<string | null>(null);
  const s = st.data;
  const q = useSearchDestinations({ state: s?.id, category: cat }, !!s);
  const permits = useStatePermits(s?.id);
  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const total = q.data?.pages[0]?.total ?? 0;
  const { width } = useWindowDimensions();
  const cols = width >= 720 ? 3 : 2;
  const itemW = (Math.min(width, 1000) - space.lg * 2 - 12 * (cols - 1)) / cols;

  if (st.isLoading) return <Screen><Header /><Loading /></Screen>;
  if (st.isError) return <Screen><Header /><ErrorState onRetry={() => st.refetch()} /></Screen>;
  if (!s) return <Screen><Header /><EmptyState icon="map" title="State not found" action="All states" onAction={() => router.replace('/states')} /></Screen>;
  const mandatory = (permits.data ?? []).filter((p) => p.mandatory);

  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Head>
        <title>{`${s.name} travel guide · Travel OS`}</title>
        <meta name="description" content={s.description ?? `Destinations, permits and trip planning for ${s.name}.`} />
      </Head>
      <Header title={s.name} subtitle={`${s.kind === 'ut' ? 'Union territory' : 'State'}${s.capital ? ` · Capital: ${s.capital}` : ''}`} />
      {s.description ? <Text style={[type.body, { color: colors.text }]}>{s.description}</Text> : null}

      {permits.data?.length ? (
        <Card style={{ marginTop: space.lg, borderColor: mandatory.length ? colors.warning : colors.border }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name="assignment-late" color={mandatory.length ? '#B45309' : colors.primary} />
            <Text style={[type.title, { color: colors.text, flex: 1 }]}>{mandatory.length ? 'Entry permits may be required' : 'Before you go'}</Text>
          </View>
          {permits.data.map((p) => (
            <View key={p.id} style={{ marginTop: 10, gap: 4 }}>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <Text style={[type.small, { color: colors.text, fontWeight: '700' }]}>{p.permit_name}</Text>
                <Badge label={p.mandatory ? 'Mandatory' : 'Recommended'} tone={p.mandatory ? 'error' : 'neutral'} />
                <Badge label={p.status === 'verified' ? `Verified ${p.last_verified ?? ''}` : 'Not yet verified'} tone={p.status === 'verified' ? 'success' : 'warning'} />
              </View>
              <Text style={[type.small, { color: colors.muted }]}>{p.applicable_to}</Text>
              {p.source_url ? <Button title="Official source" icon="open-in-new" variant="ghost" small onPress={() => openUrl(p.source_url)} style={{ alignSelf: 'flex-start' }} /> : null}
            </View>
          ))}
        </Card>
      ) : null}

      {s.tourism_url ? (
        <Button title="State tourism website" icon="open-in-new" variant="secondary" small onPress={() => openUrl(s.tourism_url)} style={{ alignSelf: 'flex-start', marginTop: space.md }} />
      ) : null}

      <Section title={`Destinations (${total})`}>
        <ChipRow>
          <Chip label="All" selected={!cat} onPress={() => setCat(null)} />
          {CATS.map((c) => <Chip key={c} label={cap(c)} icon={categoryArt[c]?.emoji} selected={cat === c} onPress={() => setCat(cat === c ? null : c)} />)}
        </ChipRow>
        <View style={{ height: space.md }} />
        {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : !items.length ? (
          <EmptyState icon="travel-explore" title="Nothing here yet" text="We're still adding destinations for this filter." action="Show all" onAction={() => setCat(null)} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{items.map((d) => <DestinationCard key={d.id} d={d} width={itemW} compact />)}</View>
            {q.hasNextPage ? <Button title="Show more" variant="secondary" loading={q.isFetchingNextPage} onPress={() => q.fetchNextPage()} style={{ marginTop: space.lg }} /> : null}
          </>
        )}
      </Section>
    </Screen>
  );
}
