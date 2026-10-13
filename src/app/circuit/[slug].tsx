import React from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { Button, Card, EmptyState, ErrorState, Header, Icon, Loading, Screen, Section, VerifyNotice } from '../../components/ui';
import { PlaceMap } from '../../components/PlaceMap';
import { useCircuit } from '../../hooks/catalogue';
import { colors, space, type } from '../../lib/theme';
import { monthsLabel } from '../../lib/format';
import { shareLink } from '../../lib/share';

export default function CircuitPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const q = useCircuit(slug);
  if (q.isLoading) return <Screen><Header /><Loading /></Screen>;
  if (q.isError) return <Screen><Header /><ErrorState onRetry={() => q.refetch()} /></Screen>;
  const c = q.data;
  if (!c) return <Screen><Header /><EmptyState icon="route" title="Circuit not found" action="All circuits" onAction={() => router.replace('/circuits')} /></Screen>;
  const stops = c.circuit_stops ?? [];
  const markers = stops.filter((s) => s.destinations?.latitude != null)
    .map((s) => ({ id: s.destinations.id, title: `${s.stop_order}. ${s.destinations.name}`, lat: s.destinations.latitude!, lng: s.destinations.longitude! }));

  return (
    <Screen>
      <Head><title>{`${c.name} itinerary · Travel OS`}</title><meta name="description" content={c.description ?? ''} /></Head>
      <Header title={c.name} subtitle={`${c.days} days${monthsLabel(c.best_months) ? ` · Best ${monthsLabel(c.best_months)}` : ''}`}
        right={<Button small variant="ghost" icon="share" title="Share" onPress={() => shareLink(`/circuit/${c.slug}`, c.name)} />} />
      <Text style={[type.body, { color: colors.text }]}>{c.description}</Text>
      {markers.length > 1 ? <View style={{ marginTop: space.lg }}><PlaceMap markers={markers} height={240} onSelect={(id) => router.push(`/destination/${id}`)} /></View> : null}
      <Section title="Route">
        <View style={{ gap: 10 }}>
          {stops.map((s) => (
            <Card key={s.stop_order} onPress={() => router.push(`/destination/${s.destinations.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[type.small, { color: colors.primary, fontWeight: '700' }]}>{s.stop_order}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.title, { color: colors.text }]}>{s.destinations.name}</Text>
                <Text style={[type.small, { color: colors.muted }]}>{s.destinations.state} · {s.nights ? `${s.nights} night${s.nights > 1 ? 's' : ''}` : 'Day visit'}</Text>
              </View>
              <Icon name="chevron-right" color={colors.muted} />
            </Card>
          ))}
        </View>
      </Section>
      <View style={{ marginTop: space.lg }}>
        <VerifyNotice lastVerified={null} extra="Travel times between stops are not estimated here — check road, rail and flight options for your dates." />
      </View>
      {stops[0] ? <Button title={`Start planning from ${stops[0].destinations.name}`} icon="flight-takeoff" onPress={() => router.push(`/create-trip/${stops[0].destinations.id}`)} style={{ marginTop: space.lg }} /> : null}
    </Screen>
  );
}
