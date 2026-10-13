import React, { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, DateField, ErrorState, Field, Header, Icon, IconButton, Loading, ProgressBar, Row, Screen, Section, Sheet, Stepper, confirmAction, useToast } from '../../../components/ui';
import { HeroArt } from '../../../components/HeroArt';
import { readiness, useBudget, useChecklist, useItinerary, useTrip } from '../../../hooks/data';
import { supabase } from '../../../lib/supabase';
import { colors, space, type } from '../../../lib/theme';
import { addDays, daysBetween, errMsg, fmtRange, inr, todayISO } from '../../../lib/format';
import { cancelTripReminders, scheduleTripReminders } from '../../../lib/notify';
import { track } from '../../../lib/analytics';

export default function TripDashboard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const trip = useTrip(id);
  const itin = useItinerary(id);
  const budget = useBudget(id);
  const check = useChecklist(id);
  const [menu, setMenu] = useState(false);
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ start: '', end: '', travellers: 1, budget: '', notes: '', origin: '' });
  const [busy, setBusy] = useState(false);

  if (trip.isLoading) return <Screen><Loading /></Screen>;
  if (trip.isError) return <Screen><Header /><ErrorState message={errMsg(trip.error)} onRetry={() => trip.refetch()} /></Screen>;
  if (!trip.data) return <Screen><Header /><ErrorState message="Trip not found. It may have been deleted." /></Screen>;
  const t = trip.data;

  const items = itin.data ?? [];
  const list = check.data ?? [];
  const done = list.filter((c) => c.completed).length;
  const estimated = (budget.data?.categories ?? []).reduce((s, c) => s + Number(c.estimated_amount), 0);
  const spent = (budget.data?.expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const score = readiness(t, list, items.length);
  const docs = list.filter((c) => c.category === 'Documents' || c.category === 'Permits');
  const daysLeft = daysBetween(todayISO(), t.start_date);
  const refresh = () => Promise.all(['trip', 'trips', 'itinerary', 'budget', 'checklist'].map((k) => qc.invalidateQueries({ queryKey: [k] })));

  const toggle = async (field: 'hotel_confirmed' | 'transport_planned', v: boolean) => {
    const { error } = await supabase.from('trips').update({ [field]: v }).eq('id', t.id);
    if (error) toast(errMsg(error), 'error'); else { await refresh(); }
  };

  const openEdit = () => {
    setF({ start: t.start_date, end: t.end_date, travellers: t.travellers, budget: String(Math.round(t.budget)), notes: t.notes ?? '', origin: t.origin ?? '' });
    setMenu(false); setEdit(true);
  };

  const saveEdit = async () => {
    const b = Number(f.budget.replace(/[^0-9]/g, ''));
    if (!f.start || !f.end || f.end < f.start) { toast('End date must be on or after the start date.', 'error'); return; }
    if (daysBetween(f.start, f.end) > 60) { toast('Trips are limited to 60 days.', 'error'); return; }
    if (!(b > 0)) { toast('Enter a budget greater than zero.', 'error'); return; }
    setBusy(true);
    try {
      const nd = daysBetween(f.start, f.end) + 1;
      const { error } = await supabase.from('trips').update({
        start_date: f.start, end_date: f.end, duration_days: nd, travellers: f.travellers, budget: b, notes: f.notes || null, origin: f.origin || null,
      }).eq('id', t.id);
      if (error) throw error;
      // keep itinerary dates in step with the trip dates
      const clamp = await supabase.from('itinerary_items').update({ day_number: nd }).eq('trip_id', t.id).gt('day_number', nd);
      if (clamp.error) throw clamp.error;
      for (let d = 1; d <= nd; d++) {
        const r = await supabase.from('itinerary_items').update({ date: addDays(f.start, d - 1) }).eq('trip_id', t.id).eq('day_number', d);
        if (r.error) throw r.error;
      }
      if (f.start !== t.start_date) scheduleTripReminders(t.id, t.destinations?.name ?? 'your', f.start);
      track('trip_updated', {});
      await refresh();
      setEdit(false);
      toast('Trip updated', 'success');
    } catch (e) { toast(errMsg(e), 'error'); }
    finally { setBusy(false); }
  };

  const complete = async () => {
    setMenu(false);
    const { error } = await supabase.from('trips').update({ status: 'completed' }).eq('id', t.id);
    if (error) { toast(errMsg(error), 'error'); return; }
    cancelTripReminders(t.id);
    track('trip_completed', { destination: t.destinations?.name });
    await refresh(); toast('Trip marked as completed 🎉', 'success');
  };

  const remove = async () => {
    setMenu(false);
    const ok = await confirmAction('Delete this trip?', 'Its itinerary, budget, expenses and checklist will be permanently deleted.', 'Delete');
    if (!ok) return;
    const { error } = await supabase.from('trips').delete().eq('id', t.id);
    if (error) { toast(errMsg(error), 'error'); return; }
    cancelTripReminders(t.id);
    await refresh(); toast('Trip deleted', 'success');
    router.replace('/trips');
  };

  const tile = (icon: any, label: string, value: string, sub: string, href: string, tone?: string) => (
    <Card onPress={() => router.push(href)} style={{ flex: 1, minWidth: 150 }} accessibilityLabel={label}>
      <Icon name={icon} color={tone ?? colors.primary} size={26} />
      <Text style={[type.caption, { color: colors.muted, marginTop: 8 }]}>{label}</Text>
      <Text style={[type.h3, { color: colors.text }]}>{value}</Text>
      <Text style={[type.caption, { color: colors.muted }]}>{sub}</Text>
    </Card>
  );

  return (
    <Screen onRefresh={refresh} refreshing={trip.isRefetching}>
      <Header title="Trip dashboard" right={<IconButton name="more-vert" label="Trip options" onPress={() => setMenu(true)} />} />
      <HeroArt image={t.destinations?.hero_image} categories={t.destinations?.categories} height={130} radius={20}>
        <View style={{ position: 'absolute', left: 16, bottom: 12, right: 16 }}>
          <Text style={[type.h2, { color: '#fff' }]}>{t.destinations?.name}</Text>
          <Text style={[type.small, { color: 'rgba(255,255,255,0.9)' }]}>{fmtRange(t.start_date, t.end_date)} · {t.travellers} traveller{t.travellers > 1 ? 's' : ''}</Text>
        </View>
      </HeroArt>

      <Card style={{ marginTop: space.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[type.title, { color: colors.text }]}>Travel readiness</Text>
          <Text style={[type.h3, { color: score >= 80 ? colors.success : colors.accent }]}>{score}%</Text>
        </View>
        <View style={{ marginVertical: 10 }}><ProgressBar value={score / 100} color={score >= 80 ? colors.success : colors.accent} height={10} /></View>
        <Text style={[type.caption, { color: colors.muted }]}>{t.status === 'completed' ? 'Trip completed' : daysLeft > 0 ? `Starts in ${daysLeft} day${daysLeft > 1 ? 's' : ''}` : daysLeft === 0 ? 'Starts today' : 'Trip in progress'} · An informational guide, not a safety guarantee.</Text>
        <Row label="Accommodation confirmed" right={<Switch value={t.hotel_confirmed} onValueChange={(v) => toggle('hotel_confirmed', v)} trackColor={{ true: colors.primary, false: colors.border }} />} />
        <Row label="Transport planned" right={<Switch value={t.transport_planned} onValueChange={(v) => toggle('transport_planned', v)} trackColor={{ true: colors.primary, false: colors.border }} />} />
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: space.lg }}>
        {tile('event-note', 'Itinerary', `${t.duration_days} day${t.duration_days > 1 ? 's' : ''}`, `${items.length} activities`, `/trip/${t.id}/itinerary`)}
        {tile('account-balance-wallet', 'Budget', inr(estimated || t.budget), `${inr(spent)} spent`, `/trip/${t.id}/budget`, spent > estimated && estimated > 0 ? colors.error : colors.primary)}
        {tile('checklist', 'Checklist', `${done} / ${list.length}`, done === list.length && list.length ? 'All done' : 'Complete', `/trip/${t.id}/checklist`, colors.success)}
        {tile('assignment-turned-in', 'Documents', `${docs.filter((d) => d.completed).length} / ${docs.length}`, 'Docs & permits', `/requirements/${t.destination_id}`, colors.accent)}
        {tile('map', 'Map', 'View route', 'Places on the map', `/trip/${t.id}/map`)}
        {tile('travel-explore', 'Destination', t.destinations?.state ?? '', 'Guide & places', `/destination/${t.destination_id}`)}
      </View>

      <Section title="Notes">
        <Card onPress={openEdit}>
          <Text style={[type.small, { color: t.notes ? colors.text : colors.faint }]}>{t.notes || 'Add notes — bookings, contacts, reminders…'}</Text>
        </Card>
      </Section>

      <Sheet visible={menu} onClose={() => setMenu(false)} title="Trip options">
        <Row icon="edit" label="Edit trip details" onPress={openEdit} />
        {t.status !== 'completed' ? <Row icon="flag" label="Mark trip as completed" onPress={complete} /> : null}
        <Row icon="delete-outline" label="Delete trip" danger onPress={remove} />
      </Sheet>

      <Sheet visible={edit} onClose={() => setEdit(false)} title="Edit trip">
        <DateField label="Start date" value={f.start} min={todayISO()} onChange={(v) => setF({ ...f, start: v, end: f.end < v ? v : f.end })} />
        <DateField label="End date" value={f.end} min={f.start || todayISO()} onChange={(v) => setF({ ...f, end: v })} />
        <Text style={[type.small, { color: colors.text, fontWeight: '600', marginBottom: 8 }]}>Travellers</Text>
        <Stepper value={f.travellers} onChange={(n) => setF({ ...f, travellers: n })} label="travellers" />
        <View style={{ height: space.lg }} />
        <Field label="Total budget (₹)" value={f.budget} onChangeText={(x) => setF({ ...f, budget: x.replace(/[^0-9]/g, '') })} keyboardType="number-pad" />
        <Field label="Starting from" value={f.origin} onChangeText={(x) => setF({ ...f, origin: x })} />
        <Field label="Notes" value={f.notes} onChangeText={(x) => setF({ ...f, notes: x })} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
        <Text style={[type.caption, { color: colors.muted, marginBottom: space.md }]}>Budget category estimates are not changed automatically — adjust them on the Budget screen.</Text>
        <Button title="Save changes" onPress={saveEdit} loading={busy} />
      </Sheet>
    </Screen>
  );
}
