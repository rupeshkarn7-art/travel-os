import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Chip, ChipRow, EmptyState, ErrorState, Field, Header, Icon, IconButton, Loading, Screen, Sheet, confirmAction, useToast, Row } from '../../../components/ui';
import { useItinerary, useTrip } from '../../../hooks/data';
import type { ItineraryItem } from '../../../lib/types';
import { supabase } from '../../../lib/supabase';
import { colors, space, type } from '../../../lib/theme';
import { addDays, errMsg, fmtDate, fmtTime, inr } from '../../../lib/format';
import { track } from '../../../lib/analytics';
import { openDirections } from '../../../lib/maps';

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const norm = (t: string) => (TIME_RE.test(t.trim()) ? t.trim().padStart(5, '0') : null);

export default function Itinerary() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const qc = useQueryClient();
  const trip = useTrip(id);
  const q = useItinerary(id);
  const [day, setDay] = useState(1);
  const [form, setForm] = useState<null | { item?: ItineraryItem; activity: string; place: string; start: string; end: string; cost: string; notes: string }>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [gen, setGen] = useState(false);
  const [menu, setMenu] = useState(false);

  const t = trip.data;
  const items = q.data ?? [];
  const dayItems = useMemo(() => items.filter((i) => i.day_number === day), [items, day]);
  const refresh = () => qc.invalidateQueries({ queryKey: ['itinerary'] });

  if (trip.isLoading || q.isLoading) return <Screen><Loading /></Screen>;
  if (!t || q.isError) return <Screen><Header /><ErrorState message={q.isError ? errMsg(q.error) : 'Trip not found.'} onRetry={() => q.refetch()} /></Screen>;

  const ensureItin = async () => {
    const { data } = await supabase.from('itineraries').select('id').eq('trip_id', t.id).order('created_at').limit(1).maybeSingle();
    if (data?.id) return data.id as string;
    const { data: n, error } = await supabase.from('itineraries').insert({ trip_id: t.id }).select('id').single();
    if (error) throw error;
    return n.id as string;
  };

  const openForm = (item?: ItineraryItem) => {
    setErrs({});
    setForm({ item, activity: item?.activity ?? '', place: item?.place ?? '', start: fmtTime(item?.start_time) || '10:00', end: fmtTime(item?.end_time), cost: item ? String(Math.round(item.estimated_cost)) : '', notes: item?.notes ?? '' });
  };

  const save = async () => {
    if (!form) return;
    const e: Record<string, string> = {};
    if (!form.activity.trim()) e.activity = 'Describe the activity.';
    const st = form.start ? norm(form.start) : null;
    const en = form.end ? norm(form.end) : null;
    if (form.start && !st) e.start = 'Use 24h time, e.g. 09:30';
    if (form.end && !en) e.end = 'Use 24h time, e.g. 11:00';
    if (st && en && en <= st) e.end = 'End time must be after start time.';
    const cost = form.cost ? Number(form.cost.replace(/[^0-9.]/g, '')) : 0;
    if (!Number.isFinite(cost) || cost < 0) e.cost = 'Enter a valid amount.';
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      if (form.item) {
        const { error } = await supabase.from('itinerary_items').update({
          activity: form.activity.trim(), place: form.place.trim() || null, start_time: st, end_time: en, estimated_cost: cost, notes: form.notes.trim() || null,
        }).eq('id', form.item.id);
        if (error) throw error;
      } else {
        const itId = await ensureItin();
        const maxOrder = dayItems.reduce((m, i) => Math.max(m, i.sort_order), 0);
        const { error } = await supabase.from('itinerary_items').insert({
          itinerary_id: itId, trip_id: t.id, day_number: day, date: addDays(t.start_date, day - 1), activity: form.activity.trim(),
          place: form.place.trim() || null, start_time: st, end_time: en, estimated_cost: cost, notes: form.notes.trim() || null, sort_order: maxOrder + 1, source: 'manual',
        });
        if (error) throw error;
      }
      track('itinerary_updated', {});
      await refresh(); setForm(null);
    } catch (err) { toast(errMsg(err), 'error'); }
    finally { setBusy(false); }
  };

  const remove = async (i: ItineraryItem) => {
    if (!(await confirmAction('Remove activity?', i.activity, 'Remove'))) return;
    const { error } = await supabase.from('itinerary_items').delete().eq('id', i.id);
    if (error) toast(errMsg(error), 'error'); else { track('itinerary_updated', {}); refresh(); }
  };

  const move = async (i: ItineraryItem, dir: -1 | 1) => {
    const idx = dayItems.findIndex((x) => x.id === i.id);
    const other = dayItems[idx + dir];
    if (!other) return;
    const a = await supabase.from('itinerary_items').update({ sort_order: other.sort_order }).eq('id', i.id);
    const b = await supabase.from('itinerary_items').update({ sort_order: i.sort_order }).eq('id', other.id);
    if (a.error || b.error) toast(errMsg(a.error ?? b.error), 'error');
    // equal sort orders can't swap; renumber the day if so
    if (i.sort_order === other.sort_order) {
      const ordered = [...dayItems]; ordered.splice(idx, 1); ordered.splice(idx + dir, 0, i);
      for (let k = 0; k < ordered.length; k++) await supabase.from('itinerary_items').update({ sort_order: k + 1 }).eq('id', ordered[k].id);
    }
    refresh();
  };

  const clearAll = async () => {
    const { error } = await supabase.from('itinerary_items').delete().eq('trip_id', t.id);
    if (error) throw error;
  };

  const generate = async (mode: 'rule' | 'ai') => {
    setMenu(false);
    if (items.length && !(await confirmAction('Replace your itinerary?', 'This removes your current activities and builds a new suggested plan.', 'Replace'))) return;
    setGen(true);
    try {
      if (items.length) await clearAll();
      if (mode === 'ai') {
        const { data, error } = await supabase.functions.invoke('ai-itinerary', { body: { trip_id: t.id } });
        if (error || (data as any)?.error) {
          const msg = (data as any)?.error ?? error?.message ?? 'AI planner unavailable';
          toast(`${/not configured|503/i.test(String(msg)) ? 'AI planner is not enabled yet' : 'AI planner is busy'} — built a standard plan instead.`, 'info');
          const r = await supabase.rpc('generate_itinerary', { p_trip_id: t.id });
          if (r.error) throw r.error;
        } else track('itinerary_generated', { method: 'ai' });
      } else {
        const r = await supabase.rpc('generate_itinerary', { p_trip_id: t.id });
        if (r.error) throw r.error;
        track('itinerary_generated', { method: 'rule' });
      }
      await refresh(); setDay(1); toast('Itinerary ready', 'success');
    } catch (e) { toast(errMsg(e), 'error'); await refresh(); }
    finally { setGen(false); }
  };

  const dayCost = dayItems.reduce((s, i) => s + Number(i.estimated_cost), 0);
  const total = items.reduce((s, i) => s + Number(i.estimated_cost), 0);

  return (
    <Screen bottom>
      <Header title="Itinerary" subtitle={t.destinations?.name}
        right={<IconButton name="auto-awesome" label="Generate itinerary" color={colors.primary} onPress={() => setMenu(true)} />} />
      <ChipRow>
        {Array.from({ length: t.duration_days }, (_, i) => (
          <Chip key={i} label={`Day ${i + 1} · ${fmtDate(addDays(t.start_date, i))}`} selected={day === i + 1} onPress={() => setDay(i + 1)} />
        ))}
      </ChipRow>

      {gen ? <Loading label="Building your itinerary…" /> : !items.length ? (
        <EmptyState icon="event-note" title="No activities yet" text="Build a suggested plan from top-rated places, or add activities yourself." action="Build suggested itinerary" onAction={() => generate('rule')} />
      ) : (
        <View style={{ marginTop: space.lg, gap: 10 }}>
          {items.some((i) => i.source !== 'manual') ? (
            <Card style={{ backgroundColor: colors.infoTint, borderColor: colors.infoTint, padding: 12 }}>
              <Text style={[type.small, { color: colors.primaryDark }]}>Suggested plan — {items.some((i) => i.source === 'ai') ? 'includes AI suggestions. ' : ''}Prices and timings are estimates. Always confirm opening hours, prices and permits with official sources.</Text>
            </Card>
          ) : null}
          {dayItems.length === 0 ? <Text style={[type.small, { color: colors.muted, textAlign: 'center', marginVertical: space.lg }]}>Nothing planned for Day {day}. Add an activity below.</Text> : null}
          {dayItems.map((i, idx) => (
            <Card key={i.id} style={{ padding: 12 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ width: 54, alignItems: 'center' }}>
                  <Text style={[type.small, { color: colors.primary, fontWeight: '700' }]}>{fmtTime(i.start_time) || '--:--'}</Text>
                  {i.end_time ? <Text style={[type.caption, { color: colors.faint }]}>{fmtTime(i.end_time)}</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type.title, { color: colors.text }]}>{i.activity}</Text>
                  {i.place && i.place !== i.activity.replace('Visit ', '') ? <Text style={[type.small, { color: colors.muted }]}>{i.place}</Text> : null}
                  {i.description && i.source !== 'manual' ? <Text style={[type.small, { color: colors.muted }]} numberOfLines={2}>{i.description}</Text> : null}
                  {i.notes ? <Text style={[type.small, { color: colors.text, marginTop: 4 }]}>📝 {i.notes}</Text> : null}
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {Number(i.estimated_cost) > 0 ? <Badge label={inr(i.estimated_cost)} tone="neutral" /> : null}
                    {i.source === 'rule' ? <Badge label="Suggested" tone="info" /> : null}
                    {i.source === 'ai' ? <Badge label="AI suggested" tone="accent" icon="auto-awesome" /> : null}
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 2, marginTop: 4 }}>
                {i.latitude != null ? <IconButton name="directions" label="Directions" color={colors.primary} onPress={() => openDirections(i.latitude, i.longitude)} /> : null}
                <IconButton name="arrow-upward" label="Move up" color={colors.muted} disabled={idx === 0} onPress={() => move(i, -1)} />
                <IconButton name="arrow-downward" label="Move down" color={colors.muted} disabled={idx === dayItems.length - 1} onPress={() => move(i, 1)} />
                <IconButton name="edit" label="Edit activity" color={colors.muted} onPress={() => openForm(i)} />
                <IconButton name="delete-outline" label="Remove activity" color={colors.error} onPress={() => remove(i)} />
              </View>
            </Card>
          ))}
          <Text style={[type.small, { color: colors.muted, textAlign: 'right' }]}>Day {day}: {inr(dayCost)} · Whole trip: {inr(total)}</Text>
        </View>
      )}
      <Button title="Add activity" icon="add" variant="secondary" onPress={() => openForm()} style={{ marginTop: space.lg }} />

      <Sheet visible={!!form} onClose={() => setForm(null)} title={form?.item ? 'Edit activity' : `Add activity · Day ${day}`}>
        {form ? (
          <>
            <Field label="Activity" value={form.activity} onChangeText={(x) => setForm({ ...form, activity: x })} error={errs.activity} placeholder="Sunset at the lake" />
            <Field label="Place (optional)" value={form.place} onChangeText={(x) => setForm({ ...form, place: x })} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><Field label="Start (24h)" value={form.start} onChangeText={(x) => setForm({ ...form, start: x })} placeholder="10:00" error={errs.start} keyboardType="numbers-and-punctuation" /></View>
              <View style={{ flex: 1 }}><Field label="End (24h)" value={form.end} onChangeText={(x) => setForm({ ...form, end: x })} placeholder="12:00" error={errs.end} keyboardType="numbers-and-punctuation" /></View>
            </View>
            <Field label="Estimated cost (₹)" value={form.cost} onChangeText={(x) => setForm({ ...form, cost: x.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" error={errs.cost} />
            <Field label="Notes" value={form.notes} onChangeText={(x) => setForm({ ...form, notes: x })} multiline style={{ minHeight: 60, textAlignVertical: 'top' }} />
            <Button title="Save" onPress={save} loading={busy} />
          </>
        ) : null}
      </Sheet>

      <Sheet visible={menu} onClose={() => setMenu(false)} title="Generate itinerary">
        <Row icon="route" label="Standard suggested plan" value="Built from top-rated places, instantly" onPress={() => generate('rule')} />
        <Row icon="auto-awesome" label="AI planner (beta)" value="Personalised using verified destination data" onPress={() => generate('ai')} />
        <Text style={[type.caption, { color: colors.muted, marginTop: space.md }]}>AI suggestions are only built from places in our database and are always labelled “AI suggested”. They never replace official permit or regulation information.</Text>
      </Sheet>
    </Screen>
  );
}
