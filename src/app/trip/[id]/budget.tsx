import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, Chip, ChipRow, DateField, EmptyState, ErrorState, Field, Header, IconButton, Loading, ProgressBar, Screen, Section, Sheet, Stat, confirmAction, useToast } from '../../../components/ui';
import { useBudget, useTrip } from '../../../hooks/data';
import { supabase } from '../../../lib/supabase';
import { colors, space, type } from '../../../lib/theme';
import { errMsg, fmtDate, inr, todayISO } from '../../../lib/format';
import { track } from '../../../lib/analytics';

const CATS = ['Transportation', 'Accommodation', 'Food', 'Activities', 'Local transport', 'Permits', 'Shopping', 'Miscellaneous'];

export default function Budget() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const trip = useTrip(id);
  const q = useBudget(id);
  const [exp, setExp] = useState<null | { category: string; amount: string; note: string; date: string }>(null);
  const [est, setEst] = useState<null | { id: string; category: string; amount: string }>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (trip.isLoading || q.isLoading) return <Screen><Loading /></Screen>;
  if (!trip.data || q.isError) return <Screen><Header /><ErrorState message={q.isError ? errMsg(q.error) : 'Trip not found.'} onRetry={() => q.refetch()} /></Screen>;
  const t = trip.data;
  const cats = q.data?.categories ?? [];
  const expenses = q.data?.expenses ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['budget'] });
  const estimated = cats.reduce((s, c) => s + Number(c.estimated_amount), 0);
  const spent = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const remaining = t.budget - spent;
  const spentBy = (c: string) => expenses.filter((e) => e.category === c).reduce((s, e) => s + Number(e.amount), 0);

  const addExpense = async () => {
    if (!exp) return;
    const e: Record<string, string> = {};
    const amount = Number(exp.amount);
    if (!(amount > 0)) e.amount = 'Enter an amount greater than zero.';
    if (!exp.date) e.date = 'Pick a date.';
    setErr(e); if (Object.keys(e).length) return;
    setBusy(true);
    const { error } = await supabase.from('expenses').insert({ trip_id: t.id, category: exp.category, amount, expense_date: exp.date, note: exp.note.trim() || null });
    setBusy(false);
    if (error) { toast(errMsg(error), 'error'); return; }
    track('expense_added', { category: exp.category });
    await refresh(); setExp(null);
  };

  const saveEstimate = async () => {
    if (!est) return;
    const amount = Number(est.amount);
    if (!(amount >= 0) || est.amount === '') { setErr({ est: 'Enter a valid amount.' }); return; }
    setBusy(true);
    const { error } = await supabase.from('budget_categories').update({ estimated_amount: amount }).eq('id', est.id);
    setBusy(false);
    if (error) { toast(errMsg(error), 'error'); return; }
    await refresh(); setEst(null);
  };

  const removeExpense = async (eid: string) => {
    if (!(await confirmAction('Delete expense?', 'This cannot be undone.', 'Delete'))) return;
    const { error } = await supabase.from('expenses').delete().eq('id', eid);
    if (error) toast(errMsg(error), 'error'); else refresh();
  };

  return (
    <Screen bottom onRefresh={refresh}>
      <Header title="Budget" subtitle={t.destinations?.name} />
      <Card>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Stat label="Total budget" value={inr(t.budget)} />
          <Stat label="Spent" value={inr(spent)} tone={spent > t.budget ? colors.error : undefined} />
          <Stat label={remaining < 0 ? 'Over by' : 'Remaining'} value={inr(Math.abs(remaining))} tone={remaining < 0 ? colors.error : colors.success} />
        </View>
        <View style={{ marginTop: 12 }}><ProgressBar value={t.budget ? Math.min(spent / t.budget, 1) : 0} color={spent > t.budget ? colors.error : colors.primary} height={10} /></View>
        {Math.abs(estimated - t.budget) > 1 ? <Text style={[type.caption, { color: colors.warning, marginTop: 8 }]}>Category estimates total {inr(estimated)}, which differs from your trip budget.</Text> : null}
      </Card>
      <Button title="Recalculate with budget calculator" icon="calculate" variant="secondary" small onPress={() => router.push(`/budget-calculator?trip=${id}`)} style={{ marginTop: space.md, alignSelf: 'flex-start' }} />

      <Section title="Categories">
        <View style={{ gap: 10 }}>
          {cats.map((c) => {
            const s = spentBy(c.category); const over = s > Number(c.estimated_amount);
            return (
              <Card key={c.id} style={{ padding: 12 }} onPress={() => { setErr({}); setEst({ id: c.id, category: c.category, amount: String(Math.round(c.estimated_amount)) }); }} accessibilityLabel={`Edit ${c.category} estimate`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[type.body, { color: colors.text, fontWeight: '600' }]}>{c.category}</Text>
                  <Text style={[type.small, { color: over ? colors.error : colors.muted }]}>{inr(s)} / {inr(c.estimated_amount)}</Text>
                </View>
                <View style={{ marginTop: 8 }}><ProgressBar value={Number(c.estimated_amount) ? Math.min(s / Number(c.estimated_amount), 1) : s > 0 ? 1 : 0} color={over ? colors.error : colors.success} /></View>
              </Card>
            );
          })}
        </View>
      </Section>

      <Section title="Expenses" action="Add" onAction={() => { setErr({}); setExp({ category: 'Food', amount: '', note: '', date: todayISO() }); }}>
        {expenses.length === 0 ? <EmptyState icon="receipt-long" title="No expenses yet" text="Log what you spend to compare against your plan." action="Add expense" onAction={() => { setErr({}); setExp({ category: 'Food', amount: '', note: '', date: todayISO() }); }} /> : (
          <View style={{ gap: 8 }}>
            {expenses.map((e) => (
              <Card key={e.id} style={{ padding: 12, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { color: colors.text }]}>{inr(e.amount)} · {e.category}</Text>
                  <Text style={[type.caption, { color: colors.muted }]}>{fmtDate(e.expense_date)}{e.note ? ` · ${e.note}` : ''}</Text>
                </View>
                <IconButton name="delete-outline" label="Delete expense" color={colors.error} onPress={() => removeExpense(e.id)} />
              </Card>
            ))}
          </View>
        )}
      </Section>

      <Sheet visible={!!exp} onClose={() => setExp(null)} title="Add expense">
        {exp ? (
          <>
            <Text style={[type.small, { color: colors.text, fontWeight: '600', marginBottom: 8 }]}>Category</Text>
            <ChipRow>{CATS.map((c) => <Chip key={c} label={c} selected={exp.category === c} onPress={() => setExp({ ...exp, category: c })} />)}</ChipRow>
            <View style={{ height: space.lg }} />
            <Field label="Amount (₹)" value={exp.amount} onChangeText={(x) => setExp({ ...exp, amount: x.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" error={err.amount} />
            <DateField label="Date" value={exp.date} onChange={(v) => setExp({ ...exp, date: v })} error={err.date} />
            <Field label="Note (optional)" value={exp.note} onChangeText={(x) => setExp({ ...exp, note: x })} />
            <Button title="Save expense" onPress={addExpense} loading={busy} />
          </>
        ) : null}
      </Sheet>

      <Sheet visible={!!est} onClose={() => setEst(null)} title={est ? `${est.category} estimate` : ''}>
        {est ? (
          <>
            <Field label="Estimated amount (₹)" value={est.amount} onChangeText={(x) => setEst({ ...est, amount: x.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" error={err.est} />
            <Button title="Save" onPress={saveEstimate} loading={busy} />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
