import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Field, Header, OptionCard, ProgressBar, Screen, useToast } from '../components/ui';
import { useAuth } from '../providers/AuthProvider';
import { supabase } from '../lib/supabase';
import { colors, space, type } from '../lib/theme';
import { track } from '../lib/analytics';
import { errMsg } from '../lib/format';

const STYLES = [
  ['Adventure', '🏔️'], ['Relaxed', '🏖️'], ['Backpacking', '🎒'], ['Romantic', '❤️'],
  ['Family', '👨‍👩‍👧'], ['Budget', '💰'], ['Premium', '✨'], ['Spiritual', '🧘'],
];
const TYPES = [['solo', 'Solo'], ['couple', 'Couple'], ['family', 'Family'], ['friends', 'Friends'], ['group', 'Group']];
const BUDGETS = ['₹10K – ₹25K', '₹25K – ₹50K', '₹50K – ₹1L', '₹1L+', 'Flexible'];

export default function Preferences() {
  const { profile, user, refreshProfile } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.full_name ?? '');
  const [styles, setStyles] = useState<string[]>([]);
  const [ttype, setTtype] = useState<string | null>(null);
  const [budget, setBudget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = 4;

  const finish = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: name.trim(), travel_styles: styles, traveller_type: ttype, budget_preference: budget, onboarded: true,
      }).eq('id', user.id);
      if (error) throw error;
      track('onboarding_completed', { styles, ttype, budget });
      await refreshProfile();
    } catch (e) { toast(errMsg(e), 'error'); }
    finally { setBusy(false); }
  };

  const canNext = step === 0 ? name.trim().length >= 2 : step === 1 ? styles.length > 0 : step === 2 ? !!ttype : !!budget;
  const next = () => (step < total - 1 ? setStep(step + 1) : finish());

  return (
    <Screen keyboard>
      <Header back={step > 0} onBack={() => setStep(step - 1)} title={`Step ${step + 1} of ${total}`} />
      <ProgressBar value={(step + 1) / total} color={colors.primary} />
      <View style={{ marginTop: space.xl }}>
        {step === 0 && (
          <>
            <Text style={[type.h1, { color: colors.text, marginBottom: space.lg }]}>What should we call you?</Text>
            <Field label="Your name" value={name} onChangeText={setName} placeholder="Rupesh" autoComplete="name" />
          </>
        )}
        {step === 1 && (
          <>
            <Text style={[type.h1, { color: colors.text }]}>How do you like to travel?</Text>
            <Text style={[type.body, { color: colors.muted, marginBottom: space.lg }]}>Pick as many as you like.</Text>
            {STYLES.map(([l, e]) => (
              <OptionCard key={l} label={l} emoji={e} selected={styles.includes(l)} onPress={() => setStyles((s) => (s.includes(l) ? s.filter((x) => x !== l) : [...s, l]))} />
            ))}
          </>
        )}
        {step === 2 && (
          <>
            <Text style={[type.h1, { color: colors.text, marginBottom: space.lg }]}>Who do you usually travel with?</Text>
            {TYPES.map(([k, l]) => <OptionCard key={k} label={l} selected={ttype === k} onPress={() => setTtype(k)} />)}
          </>
        )}
        {step === 3 && (
          <>
            <Text style={[type.h1, { color: colors.text, marginBottom: space.lg }]}>What's your usual travel budget?</Text>
            {BUDGETS.map((b) => <OptionCard key={b} label={b} selected={budget === b} onPress={() => setBudget(b)} />)}
          </>
        )}
      </View>
      <Button title={step === total - 1 ? 'Finish Setup' : 'Continue'} onPress={next} disabled={!canNext} loading={busy} style={{ marginTop: space.lg }} />
    </Screen>
  );
}
