import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Card, EmptyState, ErrorState, Header, Icon, Loading, Screen } from '../components/ui';
import { useNotifications } from '../hooks/data';
import { supabase } from '../lib/supabase';
import { colors, type } from '../lib/theme';
import { errMsg, fmtDate } from '../lib/format';

export default function Notifications() {
  const router = useRouter();
  const qc = useQueryClient();
  const q = useNotifications();
  const rows = q.data ?? [];
  useEffect(() => {
    const unread = rows.filter((n) => !n.read).map((n) => n.id);
    if (unread.length) supabase.from('notifications').update({ read: true }).in('id', unread).then(() => qc.invalidateQueries({ queryKey: ['notifications'] }));
  }, [rows.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (q.isLoading) return <Screen><Loading /></Screen>;
  if (q.isError) return <Screen><Header title="Notifications" /><ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /></Screen>;
  return (
    <Screen onRefresh={() => q.refetch()}>
      <Header title="Notifications" />
      {rows.length === 0 ? <EmptyState icon="notifications-none" title="You're all caught up" text="Trip reminders and updates will appear here." /> : (
        <View style={{ gap: 10 }}>
          {rows.map((n) => (
            <Card key={n.id} style={{ flexDirection: 'row', gap: 12 }} onPress={n.data?.trip_id ? () => router.push(`/trip/${n.data.trip_id}`) : undefined}>
              <Icon name="notifications" color={n.read ? colors.faint : colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { color: colors.text, fontWeight: n.read ? '400' : '700' }]}>{n.title}</Text>
                {n.body ? <Text style={[type.small, { color: colors.muted }]}>{n.body}</Text> : null}
                <Text style={[type.caption, { color: colors.faint, marginTop: 4 }]}>{fmtDate(n.created_at.slice(0, 10))}</Text>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
