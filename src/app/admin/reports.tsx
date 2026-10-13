import React from 'react';
import { Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, EmptyState, ErrorState, Header, Loading, Screen, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { colors, type } from '../../lib/theme';
import { errMsg, fmtDate } from '../../lib/format';

export default function AdminReports() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-reports'], queryFn: async () => { const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(100); if (error) throw error; return data as any[]; } });
  const mark = async (id: string, status: 'reviewed' | 'dismissed') => {
    const { error } = await supabase.from('reports').update({ status }).eq('id', id);
    if (error) toast(errMsg(error), 'error'); else { qc.invalidateQueries({ queryKey: ['admin-reports'] }); qc.invalidateQueries({ queryKey: ['admin-stats'] }); }
  };
  if (q.isLoading) return <Screen><Loading /></Screen>;
  if (q.isError) return <Screen><Header title="Reports" /><ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /></Screen>;
  return (
    <Screen onRefresh={() => q.refetch()}>
      <Header title="Reports" />
      {q.data!.length === 0 ? <EmptyState icon="flag" title="No reports" text="User feedback and content reports appear here." /> : (
        <View style={{ gap: 10 }}>
          {q.data!.map((r) => (
            <Card key={r.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[type.small, { color: colors.muted }]}>{r.content_type} · {fmtDate(r.created_at.slice(0, 10))}</Text>
                <Badge label={r.status} tone={r.status === 'pending' ? 'warning' : 'neutral'} />
              </View>
              <Text style={[type.body, { color: colors.text, marginTop: 6 }]}>{r.reason}</Text>
              {r.status === 'pending' ? (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <View style={{ flex: 1 }}><Button title="Mark reviewed" small onPress={() => mark(r.id, 'reviewed')} /></View>
                  <View style={{ flex: 1 }}><Button title="Dismiss" small variant="secondary" onPress={() => mark(r.id, 'dismissed')} /></View>
                </View>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
