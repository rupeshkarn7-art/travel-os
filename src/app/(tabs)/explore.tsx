import React, { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Chip, ChipRow, EmptyState, ErrorState, Icon, Loading, Screen } from '../../components/ui';
import { DestinationCard } from '../../components/DestinationCard';
import { useDestinations } from '../../hooks/data';
import { colors, space, type, categoryArt } from '../../lib/theme';
import { cap } from '../../lib/format';

const CATS = ['mountains', 'beaches', 'heritage', 'spiritual', 'adventure', 'wildlife', 'family', 'romantic', 'weekend', 'budget', 'luxury'];

export default function Explore() {
  const router = useRouter();
  const params = useLocalSearchParams<{ cat?: string }>();
  const [cat, setCat] = useState<string | null>(params.cat ?? null);
  React.useEffect(() => { if (params.cat) setCat(params.cat); }, [params.cat]);
  const q = useDestinations({ category: cat });
  const { width } = useWindowDimensions();
  const cols = width >= 720 ? 3 : 2;
  const gap = 12;
  const cw = Math.min(width, 1000) - space.lg * 2;
  const itemW = (cw - gap * (cols - 1)) / cols;

  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Text style={[type.h1, { color: colors.text, paddingTop: space.lg }]}>Explore</Text>
      <Pressable onPress={() => router.push('/search')} accessibilityLabel="Search destinations"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14, minHeight: 48, marginVertical: space.md }}>
        <Icon name="search" color={colors.primary} />
        <Text style={[type.body, { color: colors.faint }]}>Search destination</Text>
      </Pressable>
      <ChipRow>
        <Chip label="All" selected={!cat} onPress={() => setCat(null)} />
        {CATS.map((c) => <Chip key={c} label={cap(c)} icon={categoryArt[c].emoji} selected={cat === c} onPress={() => setCat(c)} />)}
      </ChipRow>
      <View style={{ marginTop: space.lg }}>
        {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : !q.data?.length ? (
          <EmptyState title="No destinations here yet" text="Try another category." action="Show all" onAction={() => setCat(null)} />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
            {q.data.map((d) => <DestinationCard key={d.id} d={d} width={itemW} compact />)}
          </View>
        )}
      </View>
    </Screen>
  );
}
