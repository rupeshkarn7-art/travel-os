import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, ErrorState, Icon, ProgressBar, Screen, Section } from '../../components/ui';
import { DestinationCard } from '../../components/DestinationCard';
import { HeroArt } from '../../components/HeroArt';
import { useAuth } from '../../providers/AuthProvider';
import { readiness, upcoming, useChecklist, useDestinations, useItinerary, useNotifications, useTrips } from '../../hooks/data';
import { colors, space, type, categoryArt } from '../../lib/theme';
import { cap, fmtRange, greeting } from '../../lib/format';

const CATS = ['mountains', 'beaches', 'adventure', 'heritage', 'spiritual', 'romantic'];

export default function Home() {
  const router = useRouter();
  const { profile } = useAuth();
  const dest = useDestinations({ limit: 8 });
  const trips = useTrips();
  const notes = useNotifications();
  const next = trips.data?.filter(upcoming)[0];
  const unread = notes.data?.filter((n) => !n.read).length ?? 0;
  const first = (profile?.full_name ?? '').split(' ')[0];
  const refreshing = dest.isRefetching || trips.isRefetching;
  const refetch = () => { dest.refetch(); trips.refetch(); notes.refetch(); };

  const recommended = React.useMemo(() => {
    const list = dest.data ?? [];
    const styles = (profile?.travel_styles ?? []).map((s) => s.toLowerCase());
    const map: Record<string, string[]> = {
      adventure: ['adventure', 'mountains'], relaxed: ['beaches', 'weekend'], backpacking: ['budget', 'adventure'],
      romantic: ['romantic'], family: ['family'], budget: ['budget'], premium: ['luxury'], spiritual: ['spiritual'],
    };
    const want = new Set(styles.flatMap((s) => map[s] ?? []));
    const scored = list.map((d) => ({ d, s: d.categories.filter((c) => want.has(c)).length }));
    return scored.sort((a, b) => b.s - a.s || b.d.popularity - a.d.popularity).slice(0, 5).map((x) => x.d);
  }, [dest.data, profile]);

  return (
    <Screen onRefresh={refetch} refreshing={refreshing}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.lg }}>
        <View style={{ flex: 1 }}>
          <Text style={[type.small, { color: colors.muted }]}>{greeting()}{first ? `, ${first}` : ''}</Text>
          <Text style={[type.h1, { color: colors.text }]}>Where do you want to go?</Text>
        </View>
        <Pressable onPress={() => router.push('/notifications')} accessibilityLabel="Notifications" hitSlop={10} style={{ padding: 8 }}>
          <Icon name="notifications-none" size={26} />
          {unread > 0 ? <View style={{ position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{unread > 9 ? '9+' : unread}</Text></View> : null}
        </Pressable>
      </View>

      <Pressable onPress={() => router.push('/search')} accessibilityRole="search" accessibilityLabel="Search destination"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14, minHeight: 52, marginTop: space.lg }}>
        <Icon name="search" color={colors.primary} />
        <Text style={[type.body, { color: colors.faint }]}>Search destination</Text>
      </Pressable>

      <Section title="Your upcoming trip">
        {trips.isLoading ? null : next ? (
          <TripHero tripId={next.id} />
        ) : (
          <Card>
            <Text style={[type.title, { color: colors.text }]}>No trip planned yet</Text>
            <Text style={[type.small, { color: colors.muted, marginVertical: 6 }]}>Pick a destination and get a day-wise plan, budget and checklist in minutes.</Text>
            <Button title="Plan a trip" icon="flight-takeoff" onPress={() => router.push('/search')} small style={{ alignSelf: 'flex-start' }} />
          </Card>
        )}
      </Section>

      <Section title="Explore destinations">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {CATS.map((c) => (
            <Pressable key={c} onPress={() => router.push({ pathname: '/explore', params: { cat: c } })} accessibilityLabel={cap(c)}
              style={{ alignItems: 'center', gap: 6, width: 78 }}>
              <View style={{ width: 62, height: 62, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 28 }}>{categoryArt[c].emoji}</Text>
              </View>
              <Text style={[type.caption, { color: colors.text }]}>{cap(c)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Section>

      <Section title="Popular destinations" action="See all" onAction={() => router.push('/explore')}>
        {dest.isLoading ? <Text style={[type.small, { color: colors.muted }]}>Loading…</Text> : dest.isError ? <ErrorState onRetry={() => dest.refetch()} /> : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {dest.data?.slice(0, 6).map((d) => <DestinationCard key={d.id} d={d} width={220} />)}
          </ScrollView>
        )}
      </Section>

      {recommended.length > 0 ? (
        <Section title="Travel inspiration">
          <Text style={[type.small, { color: colors.muted, marginTop: -6, marginBottom: 10 }]}>{(profile?.travel_styles?.length ?? 0) > 0 ? 'Picked for your travel style' : 'Handpicked for you'}</Text>
          <View style={{ gap: 12 }}>
            {recommended.slice(0, 3).map((d) => (
              <Card key={d.id} onPress={() => router.push(`/destination/${d.id}`)} style={{ flexDirection: 'row', gap: 12, padding: 10, alignItems: 'center' }}>
                <HeroArt image={d.hero_image} categories={d.categories} height={72} radius={12} style={{ width: 72 }} emojiSize={30} />
                <View style={{ flex: 1 }}>
                  <Text style={[type.title, { color: colors.text }]}>{d.name}</Text>
                  <Text style={[type.small, { color: colors.muted }]} numberOfLines={2}>{d.tagline}</Text>
                </View>
                <Icon name="chevron-right" color={colors.faint} />
              </Card>
            ))}
          </View>
        </Section>
      ) : null}
      {!dest.isLoading && !dest.data?.length ? <EmptyState title="No destinations yet" text="Destinations will appear here once published." /> : null}
    </Screen>
  );
}

function TripHero({ tripId }: { tripId: string }) {
  const router = useRouter();
  const trips = useTrips();
  const trip = trips.data?.find((t) => t.id === tripId)!;
  const checklist = useChecklist(tripId);
  const itin = useItinerary(tripId);
  const score = readiness(trip, checklist.data, itin.data?.length ?? 0);
  return (
    <Card onPress={() => router.push(`/trip/${tripId}`)} style={{ padding: 0, overflow: 'hidden' }}>
      <HeroArt image={trip.destinations?.hero_image} categories={trip.destinations?.categories} height={92} radius={0} />
      <View style={{ padding: space.lg }}>
        <Text style={[type.h3, { color: colors.text }]}>{trip.destinations?.name}</Text>
        <Text style={[type.small, { color: colors.muted }]}>{fmtRange(trip.start_date, trip.end_date)} · {trip.travellers} traveller{trip.travellers > 1 ? 's' : ''}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md, marginBottom: 6 }}>
          <Text style={[type.caption, { color: colors.muted }]}>Travel readiness</Text>
          <Text style={[type.caption, { color: colors.success }]}>{score}%</Text>
        </View>
        <ProgressBar value={score / 100} />
        <Button title="Continue Planning" onPress={() => router.push(`/trip/${tripId}`)} small style={{ marginTop: space.md }} />
      </View>
    </Card>
  );
}
