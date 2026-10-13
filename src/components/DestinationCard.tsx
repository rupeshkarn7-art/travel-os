import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HeroArt } from './HeroArt';
import { Icon } from './ui';
import { colors, radius, shadow, space, type } from '../lib/theme';
import type { Destination } from '../lib/types';
import { inrRange, monthsLabel } from '../lib/format';

export function DestinationCard({ d, width, compact }: { d: Destination; width?: number; compact?: boolean }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${d.name}, ${d.state}`}
      onPress={() => router.push(`/destination/${d.id}`)}
      style={({ pressed }) => [{ width, backgroundColor: colors.surface, borderRadius: radius.card, overflow: 'hidden', opacity: pressed ? 0.9 : 1 }, shadow.card]}
    >
      <HeroArt image={d.hero_image} categories={d.categories} height={compact ? 96 : 128} radius={0} emojiSize={compact ? 40 : 52} />
      <View style={{ padding: space.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[type.title, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>{d.name}</Text>
          {d.rating ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Icon name="star" size={16} color={colors.accent} />
              <Text style={[type.caption, { color: colors.text }]}>{Number(d.rating).toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[type.small, { color: colors.muted }]} numberOfLines={1}>{d.state}</Text>
        {compact && monthsLabel(d.best_months) ? <Text style={[type.caption, { color: colors.primary, marginTop: 2 }]} numberOfLines={1}>Best {monthsLabel(d.best_months)}</Text> : null}
        {!compact ? <Text style={[type.caption, { color: colors.primary, marginTop: 6 }]}>{inrRange(d.budget_min, d.budget_max)} · {d.recommended_days} days</Text> : null}
      </View>
    </Pressable>
  );
}
