import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Chip, ChipRow, EmptyState, ErrorState, Field, Header, Icon, Loading, Screen, Card } from '../components/ui';
import { HeroArt } from '../components/HeroArt';
import { useDestinations, useRecentSearches } from '../hooks/data';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';
import { useAuth } from '../providers/AuthProvider';
import { useQueryClient } from '@tanstack/react-query';
import { colors, space, type } from '../lib/theme';

export default function Search() {
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(text), 250); return () => clearTimeout(t); }, [text]);
  const res = useDestinations({ search: debounced || undefined });
  const recent = useRecentSearches();

  useEffect(() => { if (debounced.trim().length >= 2) track('destination_searched', { q: debounced.trim().toLowerCase() }); }, [debounced]);

  const open = async (id: string, name: string) => {
    if (user) {
      supabase.from('recent_searches').insert({ user_id: user.id, query: name }).then(() => qc.invalidateQueries({ queryKey: ['recent_searches'] }), () => {});
    }
    router.push(`/destination/${id}`);
  };

  return (
    <Screen keyboard>
      <Header title="Search" />
      <Field value={text} onChangeText={setText} placeholder="City, state, region or landmark" autoFocus returnKeyType="search" autoCapitalize="none"
        right={text ? <Pressable onPress={() => setText('')} hitSlop={10} accessibilityLabel="Clear"><Icon name="close" color={colors.muted} /></Pressable> : <Icon name="search" color={colors.faint} />} />
      {!text && recent.data?.length ? (
        <View style={{ marginBottom: space.lg }}>
          <Text style={[type.caption, { color: colors.muted, marginBottom: 8 }]}>RECENT SEARCHES</Text>
          <ChipRow>{recent.data.map((r) => <Chip key={r} label={r} onPress={() => setText(r)} />)}</ChipRow>
        </View>
      ) : null}
      {!text ? <Text style={[type.caption, { color: colors.muted, marginBottom: 8 }]}>POPULAR</Text> : null}
      {res.isLoading ? <Loading /> : res.isError ? <ErrorState onRetry={() => res.refetch()} /> : !res.data?.length ? (
        <EmptyState icon="search-off" title="No destinations found" text="Check the spelling or try a state or region, like “Himachal” or “Kerala”." />
      ) : (
        <View style={{ gap: 10 }}>
          {res.data.map((d) => (
            <Card key={d.id} onPress={() => open(d.id, d.name)} style={{ flexDirection: 'row', gap: 12, padding: 10, alignItems: 'center' }}>
              <HeroArt image={d.hero_image} categories={d.categories} height={64} radius={12} style={{ width: 64 }} emojiSize={28} />
              <View style={{ flex: 1 }}>
                <Text style={[type.title, { color: colors.text }]}>{d.name}</Text>
                <Text style={[type.small, { color: colors.muted }]}>{d.state}, {d.country}</Text>
                <Text style={[type.caption, { color: colors.primary, textTransform: 'capitalize' }]}>{d.categories.slice(0, 2).join(' · ')}</Text>
              </View>
              <Icon name="chevron-right" color={colors.faint} />
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
