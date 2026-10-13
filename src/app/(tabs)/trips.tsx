import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Card, EmptyState, ErrorState, Icon, Loading, Screen } from '../../components/ui';
import { HeroArt } from '../../components/HeroArt';
import { upcoming, useTrips } from '../../hooks/data';
import { colors, space, type } from '../../lib/theme';
import { daysBetween, fmtRange, inr, todayISO } from '../../lib/format';

export default function Trips() {
  const router = useRouter();
  const [tab, setTab] = useState<'up' | 'done'>('up');
  const q = useTrips();
  const list = (q.data ?? []).filter((t) => (tab === 'up' ? upcoming(t) : !upcoming(t)));
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: space.lg }}>
        <Text style={[type.h1, { color: colors.text }]}>My trips</Text>
        <Pressable onPress={() => router.push('/search')} accessibilityLabel="Create trip" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, paddingHorizontal: 14, minHeight: 40, borderRadius: 20 }}>
          <Icon name="add" color="#fff" size={20} /><Text style={[type.button, { color: '#fff' }]}>New</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', backgroundColor: colors.border, borderRadius: 12, padding: 3, marginVertical: space.lg }}>
        {([['up', 'Upcoming'], ['done', 'Completed']] as const).map(([k, l]) => (
          <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: tab === k ? colors.surface : 'transparent' }}>
            <Text style={[type.small, { fontWeight: '700', color: tab === k ? colors.primary : colors.muted }]}>{l}</Text>
          </Pressable>
        ))}
      </View>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : !list.length ? (
        <EmptyState icon="luggage" title={tab === 'up' ? 'No upcoming trips' : 'No completed trips yet'}
          text={tab === 'up' ? 'Search a destination and tap Plan Trip to get started.' : 'Trips you finish will show up here.'}
          action={tab === 'up' ? 'Find a destination' : undefined} onAction={() => router.push('/search')} />
      ) : (
        <View style={{ gap: 12 }}>
          {list.map((t) => {
            const left = daysBetween(todayISO(), t.start_date);
            return (
              <Card key={t.id} onPress={() => router.push(`/trip/${t.id}`)} style={{ padding: 0, overflow: 'hidden' }}>
                <HeroArt image={t.destinations?.hero_image} categories={t.destinations?.categories} height={84} radius={0} emojiSize={44} />
                <View style={{ padding: space.lg }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[type.title, { color: colors.text }]}>{t.destinations?.name}</Text>
                    {tab === 'up' ? <Badge tone={left <= 7 && left >= 0 ? 'warning' : 'info'} label={left > 0 ? `In ${left} day${left > 1 ? 's' : ''}` : left === 0 ? 'Today' : 'Ongoing'} /> : <Badge tone="neutral" label={t.status === 'cancelled' ? 'Cancelled' : 'Completed'} />}
                  </View>
                  <Text style={[type.small, { color: colors.muted, marginTop: 2 }]}>{fmtRange(t.start_date, t.end_date)} · {t.travellers} traveller{t.travellers > 1 ? 's' : ''} · {inr(t.budget)}</Text>
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
