import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, Chip, ChipRow, Field, Header, Screen, Section, Stepper, useToast } from '../components/ui';
import { BUDGET_ASSUMPTIONS, CHILD_FACTOR, CONTINGENCY, estimateBudget, Style } from '../hooks/catalogue';
import { useTrip } from '../hooks/data';
import { supabase } from '../lib/supabase';
import { colors, space, type } from '../lib/theme';
import { errMsg, inr } from '../lib/format';

const STYLES: [Style, string][] = [['budget', 'Budget'], ['standard', 'Standard'], ['premium', 'Premium']];
const PRESETS: [string, number, number][] = [['Solo', 1, 0], ['Couple', 2, 0], ['Family', 2, 2], ['Group', 6, 0]];

export default function BudgetCalculator() {
  const { trip: tripId } = useLocalSearchParams<{ trip?: string }>();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const trip = useTrip(tripId);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [days, setDays] = useState(4);
  const [style, setStyle] = useState<Style>('standard');
  const [transport, setTransport] = useState('');
  const [permits, setPermits] = useState('');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = trip.data;
    if (!t) return;
    setDays(t.duration_days);
    setAdults(t.adults ?? t.travellers);
    setChildren(t.children ?? 0);
    if (t.travel_style) setStyle(t.travel_style);
  }, [trip.data?.id]);

  const est = useMemo(() => estimateBudget({
    adults, children, days, style,
    transportPerPerson: Number(transport) || 0, permitsTotal: Number(permits) || 0,
  }), [adults, children, days, style, transport, permits]);
  const lines = est.lines.map((l) => (overrides[l.key] != null && overrides[l.key] !== '' ? { ...l, amount: Number(overrides[l.key]) || 0, note: 'Your value' } : l));
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const perPerson = Math.round(total / Math.max(adults + children, 1));
  const a = BUDGET_ASSUMPTIONS[style];

  const apply = async () => {
    if (!tripId) return;
    setBusy(true);
    try {
      const merged = new Map<string, number>();
      lines.forEach((l) => merged.set(l.key, (merged.get(l.key) ?? 0) + l.amount));
      const rows = [...merged].map(([category, estimated_amount]) => ({ trip_id: tripId, category, estimated_amount }));
      const up = await supabase.from('budget_categories').upsert(rows, { onConflict: 'trip_id,category' });
      if (up.error) throw up.error;
      const tu = await supabase.from('trips').update({ budget: total, adults, children, travel_style: style }).eq('id', tripId);
      if (tu.error) throw tu.error;
      await Promise.all(['budget', 'trip', 'trips'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      toast('Budget applied to your trip', 'success');
      router.back();
    } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <Screen keyboard>
      <Header title="Budget calculator" subtitle={trip.data ? `For ${trip.data.destinations?.name ?? 'your trip'}` : 'Estimate your trip cost'} />
      <Text style={[type.small, { color: colors.text, fontWeight: '700', marginBottom: 8 }]}>Who's travelling</Text>
      <ChipRow>{PRESETS.map(([l, ad, ch]) => <Chip key={l} label={l} selected={adults === ad && children === ch} onPress={() => { setAdults(ad); setChildren(ch); }} />)}</ChipRow>
      <View style={{ flexDirection: 'row', gap: space.lg, marginTop: space.md, flexWrap: 'wrap' }}>
        <View><Text style={[type.caption, { color: colors.muted }]}>Adults</Text><Stepper value={adults} onChange={setAdults} min={1} max={50} label="adults" /></View>
        <View><Text style={[type.caption, { color: colors.muted }]}>Children</Text><Stepper value={children} onChange={setChildren} min={0} max={20} label="children" /></View>
        <View><Text style={[type.caption, { color: colors.muted }]}>Days</Text><Stepper value={days} onChange={setDays} min={1} max={60} label="days" /></View>
      </View>
      <Text style={[type.small, { color: colors.text, fontWeight: '700', marginTop: space.lg, marginBottom: 8 }]}>Travel style</Text>
      <ChipRow>{STYLES.map(([k, l]) => <Chip key={k} label={l} selected={style === k} onPress={() => setStyle(k)} />)}</ChipRow>
      <View style={{ height: space.lg }} />
      <Field label="Transport to & from, per person (₹)" value={transport} onChangeText={(t) => setTransport(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="e.g. 6000"
        hint="Enter the return fare you expect — we don't have live fares." />
      <Field label="Permit fees, total (₹)" value={permits} onChangeText={(t) => setPermits(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="0" hint="Use the official fee if your route needs permits." />

      <Card style={{ backgroundColor: colors.primaryDark, borderColor: colors.primaryDark }}>
        <Text style={[type.caption, { color: 'rgba(255,255,255,0.8)' }]}>ESTIMATED TOTAL</Text>
        <Text style={[type.display, { color: '#fff' }]} accessibilityLiveRegion="polite">{inr(total)}</Text>
        <Text style={[type.small, { color: 'rgba(255,255,255,0.9)' }]}>{inr(perPerson)} per person · {adults + children} traveller{adults + children > 1 ? 's' : ''} · {days} day{days > 1 ? 's' : ''}</Text>
      </Card>

      <Section title="Breakdown (edit any line)">
        <View style={{ gap: 4 }}>
          {lines.map((l) => (
            <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[type.small, { color: colors.text, fontWeight: '600' }]}>{l.label}</Text>
                <Text style={[type.caption, { color: colors.muted }]}>{l.note}</Text>
              </View>
              <View style={{ width: 130 }}>
                <Field value={overrides[l.key] ?? String(l.amount)} keyboardType="number-pad" accessibilityLabel={`${l.label} amount`}
                  onChangeText={(t) => setOverrides((o) => ({ ...o, [l.key]: t.replace(/[^0-9]/g, '') }))} />
              </View>
            </View>
          ))}
        </View>
        {Object.keys(overrides).length ? <Button small variant="ghost" title="Reset to estimates" onPress={() => setOverrides({})} style={{ alignSelf: 'flex-start' }} /> : null}
      </Section>

      <Card style={{ marginTop: space.md, backgroundColor: colors.warningTint, borderColor: colors.warningTint }}>
        <Text style={[type.small, { color: '#7C4A03', fontWeight: '700' }]}>How this is estimated</Text>
        <Text style={[type.caption, { color: '#7C4A03', marginTop: 4 }]}>
          Indicative planning figures, not live prices. {STYLES.find((s) => s[0] === style)?.[1]} style assumes ~{inr(a.stayPerRoomNight)} per room-night (2 per room),
          {' '}{inr(a.foodPerDay)} food and {inr(a.localPerDay)} local transport per adult per day, and {inr(a.ticketsPerDay + a.activitiesPerDay)} for tickets and activities.
          Children are counted at {Math.round(CHILD_FACTOR * 100)}% for daily costs. A {Math.round(CONTINGENCY * 100)}% contingency is added. Costs vary widely by destination and season.
        </Text>
      </Card>

      {tripId ? <Button title="Apply to my trip budget" icon="check" onPress={apply} loading={busy} style={{ marginTop: space.lg }} /> : null}
    </Screen>
  );
}
