import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Chip, ChipRow, Field, Header, Screen, Section, useToast } from '../components/ui';
import { useAuth } from '../providers/AuthProvider';
import { supabase } from '../lib/supabase';
import { colors, space, type } from '../lib/theme';
import { errMsg } from '../lib/format';

const FAQ = [
  ['How reliable is the information?', 'Each item carries a trust badge: Official, Verified, Community or AI-generated. Starter content is marked “needs review”. Always confirm permits, prices and timings with official sources before you travel.'],
  ['Can I book hotels or transport here?', 'Not yet. Travel OS helps you plan; booking happens with your chosen providers.'],
  ['How do I change my itinerary?', 'Open the trip, tap Itinerary, then add, edit, reorder or remove activities.'],
  ['How do I delete my data?', 'Profile → Settings & privacy → Delete my account.'],
];

export default function Help() {
  const toast = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const [kind, setKind] = useState('Feedback');
  const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const send = async () => {
    if (msg.trim().length < 5) { setErr('Please write at least a few words.'); return; }
    setBusy(true);
    const { error } = await supabase.from('reports').insert({ reporter_id: user?.id, content_type: kind.toLowerCase().replace(/ /g, '_'), reason: msg.trim() });
    setBusy(false);
    if (error) { toast(errMsg(error), 'error'); return; }
    setMsg(''); setErr(''); toast('Thanks — we received your message', 'success');
  };
  return (
    <Screen keyboard>
      <Header title="Help & feedback" />
      <Section title="FAQ">
        <View style={{ gap: 8 }}>
          {FAQ.map(([q, a], i) => (
            <Card key={q} onPress={() => setOpen(open === i ? null : i)} accessibilityLabel={q}>
              <Text style={[type.body, { color: colors.text, fontWeight: '600' }]}>{q}</Text>
              {open === i ? <Text style={[type.small, { color: colors.muted, marginTop: 6 }]}>{a}</Text> : null}
            </Card>
          ))}
        </View>
      </Section>
      <Section title="Contact us">
        <ChipRow>{['Feedback', 'Bug', 'Wrong information'].map((k) => <Chip key={k} label={k} selected={kind === k} onPress={() => setKind(k)} />)}</ChipRow>
        <View style={{ height: space.md }} />
        <Field label="Message" value={msg} onChangeText={setMsg} multiline error={err} style={{ minHeight: 100, textAlignVertical: 'top' }} />
        <Button title="Send" onPress={send} loading={busy} />
      </Section>
    </Screen>
  );
}
