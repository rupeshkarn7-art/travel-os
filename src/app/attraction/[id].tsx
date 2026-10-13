import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, ErrorState, Header, Icon, IconButton, Loading, Screen, Section, Sheet, OptionCard, Chip, ChipRow, useToast } from '../../components/ui';
import { PlaceMap } from '../../components/PlaceMap';
import { upcoming, useAttraction, useToggleSave, useTrips } from '../../hooks/data';
import { supabase } from '../../lib/supabase';
import { colors, space, type, placeEmoji } from '../../lib/theme';
import { addDays, cap, errMsg, fmtRange, fmtTime, inr } from '../../lib/format';
import { openDirections, openMap } from '../../lib/maps';
import { track } from '../../lib/analytics';

export default function AttractionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useAttraction(id);
  const trips = useTrips();
  const save = useToggleSave();
  const [open, setOpen] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const [day, setDay] = useState(1);
  const [busy, setBusy] = useState(false);

  if (q.isLoading) return <Screen><Loading /></Screen>;
  if (q.isError || !q.data) return <Screen><Header /><ErrorState message={q.isError ? errMsg(q.error) : 'Place not found.'} onRetry={() => q.refetch()} /></Screen>;
  const a = q.data;
  const matching = (trips.data ?? []).filter((t) => upcoming(t) && t.destination_id === a.destination_id);
  const chosen = matching.find((t) => t.id === tripId);

  const add = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      const { data: it, error: e1 } = await supabase.from('itineraries').select('id').eq('trip_id', chosen.id).order('created_at').limit(1).maybeSingle();
      if (e1) throw e1;
      let itId = it?.id as string | undefined;
      if (!itId) {
        const { data: n, error: e2 } = await supabase.from('itineraries').insert({ trip_id: chosen.id }).select('id').single();
        if (e2) throw e2;
        itId = n.id;
      }
      const { data: last } = await supabase.from('itinerary_items').select('sort_order').eq('itinerary_id', itId).eq('day_number', day).order('sort_order', { ascending: false }).limit(1).maybeSingle();
      const { error } = await supabase.from('itinerary_items').insert({
        itinerary_id: itId, trip_id: chosen.id, attraction_id: a.id, day_number: day, date: addDays(chosen.start_date, day - 1),
        start_time: '10:00', end_time: null, place: a.name, activity: `Visit ${a.name}`, description: a.description,
        estimated_cost: (a.estimated_cost ?? 0) * chosen.travellers, latitude: a.latitude, longitude: a.longitude,
        sort_order: (last?.sort_order ?? 0) + 1, source: 'manual',
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['itinerary'] });
      track('itinerary_updated', { via: 'add_to_trip' });
      setOpen(false);
      toast(`Added to Day ${day}`, 'success');
    } catch (e) { toast(errMsg(e), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <Header title={a.name} right={
        <IconButton name={save.isSaved('attraction', a.id) ? 'bookmark' : 'bookmark-border'} label="Save place" color={colors.primary}
          onPress={async () => { try { const now = await save.toggle('attraction', a.id); toast(now ? 'Place saved' : 'Removed from saved', 'success'); if (now) track('place_saved', { place: a.name }); } catch (e) { toast(errMsg(e), 'error'); } }} />
      } />
      <View style={{ height: 150, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 72 }}>{placeEmoji[a.category] ?? '📍'}</Text>
      </View>
      <Text style={[type.h2, { color: colors.text, marginTop: space.lg }]}>{a.name}</Text>
      <Text style={[type.small, { color: colors.muted }]}>{a.destinations?.name}, {a.destinations?.state}{a.location ? ` · ${a.location}` : ''}</Text>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
        <Badge label={cap(a.category)} tone="neutral" />
        {a.rating ? <Badge label={`★ ${Number(a.rating).toFixed(1)}`} tone="accent" /> : null}
      </View>
      <Text style={[type.body, { color: colors.text, marginTop: space.lg }]}>{a.description}</Text>
      <Card style={{ flexDirection: 'row', marginTop: space.lg }}>
        <View style={{ flex: 1 }}><Text style={[type.caption, { color: colors.muted }]}>Est. cost / person</Text><Text style={[type.title, { color: colors.text }]}>{a.estimated_cost ? inr(a.estimated_cost) : 'Free / varies'}</Text></View>
        <View style={{ flex: 1 }}><Text style={[type.caption, { color: colors.muted }]}>Time needed</Text><Text style={[type.title, { color: colors.text }]}>{Math.round(a.duration_minutes / 6) / 10} hrs</Text></View>
        <View style={{ flex: 1 }}><Text style={[type.caption, { color: colors.muted }]}>Hours</Text><Text style={[type.title, { color: colors.text }]}>{a.opening_time ? `${fmtTime(a.opening_time)}–${fmtTime(a.closing_time)}` : 'Check locally'}</Text></View>
      </Card>
      <Text style={[type.caption, { color: colors.muted, marginTop: 6 }]}>Costs and timings are estimates. Confirm opening hours and prices locally before you go.</Text>
      {a.latitude != null && a.longitude != null ? (
        <Section title="Location">
          <PlaceMap markers={[{ id: a.id, title: a.name, lat: a.latitude, lng: a.longitude }]} height={180} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Button title="Open in Maps" variant="secondary" icon="map" small style={{ flex: 1 }} onPress={() => { track('external_map_opened', { place: a.name }); openMap(a.latitude, a.longitude, a.name); }} />
            <Button title="Directions" variant="secondary" icon="directions" small style={{ flex: 1 }} onPress={() => openDirections(a.latitude, a.longitude)} />
          </View>
        </Section>
      ) : null}
      <Button title="Add to Trip" icon="add-circle-outline" style={{ marginTop: space.xl }} onPress={() => {
        if (!matching.length) { toast(`Create a ${a.destinations?.name} trip first`, 'info'); router.push(`/create-trip/${a.destination_id}`); return; }
        setTripId(matching[0].id); setDay(1); setOpen(true);
      }} />

      <Sheet visible={open} onClose={() => setOpen(false)} title="Add to which trip?">
        {matching.map((t) => <OptionCard key={t.id} label={t.title ?? 'Trip'} sub={fmtRange(t.start_date, t.end_date)} selected={tripId === t.id} onPress={() => { setTripId(t.id); setDay(1); }} />)}
        {chosen ? (
          <>
            <Text style={[type.small, { color: colors.text, fontWeight: '600', marginVertical: space.sm }]}>Which day?</Text>
            <ChipRow>{Array.from({ length: chosen.duration_days }, (_, i) => <Chip key={i} label={`Day ${i + 1}`} selected={day === i + 1} onPress={() => setDay(i + 1)} />)}</ChipRow>
          </>
        ) : null}
        <Button title="Add to itinerary" onPress={add} loading={busy} disabled={!chosen} style={{ marginTop: space.lg }} />
      </Sheet>
    </Screen>
  );
}
