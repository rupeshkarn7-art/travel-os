import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, Chip, ChipRow, DateField, ErrorState, Field, Header, Loading, OptionCard, ProgressBar, Screen, Stepper, useToast } from '../../components/ui';
import { useDestination } from '../../hooks/data';
import { useAuth } from '../../providers/AuthProvider';
import { supabase } from '../../lib/supabase';
import { colors, space, type } from '../../lib/theme';
import { addDays, daysBetween, errMsg, fmtRange, inr, inrRange, monthsLabel, todayISO } from '../../lib/format';
import { track } from '../../lib/analytics';
import { scheduleTripReminders } from '../../lib/notify';

const TYPES = [['solo', 'Solo', '🧍'], ['couple', 'Couple', '💑'], ['family', 'Family', '👨‍👩‍👧'], ['friends', 'Friends', '🧑‍🤝‍🧑'], ['group', 'Group', '👥']];
const PACES: [string, string, string][] = [['relaxed', 'Relaxed', '2 places a day'], ['moderate', 'Moderate', '3 places a day'], ['packed', 'Packed', '4 places a day']];
const STYLES: [string, string][] = [['budget', 'Budget'], ['standard', 'Standard'], ['premium', 'Premium']];
const INTERESTS: [string, string][] = [['heritage', 'History & heritage'], ['spiritual', 'Temples & spiritual'], ['nature', 'Nature'], ['wildlife', 'Wildlife'],
  ['adventure', 'Adventure'], ['beach', 'Beaches'], ['museum', 'Museums'], ['culture', 'Culture'], ['food', 'Food'], ['shopping', 'Shopping']];
const STAYS: [string, string][] = [['hostel', 'Hostel / budget'], ['hotel', 'Hotel'], ['homestay', 'Homestay'], ['resort', 'Resort'], ['heritage', 'Heritage stay'], ['any', 'No preference']];
const DIETS: [string, string][] = [['none', 'No restriction'], ['vegetarian', 'Vegetarian'], ['vegan', 'Vegan'], ['jain', 'Jain'], ['halal', 'Halal'], ['other', 'Other']];
const MODES = [['any', 'Not decided'], ['flight', 'Flight'], ['train', 'Train'], ['road', 'Road / self-drive'], ['bus', 'Bus']];

export default function CreateTrip() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const dq = useDestination(id);
  const d = dq.data;

  const [step, setStep] = useState(0);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const travellers = adults + children;
  const [pace, setPace] = useState('moderate');
  const [style, setStyle] = useState<string>(profile?.budget_preference && ['budget', 'standard', 'premium'].includes(profile.budget_preference) ? profile.budget_preference : 'standard');
  const [interests, setInterests] = useState<string[]>([]);
  const [stay, setStay] = useState('any');
  const [diet, setDiet] = useState('none');
  const [access, setAccess] = useState('');
  const [ttype, setTtype] = useState<string>(profile?.traveller_type ?? 'couple');
  const [budget, setBudget] = useState('');
  const [mode, setMode] = useState('any');
  const [origin, setOrigin] = useState('');
  const [gen, setGen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const days = start && end && end >= start ? daysBetween(start, end) + 1 : 0;
  const suggested = useMemo(() => (d?.budget_min && d?.budget_max ? Math.round(((d.budget_min + d.budget_max) / 2) * travellers / 1000) * 1000 : 0), [d, travellers]);
  const budgetNum = Number(budget.replace(/[^0-9]/g, ''));

  if (dq.isLoading) return <Screen><Loading /></Screen>;
  if (!d) return <Screen><Header /><ErrorState message="Destination not found." /></Screen>;

  const validate = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!start) e.start = 'Choose a start date.';
      else if (start < todayISO()) e.start = 'Start date cannot be in the past.';
      if (!end) e.end = 'Choose an end date.';
      else if (start && end < start) e.end = 'End date must be on or after the start date.';
      else if (start && end && daysBetween(start, end) > 60) e.end = 'Trips are limited to 60 days.';
    }
    if (s === 1 && travellers < 1) e.travellers = 'At least 1 traveller.';
    if (s === 2) {
      if (!budget.trim()) e.budget = 'Enter your approximate total budget.';
      else if (!Number.isFinite(budgetNum) || budgetNum <= 0) e.budget = 'Budget must be greater than zero.';
      else if (budgetNum > 100000000) e.budget = 'That budget looks too high.';
    }
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate(step)) setStep(step + 1); };

  const create = async () => {
    if (!validate(0) || !validate(2)) { setStep(!start || !end ? 0 : 2); return; }
    setBusy(true);
    try {
      const { data: tripId, error } = await supabase.rpc('create_trip', {
        p_destination_id: d.id, p_start: start, p_end: end, p_travellers: travellers, p_traveller_type: ttype,
        p_budget: budgetNum, p_travel_mode: mode, p_origin: origin || null,
      });
      if (error) throw error;
      await supabase.from('trips').update({
        adults, children, pace, travel_style: style, interests, accommodation_pref: stay,
        dietary: diet === 'none' ? null : diet, accessibility_needs: access.trim() || null,
      }).eq('id', tripId);
      await supabase.rpc('add_catalogue_checklist', { p_trip_id: tripId });
      track('trip_created', { destination: d.name, days, travellers });
      track('budget_created', { total: budgetNum });
      if (gen) {
        const r = await supabase.rpc('generate_itinerary', { p_trip_id: tripId });
        if (!r.error) track('itinerary_generated', { destination: d.name, method: 'rule' });
        else toast('Trip created — we could not build the itinerary automatically. You can add it from the trip.', 'info');
      }
      scheduleTripReminders(tripId as string, d.name, start!);
      await Promise.all(['trips', 'trip', 'itinerary', 'budget', 'checklist'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      toast('Trip created', 'success');
      router.replace(`/trip/${tripId}`);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally { setBusy(false); }
  };

  const steps = ['Dates', 'Travellers', 'Budget', 'Preferences', 'Review'];
  return (
    <Screen keyboard>
      <Header title={`Plan ${d.name}`} subtitle={`Step ${step + 1} of ${steps.length} · ${steps[step]}`} onBack={() => (step > 0 ? setStep(step - 1) : router.back())} />
      <ProgressBar value={(step + 1) / steps.length} color={colors.primary} />
      <View style={{ marginTop: space.xl }}>
        {step === 0 && (
          <>
            <Text style={[type.h2, { color: colors.text, marginBottom: space.lg }]}>When are you going?</Text>
            <DateField label="Start date" value={start} min={todayISO()} error={errs.start}
              onChange={(v) => { setStart(v); if (!end || end < v) setEnd(addDays(v, Math.max(d.recommended_days - 1, 0))); }} />
            <DateField label="End date" value={end} min={start ?? todayISO()} error={errs.end} onChange={setEnd} />
            {days > 0 ? <Card style={{ backgroundColor: colors.primaryTint, borderColor: colors.primaryTint }}><Text style={[type.title, { color: colors.primary }]}>{days} day{days > 1 ? 's' : ''}{days > 1 ? ` · ${days - 1} night${days > 2 ? 's' : ''}` : ''}</Text><Text style={[type.small, { color: colors.primaryDark }]}>Suggested for {d.name}: {d.recommended_days} days. Best time: {monthsLabel(d.best_months) ?? d.best_time ?? '—'}{start && d.best_months?.length && !d.best_months.includes(Number(start.slice(5, 7))) ? ' — your dates fall outside the usual best season; check weather and closures.' : ''}</Text></Card> : null}
          </>
        )}
        {step === 1 && (
          <>
            <Text style={[type.h2, { color: colors.text, marginBottom: space.lg }]}>Who's travelling?</Text>
            <View style={{ flexDirection: 'row', gap: space.xl, flexWrap: 'wrap' }}>
              <View><Text style={[type.small, { color: colors.text, fontWeight: '600', marginBottom: 8 }]}>Adults</Text><Stepper value={adults} onChange={setAdults} min={1} max={40} label="adults" /></View>
              <View><Text style={[type.small, { color: colors.text, fontWeight: '600', marginBottom: 8 }]}>Children</Text><Stepper value={children} onChange={setChildren} min={0} max={20} label="children" /></View>
            </View>
            <Text style={[type.small, { color: colors.text, fontWeight: '600', marginTop: space.xl, marginBottom: 10 }]}>Traveller type</Text>
            {TYPES.map(([k, l, e]) => <OptionCard key={k} label={l} emoji={e} selected={ttype === k} onPress={() => setTtype(k)} />)}
          </>
        )}
        {step === 2 && (
          <>
            <Text style={[type.h2, { color: colors.text, marginBottom: space.lg }]}>What's your budget?</Text>
            <Field label="Total budget for the trip (₹)" value={budget} onChangeText={(t) => setBudget(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder={suggested ? String(suggested) : '40000'} error={errs.budget}
              hint={d.budget_min ? `Typical for ${d.name}: ${inrRange(d.budget_min, d.budget_max)} per person (indicative).` : undefined} />
            {suggested > 0 ? <ChipRow><Chip label={`Use ${inr(suggested)}`} onPress={() => setBudget(String(suggested))} /></ChipRow> : null}
            <Text style={[type.small, { color: colors.text, fontWeight: '600', marginTop: space.xl, marginBottom: 8 }]}>How will you get there?</Text>
            <ChipRow>{MODES.map(([k, l]) => <Chip key={k} label={l} selected={mode === k} onPress={() => setMode(k)} />)}</ChipRow>
            <View style={{ height: space.lg }} />
            <Field label="Starting from (optional)" value={origin} onChangeText={setOrigin} placeholder="Delhi" />
          </>
        )}
        {step === 3 && (
          <>
            <Text style={[type.h2, { color: colors.text, marginBottom: space.lg }]}>How do you like to travel?</Text>
            <Text style={[type.small, { color: colors.text, fontWeight: '600', marginBottom: 8 }]}>Pace</Text>
            {PACES.map(([k, l, sub]) => <OptionCard key={k} label={l} sub={sub} selected={pace === k} onPress={() => setPace(k)} />)}
            <Text style={[type.small, { color: colors.text, fontWeight: '600', marginTop: space.md, marginBottom: 8 }]}>Travel style</Text>
            <ChipRow>{STYLES.map(([k, l]) => <Chip key={k} label={l} selected={style === k} onPress={() => setStyle(k)} />)}</ChipRow>
            <Text style={[type.small, { color: colors.text, fontWeight: '600', marginTop: space.lg, marginBottom: 8 }]}>Interests (pick any)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {INTERESTS.map(([k, l]) => <Chip key={k} label={l} selected={interests.includes(k)} onPress={() => setInterests((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))} />)}
            </View>
            <Text style={[type.small, { color: colors.text, fontWeight: '600', marginTop: space.lg, marginBottom: 8 }]}>Where would you like to stay?</Text>
            <ChipRow>{STAYS.map(([k, l]) => <Chip key={k} label={l} selected={stay === k} onPress={() => setStay(k)} />)}</ChipRow>
            <Text style={[type.small, { color: colors.text, fontWeight: '600', marginTop: space.lg, marginBottom: 8 }]}>Food preference</Text>
            <ChipRow>{DIETS.map(([k, l]) => <Chip key={k} label={l} selected={diet === k} onPress={() => setDiet(k)} />)}</ChipRow>
            <View style={{ height: space.lg }} />
            <Field label="Accessibility needs (optional)" value={access} onChangeText={setAccess} placeholder="e.g. wheelchair user, avoid long walks or stairs" />
          </>
        )}
        {step === 4 && (
          <>
            <Text style={[type.h2, { color: colors.text, marginBottom: space.lg }]}>Review your trip</Text>
            <Card>
              {[
                ['Destination', `${d.name}, ${d.state}`],
                ['Dates', start && end ? `${fmtRange(start, end)} (${days} days)` : '—'],
                ['Travellers', `${adults} adult${adults > 1 ? 's' : ''}${children ? ` + ${children} child${children > 1 ? 'ren' : ''}` : ''} · ${ttype}`],
                ['Pace & style', `${PACES.find((p) => p[0] === pace)?.[1]} · ${STYLES.find((p) => p[0] === style)?.[1]}`],
                ['Interests', interests.length ? interests.map((i) => INTERESTS.find((x) => x[0] === i)?.[1]).join(', ') : 'Anything'],
                ['Budget', inr(budgetNum)],
                ['Travel', MODES.find((m) => m[0] === mode)?.[1] + (origin ? ` from ${origin}` : '')],
              ].map(([k, v]) => (
                <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, gap: 12 }}>
                  <Text style={[type.small, { color: colors.muted }]}>{k}</Text>
                  <Text style={[type.small, { color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' }]}>{v}</Text>
                </View>
              ))}
            </Card>
            <OptionCard label="Build a suggested itinerary" sub="Day-wise plan in geographic order, matched to your pace and interests. You can edit everything." selected={gen} onPress={() => setGen(!gen)} />
            <Text style={[type.caption, { color: colors.muted }]}>We'll also create a budget split and a preparation checklist, including any state-wide permits (such as an Inner Line Permit) for this destination. Opening hours and travel times are flagged where they aren't verified.</Text>
          </>
        )}
      </View>
      <View style={{ marginTop: space.xl }}>
        {step < 4 ? <Button title="Continue" onPress={next} /> : <Button title="Create Trip" icon="check" onPress={create} loading={busy} />}
      </View>
    </Screen>
  );
}
