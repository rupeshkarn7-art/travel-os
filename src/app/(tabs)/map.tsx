import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Chip, ChipRow, ErrorState, Header, Loading, Screen } from '../../components/ui';
import { PlaceMap } from '../../components/PlaceMap';
import { useDestinations } from '../../hooks/data';
import { colors, space, type } from '../../lib/theme';
import { errMsg } from '../../lib/format';
import { openDirections } from '../../lib/maps';

export default function MapTab() {
  const router = useRouter();
  const [cat, setCat] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const q = useDestinations({ category: cat });
  const list = q.data ?? [];
  const markers = list.filter((d) => d.latitude != null && d.longitude != null).map((d) => ({ id: d.id, title: d.name, lat: Number(d.latitude), lng: Number(d.longitude), subtitle: d.state ?? '' }));
  const picked = list.find((d) => d.id === sel);
  return (
    <Screen>
      <Header title="Map" back={false} />
      <ChipRow>
        <Chip label="All" selected={!cat} onPress={() => setCat(null)} />
        {['mountains', 'beaches', 'heritage', 'spiritual', 'adventure', 'wildlife'].map((c) => <Chip key={c} label={c[0].toUpperCase() + c.slice(1)} selected={cat === c} onPress={() => setCat(c)} />)}
      </ChipRow>
      <View style={{ height: space.md }} />
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /> : (
        <>
          <PlaceMap markers={markers} height={360} selectedId={sel} onSelect={setSel} />
          <Text style={[type.caption, { color: colors.muted, marginTop: 6 }]}>Map © OpenStreetMap contributors.</Text>
          {picked ? (
            <Card style={{ marginTop: space.md }}>
              <Text style={[type.title, { color: colors.text }]}>{picked.name}</Text>
              <Text style={[type.small, { color: colors.muted }]}>{picked.state}</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}><Button title="View guide" small onPress={() => router.push(`/destination/${picked.id}`)} /></View>
                <View style={{ flex: 1 }}><Button title="Directions" small variant="secondary" icon="directions" onPress={() => openDirections(picked.latitude, picked.longitude)} /></View>
              </View>
            </Card>
          ) : <Text style={[type.small, { color: colors.muted, marginTop: space.md }]}>Tap a pin to preview a destination.</Text>}
        </>
      )}
    </Screen>
  );
}
