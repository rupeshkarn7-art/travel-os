import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, Card, EmptyState, ErrorState, Header, Loading, Screen, Row } from '../../../components/ui';
import { PlaceMap } from '../../../components/PlaceMap';
import { useItinerary, useTrip } from '../../../hooks/data';
import { colors, space, type } from '../../../lib/theme';
import { errMsg, fmtTime } from '../../../lib/format';
import { openDirections } from '../../../lib/maps';

export default function TripMap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const q = useItinerary(id);
  const [sel, setSel] = useState<string | null>(null);
  if (trip.isLoading || q.isLoading) return <Screen><Loading /></Screen>;
  if (q.isError || !trip.data) return <Screen><Header /><ErrorState message={q.isError ? errMsg(q.error) : 'Trip not found.'} onRetry={() => q.refetch()} /></Screen>;
  const pts = (q.data ?? []).filter((i) => i.latitude != null && i.longitude != null);
  const markers = pts.map((i) => ({ id: i.id, title: i.activity, lat: Number(i.latitude), lng: Number(i.longitude), subtitle: `Day ${i.day_number}` }));
  return (
    <Screen bottom>
      <Header title="Trip map" subtitle={trip.data.destinations?.name} />
      {markers.length === 0 ? (
        <EmptyState icon="map" title="No places to show yet" text="Activities with a location appear here. Build a suggested itinerary first." />
      ) : (
        <>
          <PlaceMap markers={markers} height={320} selectedId={sel} onSelect={setSel} />
          <Text style={[type.caption, { color: colors.muted, marginVertical: space.sm }]}>Map © OpenStreetMap contributors. Directions open in your maps app.</Text>
          <View style={{ gap: 8 }}>
            {pts.map((i) => (
              <Card key={i.id} style={{ padding: 12 }} onPress={() => setSel(i.id)} accessibilityLabel={i.activity}>
                <Row label={i.activity} value={`Day ${i.day_number}${i.start_time ? ` · ${fmtTime(i.start_time)}` : ''}`} right={<Button title="Directions" small variant="secondary" icon="directions" onPress={() => openDirections(i.latitude, i.longitude)} />} />
              </Card>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
