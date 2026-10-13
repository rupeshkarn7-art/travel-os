import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Chip, ChipRow, ErrorState, Icon, IconButton, Loading, Screen, Section, Sheet, Spacer, TrustBadge, VerifyNotice, useToast } from '../../components/ui';
import { HeroArt } from '../../components/HeroArt';
import { PlaceMap } from '../../components/PlaceMap';
import { upcoming, useAttractions, useDestination, useExperiences, useHotels, useRequirements, useToggleSave, useTrips } from '../../hooks/data';
import { compareStore, useCompare, useNearby } from '../../hooks/catalogue';
import { supabase } from '../../lib/supabase';
import { shareLink } from '../../lib/share';
import { colors, space, type, placeEmoji } from '../../lib/theme';
import { cap, errMsg, inr, inrRange, monthsLabel } from '../../lib/format';
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
  const req = useRequirements(id, d.data?.state_id);
  const near = useNearby(d.data?.latitude, d.data?.longitude, 150, id, 8);
  const compare = useCompare();
  const trips = useTrips();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
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
  const best = monthsLabel(x.best_months) ?? x.best_time?.split(';')[0] ?? '—';
  const inCompare = compare.includes(x.id);
  const myTrips = (trips.data ?? []).filter(upcoming).filter((t) => t.destination_id !== x.id);
  const share = async () => {
    const r = await shareLink(`/destination/${x.id}`, `${x.name} · Travel OS`);
    if (r === 'copied') toast('Link copied', 'success'); else if (r === 'failed') toast('Could not share this link', 'error');
  };
  const addToTrip = async (tripId: string, day: number) => {
    setAdding(true);
    try {
      const it = await supabase.from('itineraries').select('id').eq('trip_id', tripId).order('created_at').limit(1).maybeSingle();
      if (it.error || !it.data) throw new Error('Open the trip once to create its itinerary, then try again.');
      const ins = await supabase.from('itinerary_items').insert({
        itinerary_id: it.data.id, trip_id: tripId, day_number: day, place: x.name, activity: `Side trip: ${x.name}`,
        description: `${x.tagline ?? ''} Travel time from your base is not estimated — check routes before you go.`.trim(),
        latitude: x.latitude, longitude: x.longitude, sort_order: 50, source: 'manual',
      });
      if (ins.error) throw ins.error;
      await qc.invalidateQueries({ queryKey: ['itinerary'] });
      toast(`Added to day ${day}`, 'success');
      setAddOpen(false);
    } catch (e) { toast(errMsg(e), 'error'); } finally { setAdding(false); }
  };

  return (
    <Screen pad={false}>
      <Head>
        <title>{`${x.name}, ${x.state} — travel guide · Travel OS`}</title>
        <meta name="description" content={x.tagline ?? x.description ?? ''} />
        <meta property="og:title" content={`${x.name} · Travel OS`} />
        <meta property="og:description" content={x.tagline ?? ''} />
      </Head>
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
          {x.unesco ? <Badge label="UNESCO World Heritage" tone="accent" icon="account-balance" /> : null}
          {x.destination_type ? <Badge label={cap(x.destination_type)} tone="info" /> : null}
          {x.categories.slice(0, 4).map((c) => <Badge key={c} label={cap(c)} tone="neutral" />)}
        </View>
        {x.state_id ? <Button small variant="ghost" icon="map" title={`More in ${x.state}`} onPress={() => router.push(`/state/${x.state_id}`)} style={{ alignSelf: 'flex-start', marginTop: 4 }} /> : null}
        <Button title="Plan Trip" icon="flight-takeoff" onPress={plan} style={{ marginTop: space.md }} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: space.sm, flexWrap: 'wrap' }}>
          <Button small variant="secondary" icon="share" title="Share" onPress={share} />
          <Button small variant="secondary" icon={inCompare ? 'check' : 'compare-arrows'} title={inCompare ? 'In compare' : 'Compare'}
            onPress={() => { const on = compareStore.toggle(x.id); toast(on ? `Added to compare (${Math.min(compare.length + 1, 3)}/3)` : 'Removed from compare', 'info'); }} />
          {myTrips.length ? <Button small variant="secondary" icon="playlist-add" title="Add to a trip" onPress={() => setAddOpen(true)} /> : null}
          <Button small variant="secondary" icon="calculate" title="Budget" onPress={() => router.push('/budget-calculator')} />
        </View>
        {compare.length > 1 ? <Button small variant="ghost" icon="compare-arrows" title={`Compare ${compare.length} now`} onPress={() => router.push('/compare')} style={{ alignSelf: 'flex-start' }} /> : null}

        <Card style={{ marginTop: space.lg, flexDirection: 'row' }}>
          <Fact icon="wb-sunny" label="Best time" value={best} />
          <Fact icon="currency-rupee" label="Budget / person" value={inrRange(x.budget_min, x.budget_max)} />
          <Fact icon="schedule" label="Suggested" value={`${x.recommended_days} days`} />
        </Card>

        <Section title="Overview">
          <Text style={[type.body, { color: colors.text }]}>{x.description}</Text>
          <Text style={[type.caption, { color: colors.muted, marginTop: 6 }]}>Budget is indicative, per person for the suggested duration, excluding long-distance travel to the destination.</Text>
        </Section>

        {x.highlights?.length || x.food?.length || x.hidden_gems?.length ? (
          <Section title="Why go">
            <Card>
              {x.highlights?.length ? <Info icon="star-outline" title="Highlights" text={x.highlights.join(' · ')} /> : null}
              {x.hidden_gems?.length ? <Info icon="explore" title="Hidden gems nearby" text={x.hidden_gems.join(' · ')} /> : null}
              {x.food?.length ? <Info icon="restaurant" title="Food to try" text={x.food.join(' · ')} /> : null}
            </Card>
          </Section>
        ) : null}

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
            <Info icon="flight" title="Nearest airport" text={x.nearest_airport} />
            <Info icon="train" title="Rail" text={x.nearest_railway} />
            {!x.nearest_airport && !x.nearest_railway ? <Info icon="directions-bus" title="Getting there & around" text={x.transportation ?? 'Transport hubs not listed yet — check road, rail and air options for your route.'} /> : null}
            <Info icon="event" title="When to go" text={`${best}. ${x.season_notes ?? 'General climate guidance, not a forecast.'}`} />
            <Info icon="cloud" title="Weather" text={x.weather} />
            <Info icon="health-and-safety" title="Safety" text={x.safety_information} />
            <Info icon="local-hospital" title="Emergency information" text={x.emergency_information} />
            <Info icon="gavel" title="Local rules" text={x.local_rules} />
          </Card>
        </Section>

        <Section title="About this information">
          <Card>
            <TrustBadge source={x.source_type} status={x.last_verified ? 'verified' : 'needs_review'} lastVerified={x.last_verified} />
            {x.verification_status ? (
              <Text style={[type.caption, { color: colors.muted, marginTop: 8 }]}>
                Status: {cap(x.verification_status.replace('_', ' '))}{x.completeness != null ? ` · ${x.completeness}% complete` : ''}.
                {x.missing_fields?.length ? ` Still to add: ${x.missing_fields.map((m) => m.replace(/_/g, ' ')).join(', ')}.` : ''}
                {' '}Ticket prices, opening hours and closing days are shown only once verified.
              </Text>
            ) : null}
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
        {near.data?.length ? (
          <Section title="Nearby destinations">
            <ChipRow>
              {near.data.map((n) => <Chip key={n.id} label={`${n.name} · ${n.distance_km} km`} onPress={() => router.push(`/destination/${n.id}`)} />)}
            </ChipRow>
            <Text style={[type.caption, { color: colors.muted, marginTop: 6 }]}>Straight-line distance, not road distance.</Text>
          </Section>
        ) : null}
        <Spacer h={space.xl} />
      </View>
      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} title={`Add ${x.name} to a trip`}>
        {myTrips.map((t) => (
          <Card key={t.id} style={{ marginBottom: 10 }}>
            <Text style={[type.title, { color: colors.text }]}>{t.destinations?.name ?? t.title}</Text>
            <Text style={[type.caption, { color: colors.muted, marginBottom: 8 }]}>Choose a day for this side trip</Text>
            <ChipRow>
              {Array.from({ length: t.duration_days }, (_, i) => i + 1).map((day) => (
                <Chip key={day} label={`Day ${day}`} onPress={() => !adding && addToTrip(t.id, day)} />
              ))}
            </ChipRow>
          </Card>
        ))}
      </Sheet>
    </Screen>
  );
}
