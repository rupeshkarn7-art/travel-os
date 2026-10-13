import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Chip, ChipRow, EmptyState, ErrorState, Field, Header, Icon, IconButton, Loading, ProgressBar, Screen, Sheet, confirmAction, useToast } from '../../../components/ui';
import { useChecklist, useTrip } from '../../../hooks/data';
import type { ChecklistItem } from '../../../lib/types';
import { supabase } from '../../../lib/supabase';
import { colors, space, type } from '../../../lib/theme';
import { errMsg, fmtDate } from '../../../lib/format';
import { track } from '../../../lib/analytics';

const CATS = ['Documents', 'Permits', 'Packing', 'Bookings', 'Health', 'Other'];

export default function Checklist() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const qc = useQueryClient();
  const trip = useTrip(id);
  const q = useChecklist(id);
  const [tab, setTab] = useState('All');
  const [add, setAdd] = useState<null | { task: string; category: string; priority: ChecklistItem['priority'] }>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const items = q.data ?? [];
  const shown = useMemo(() => items.filter((i) => tab === 'All' || i.category === tab), [items, tab]);
  const cats = useMemo(() => ['All', ...Array.from(new Set([...CATS, ...items.map((i) => i.category)])).filter((c) => items.some((i) => i.category === c))], [items]);
  const key = ['checklist', id];

  if (q.isLoading || trip.isLoading) return <Screen><Loading /></Screen>;
  if (q.isError) return <Screen><Header /><ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /></Screen>;
  const done = items.filter((i) => i.completed).length;

  const toggle = async (i: ChecklistItem) => {
    const prev = qc.getQueryData<ChecklistItem[]>(key);
    qc.setQueryData<ChecklistItem[]>(key, (old) => (old ?? []).map((x) => (x.id === i.id ? { ...x, completed: !x.completed } : x)));
    const { error } = await supabase.from('checklist_items').update({ completed: !i.completed }).eq('id', i.id);
    if (error) { qc.setQueryData(key, prev); toast(errMsg(error), 'error'); } else { qc.invalidateQueries({ queryKey: ['trip'] }); }
  };

  const save = async () => {
    if (!add) return;
    if (!add.task.trim()) { setErr('Describe the task.'); return; }
    setBusy(true);
    const { error } = await supabase.from('checklist_items').insert({ trip_id: id, task: add.task.trim(), category: add.category, priority: add.priority });
    setBusy(false);
    if (error) { toast(errMsg(error), 'error'); return; }
    track('checklist_item_added', {});
    await qc.invalidateQueries({ queryKey: key }); setAdd(null);
  };

  const remove = async (i: ChecklistItem) => {
    if (!(await confirmAction('Delete task?', i.task, 'Delete'))) return;
    const { error } = await supabase.from('checklist_items').delete().eq('id', i.id);
    if (error) toast(errMsg(error), 'error'); else qc.invalidateQueries({ queryKey: key });
  };

  return (
    <Screen bottom onRefresh={() => q.refetch()}>
      <Header title="Checklist" subtitle={trip.data?.destinations?.name} />
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[type.body, { color: colors.text, fontWeight: '600' }]}>{done} of {items.length} done</Text>
          <Text style={[type.small, { color: colors.muted }]}>{items.length ? Math.round((done / items.length) * 100) : 0}%</Text>
        </View>
        <View style={{ marginTop: 8 }}><ProgressBar value={items.length ? done / items.length : 0} /></View>
      </Card>
      {items.length > 0 ? <View style={{ marginTop: space.md }}><ChipRow>{cats.map((c) => <Chip key={c} label={c} selected={tab === c} onPress={() => setTab(c)} />)}</ChipRow></View> : null}

      {items.length === 0 ? <EmptyState icon="checklist" title="Your checklist is empty" text="Add tasks to stay on top of your trip prep." action="Add task" onAction={() => { setErr(''); setAdd({ task: '', category: 'Packing', priority: 'medium' }); }} /> : (
        <View style={{ gap: 8, marginTop: space.md }}>
          {shown.map((i) => (
            <Card key={i.id} style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: i.completed }} accessibilityLabel={i.task} onPress={() => toggle(i)} hitSlop={8}>
                <Icon name={i.completed ? 'check-box' : 'check-box-outline-blank'} color={i.completed ? colors.success : colors.faint} size={28} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { color: i.completed ? colors.faint : colors.text, textDecorationLine: i.completed ? 'line-through' : 'none' }]}>{i.task}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                  <Badge label={i.category} tone="neutral" />
                  {i.priority === 'high' && !i.completed ? <Badge label="High priority" tone="error" /> : null}
                  {i.due_date ? <Badge label={`Due ${fmtDate(i.due_date)}`} tone="warning" /> : null}
                </View>
              </View>
              <IconButton name="delete-outline" label="Delete task" color={colors.muted} onPress={() => remove(i)} />
            </Card>
          ))}
        </View>
      )}
      <Button title="Add task" icon="add" variant="secondary" style={{ marginTop: space.lg }} onPress={() => { setErr(''); setAdd({ task: '', category: 'Packing', priority: 'medium' }); }} />

      <Sheet visible={!!add} onClose={() => setAdd(null)} title="Add task">
        {add ? (
          <>
            <Field label="Task" value={add.task} onChangeText={(x) => setAdd({ ...add, task: x })} error={err} placeholder="Pack warm jacket" />
            <Text style={[type.small, { color: colors.text, fontWeight: '600', marginBottom: 8 }]}>Category</Text>
            <ChipRow>{CATS.map((c) => <Chip key={c} label={c} selected={add.category === c} onPress={() => setAdd({ ...add, category: c })} />)}</ChipRow>
            <Text style={[type.small, { color: colors.text, fontWeight: '600', marginVertical: 8 }]}>Priority</Text>
            <ChipRow>{(['high', 'medium', 'low'] as const).map((p) => <Chip key={p} label={p[0].toUpperCase() + p.slice(1)} selected={add.priority === p} onPress={() => setAdd({ ...add, priority: p })} />)}</ChipRow>
            <View style={{ height: space.lg }} />
            <Button title="Save task" onPress={save} loading={busy} />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
