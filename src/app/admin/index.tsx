import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Card, ErrorState, Header, Loading, Row, Screen, Section, Stat } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { colors, type } from '../../lib/theme';
import { errMsg } from '../../lib/format';

export default function AdminHome() {
  const router = useRouter();
  const q = useQuery({ queryKey: ['admin-stats'], queryFn: async () => { const { data, error } = await supabase.rpc('admin_stats'); if (error) throw error; return data as Record<string, number>; } });
  if (q.isLoading) return <Screen><Loading /></Screen>;
  if (q.isError) return <Screen><Header title="Admin" /><ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /></Screen>;
  const s = q.data!;
  return (
    <Screen onRefresh={() => q.refetch()}>
      <Header title="Admin console" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {[['Users', s.users], ['Trips', s.trips], ['Destinations', `${s.published_destinations}/${s.destinations}`], ['Places', s.attractions], ['Reports pending', s.pending_reports], ['Needs review', s.needs_review]].map(([l, v]) => (
          <Card key={String(l)} style={{ width: '48%' }}><Stat label={String(l)} value={String(v)} /></Card>
        ))}
      </View>
      <Section title="Manage content">
        <Card style={{ paddingVertical: 4 }}>
          <Row icon="place" label="Destinations" onPress={() => router.push('/admin/destinations')} />
          <Row icon="verified" label="Documents & permits" value="Set sources and verification dates" onPress={() => router.push('/admin/requirements')} />
          <Row icon="flag" label="Reports" onPress={() => router.push('/admin/reports')} />
        </Card>
      </Section>
      <Text style={[type.caption, { color: colors.muted, marginTop: 12 }]}>Content marked “needs review” is shown to users with a notice until you verify it against an official source.</Text>
    </Screen>
  );
}
