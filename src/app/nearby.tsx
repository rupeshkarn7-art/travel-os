import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Chip, ChipRow, EmptyState, ErrorState, Header, Icon, Loading, Screen } from '../components/ui';
import { useNearby, useStates } from '../hooks/catalogue';
import { colors, space, type } from '../lib/theme';
import { cap } from '../lib/format';

const RADII = [50, 100, 200, 400];

export default function Nearby() {
  const router = useRouter();
  const [pos, setPos] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [radius, setRadius] = useState(200);
  const [err, setErr] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const states = useStates();
  const q = useNearby(pos?.lat, pos?.lng, radius, undefined, 30);

  const locate = () => {
    setErr(null);
    const geo = Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.geolocation : null;
    if (!geo) { setErr('Location is not available here. Pick a state capital below instead.'); return; }
    setLocating(true);
    geo.getCurrentPosition(
      (p) => { setLocating(false); setPos({ lat: p.coords.latitude, lng: p.coords.longitude, label: 'your location' }); },
      () => { setLocating(false); setErr('We could not get your location. Allow location access, or pick a state capital below.'); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  };

  return (
    <Screen>
      <Header title="Near me" subtitle={pos ? `Around ${pos.label}` : 'Discover places close to you'} />
      <Button title={locating ? 'Finding you…' : 'Use my location'} icon="my-location" loading={locating} onPress={locate} />
      <Text style={[type.caption, { color: colors.muted, marginTop: 6 }]}>Your location is used only on this device to find nearby places; it is not saved.</Text>
      {err ? <Text style={[type.small, { color: colors.error, marginTop: space.sm }]} accessibilityLiveRegion="polite">{err}</Text> : null}

      <Text style={[type.small, { color: colors.text, fontWeight: '700', marginTop: space.lg, marginBottom: 8 }]}>Or start from a state / UT (its capital)</Text>
      <ChipRow>
        {(states.data ?? []).filter((s) => s.latitude != null).map((s) => (
          <Chip key={s.id} label={s.name} selected={pos?.label === s.name}
            onPress={() => setPos({ lat: s.latitude!, lng: s.longitude!, label: s.name })} />
        ))}
      </ChipRow>

      {pos ? (
        <>
          <Text style={[type.small, { color: colors.text, fontWeight: '700', marginTop: space.lg, marginBottom: 8 }]}>Within</Text>
          <ChipRow>{RADII.map((r) => <Chip key={r} label={`${r} km`} selected={radius === r} onPress={() => setRadius(r)} />)}</ChipRow>
          <View style={{ marginTop: space.lg }}>
            {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : !q.data?.length ? (
              <EmptyState icon="near-me" title="Nothing within this distance" text="Try a larger radius." action="Search 400 km" onAction={() => setRadius(400)} />
            ) : (
              <View style={{ gap: 10 }}>
                {q.data.map((d) => (
                  <Card key={d.id} onPress={() => router.push(`/destination/${d.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[type.title, { color: colors.text }]}>{d.name}</Text>
                      <Text style={[type.small, { color: colors.muted }]}>{d.state} · {d.categories.slice(0, 2).map(cap).join(', ')}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[type.small, { color: colors.primary, fontWeight: '700' }]}>{d.distance_km} km</Text>
                      <Text style={[type.caption, { color: colors.muted }]}>straight line</Text>
                    </View>
                    <Icon name="chevron-right" color={colors.muted} />
                  </Card>
                ))}
                <Text style={[type.caption, { color: colors.muted }]}>Distances are straight-line ("as the crow flies"), not road distance or travel time.</Text>
              </View>
            )}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
