import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Button, Card, ErrorState, Icon, IconButton, Loading, Screen, Section, Spacer, TrustBadge, VerifyNotice, useToast } from '../../components/ui';
import { HeroArt } from '../../components/HeroArt';
import { PlaceMap } from '../../components/PlaceMap';
import { useAttractions, useDestination, useExperiences, useHotels, useRequirements, useToggleSave } from '../../hooks/data';
import { colors, space, type, placeEmoji } from '../../lib/theme';
import { cap, errMsg, inr, inrRange } from '../../lib/format';
import { openMap, openUrl } from '../../lib/maps';
import { track } from '../../lib/analytics';

function Fact({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 }}>
      <Icon name={icon} color={colors.primary} size={22} />
      <Text style={[type.caption, { color: colors.muted }]}>{label}</Text>
      <Text style={[type.small, { color: colors.text, fontWeight: '600', textAlign: 'center' }]}>{value}</Text>
    </View>
  );
}

function Info({ icon, title, text }: { icon: any; title: string; text?: string | null }) {
  if (!text) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 10 }}>
      <Icon name={icon} color={colors.primary} size={22} />
      <View style={{ flex: 1 }}>
        <Text style={[type.small, { color: colors.text, fontWeight: '700' }]}>{title}</Text>
        <Text style={[type.small, { color: colors.muted, marginTop: 2 }]}>{text}</Text>
      </View>
    </View>
  );
}

export default function DestinationPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const d = useDestination(id);
  const att = useAttractions(id);
  const req = useRequirements(id);
  const hotels = useHotels(id);
  const exps = useExperiences(id);
  const save = useToggleSave();

  useEffect(() => { if (d.data) track('destination_viewed', { destination: d.data.name }); }, [d.data?.id]);

  if (d.isLoading) return <Screen><Loading /></Screen>;
  if (d.isError) return <Screen><ErrorState message={errMsg(d.error)} onRetry={() => d.refetch()} /></Screen>;
  if (!d.data) return <Screen><ErrorState message="This destination is not available." /></Screen>;
  const x = d.data;
  const saved = save.isSaved('destination', x.id);
  const reqCount = (req.data?.documents.filter((r) => r.required).length ?? 0) + (req.data?.permits.filter((r) => r.required).length ?? 0);
  const expired = req.data ? [...req.data.documents, ...req.data.permits].some((r) => r.status === 'expired') : false;
  const markers = [
    ...(x.latitude != null && x.longitude != null ? [{ id: 'dest', title: x.name, lat: x.latitude, lng: x.longitude }] : []),
    ...(att.data ?? []).filter((a) => a.latitude != null).map((a) => ({ id: a.id, title: a.name, lat: a.latitude!, lng: a.longitude! })),
  ];

  const plan = () => { track('plan_trip_clicked', { destination: x.name }); router.push(`/create-trip/${x.id}`); };

  return (
    <Screen pad={false}>
      <HeroArt image={x.hero_image} categories={x.categories} height={240} radius={0} emojiSize={90}>
        <View style={{ position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
          <IconButton name="arrow-back" label="Go back" bg="rgba(255,255,255,0.92)" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <IconButton name={saved ? 'favorite' : 'favorite-border'} label={saved ? 'Remove from saved' : 'Save destination'} bg="rgba(255,255,255,0.92)" color={saved ? colors.error : colors.text}
            onPress={async () => { try { const now = await save.toggle('destination', x.id); toast(now ? 'Saved' : 'Removed from saved', 'success'); if (now) track('destination_saved', { destination: x.name }); } catch (e) { toast(errMsg(e), 'error'); } }} />
        </View>
      </HeroArt>

      <View style={{ paddingHorizontal: space.lg }}>
        <View style={{ marginTop: space.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={[type.h1, { color: colors.text }]}>{x.name}</Text>
            <Text style={[type.body, { color: colors.muted }]}>{x.state}, {x.country}</Text>
          </View>
          {x.rating ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Icon name="star" size={20} color={colors.accent} /><Text style={[type.title, { color: colors.text }]}>{Number(x.rating).toFixed(1)}</Text></View> : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.sm }}>
          {x.categories.slice(0, 4).map((c) => <Badge key={c} label={cap(c)} tone="neutral" />)}
        </View>
        <Button title="Plan Trip" icon="flight-takeoff" onPress={plan} style={{ marginTop: space.lg }} />

        <Card style={{ marginTop: space.lg, flexDirection: 'row' }}>
          <Fact icon="wb-sunny" label="Best time" value={x.best_time?.split(';')[0] ?? '—'} />
          <Fact icon="currency-rupee" label="Budget / person" value={inrRange(x.budget_min, x.budget_max)} />
          <Fact icon="schedule" label="Suggested" value={`${x.recommended_days} days`} />
        </Card>

        <Section title="Overview">
          <Text style={[type.body, { color: colors.text }]}>{x.description}</Text>
          <Text style={[type.caption, { color: colors.muted, marginTop: 6 }]}>Budget is indicative, per person for the suggested duration, excluding long-distance travel to the destination.</Text>
        </Section>

        <Section title="Things to do" action={(att.data?.length ?? 0) > 3 ? 'See all' : undefined} onAction={() => router.push(`/attractions/${x.id}`)}>
          {att.isLoading ? <Loading /> : !att.data?.length ? <Text style={[type.small, { color: colors.muted }]}>Attractions coming soon.</Text> : (
            <View style={{ gap: 10 }}>
              {att.data.slice(0, 4).map((a) => (
                <Card key={a.id} onPress={() => router.push(`/attraction/${a.id}`)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 24 }}>{placeEmoji[a.category] ?? '📍'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.title, { color: colors.text }]} numberOfLines={1}>{a.name}</Text>
                    <Text style={[type.small, { color: colors.muted }]}>{cap(a.category)} · {a.estimated_cost ? inr(a.estimated_cost) : 'Free / varies'} · ~{Math.round(a.duration_minutes / 6) / 10}h</Text>
                  </View>
                  <Icon name="chevron-right" color={colors.faint} />
                </Card>
              ))}
            </View>
          )}
        </Section>

        <Section title="Travel information">
          <Card onPress={() => router.push(`/requirements/${x.id}`)} style={{ borderColor: expired ? colors.error : colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Icon name="assignment-turned-in" color={colors.primary} size={28} />
              <View style={{ flex: 1 }}>
                <Text style={[type.title, { color: colors.text }]}>Documents & permits</Text>
                <Text style={[type.small, { color: colors.muted }]}>{req.isLoading ? 'Loading…' : `${reqCount} required item${reqCount === 1 ? '' : 's'} to check`}</Text>
              </View>
              <Icon name="chevron-right" color={colors.faint} />
            </View>
          </Card>
          <Spacer h={space.sm} />
          <Card>
            <Info icon="directions-bus" title="Getting there & around" text={x.transportation} />
            <Info icon="cloud" title="Weather" text={x.weather} />
            <Info icon="health-and-safety" title="Safety" text={x.safety_information} />
            <Info icon="local-hospital" title="Emergency information" text={x.emergency_information} />
            <Info icon="gavel" title="Local rules" text={x.local_rules} />
          </Card>
        </Section>

        <Section title="About this information">
          <Card>
            <TrustBadge source={x.source_type} status={x.last_verified ? 'verified' : 'needs_review'} lastVerified={x.last_verified} />
            <Spacer h={space.sm} />
            <VerifyNotice lastVerified={x.last_verified} />
            {x.source_url ? <Button title="Open official tourism source" variant="ghost" small icon="open-in-new" onPress={() => openUrl(x.source_url)} style={{ alignSelf: 'flex-start', marginTop: 6 }} /> : null}
          </Card>
        </Section>

        {(hotels.data?.length ?? 0) > 0 ? (
          <Section title="Where to stay">
            <View style={{ gap: 10 }}>
              {hotels.data!.map((h) => (
                <Card key={h.id}>
                  <Text style={[type.title, { color: colors.text }]}>{h.name}</Text>
                  <Text style={[type.small, { color: colors.muted }]}>{h.location} · {h.price_range}</Text>
                  {h.booking_url ? <Button title="View & book on partner site" variant="secondary" small onPress={() => openUrl(h.booking_url)} style={{ marginTop: 8, alignSelf: 'flex-start' }} /> : null}
                </Card>
              ))}
            </View>
          </Section>
        ) : null}
        {(exps.data?.length ?? 0) > 0 ? (
          <Section title="Local experiences">
            <View style={{ gap: 10 }}>
              {exps.data!.map((e) => (
                <Card key={e.id}>
                  <Text style={[type.title, { color: colors.text }]}>{e.name}</Text>
                  <Text style={[type.small, { color: colors.muted }]}>{e.description}</Text>
                  {e.booking_url ? <Button title="Book / contact" variant="secondary" small onPress={() => openUrl(e.booking_url)} style={{ marginTop: 8, alignSelf: 'flex-start' }} /> : null}
                </Card>
              ))}
            </View>
          </Section>
        ) : null}

        {markers.length > 0 ? (
          <Section title="Map">
            <PlaceMap markers={markers} height={220} onSelect={(mid) => { if (mid !== 'dest') router.push(`/attraction/${mid}`); }} />
            <Button title="View route in Maps" variant="secondary" icon="directions" style={{ marginTop: 10 }} onPress={() => { track('external_map_opened', { destination: x.name }); openMap(x.latitude, x.longitude, x.name); }} />
          </Section>
        ) : null}
        <Spacer h={space.xl} />
      </View>
    </Screen>
  );
}
