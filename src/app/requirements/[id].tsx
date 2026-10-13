import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, EmptyState, ErrorState, Header, Icon, Loading, Screen, Section, TrustBadge, VerifyNotice } from '../../components/ui';
import { useDestination, useRequirements } from '../../hooks/data';
import type { RequirementDoc } from '../../lib/types';
import { colors, space, type } from '../../lib/theme';
import { fmtDateLong } from '../../lib/format';
import { openUrl } from '../../lib/maps';
import { track } from '../../lib/analytics';

function ReqCard({ r, kind }: { r: RequirementDoc; kind: 'document' | 'permit' }) {
  const [open, setOpen] = useState(false);
  const name = r.document_name ?? r.permit_name ?? '';
  return (
    <Card onPress={() => { setOpen(!open); if (!open) track(kind === 'document' ? 'document_viewed' : 'permit_viewed', { name }); }} accessibilityLabel={name}
      style={r.status === 'expired' ? { borderColor: colors.error } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name={kind === 'document' ? 'badge' : 'assignment'} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[type.title, { color: colors.text }]}>{name}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
            <Badge label={(r.mandatory ?? r.required) ? 'Mandatory' : 'Recommended'} tone={(r.mandatory ?? r.required) ? 'error' : 'neutral'} />
            {r.state_id && !r.destination_id ? <Badge label="Applies to the whole state/UT" tone="info" /> : null}
          </View>
        </View>
        <Icon name={open ? 'expand-less' : 'expand-more'} color={colors.muted} />
      </View>
      {open ? (
        <View style={{ marginTop: space.md, gap: 8 }}>
          <Text style={[type.small, { color: colors.text }]}>{r.description}</Text>
          {r.applicable_to ? <Text style={[type.small, { color: colors.muted }]}>Who needs it: {r.applicable_to}</Text> : null}
          {r.cost ? <Text style={[type.small, { color: colors.muted }]}>Cost: {r.cost}</Text> : null}
          {r.processing_time ? <Text style={[type.small, { color: colors.muted }]}>Processing time: {r.processing_time}</Text> : null}
          <Text style={[type.small, { color: colors.muted }]}>Source: {r.source ?? 'Not specified'}</Text>
          <Text style={[type.small, { color: colors.muted }]}>Last verified: {r.last_verified ? fmtDateLong(r.last_verified) : 'Not yet verified'}{r.review_date ? ` · Next review: ${fmtDateLong(r.review_date)}` : ''}</Text>
          <TrustBadge source={r.source_type} status={r.status} lastVerified={r.last_verified} />
          {r.status !== 'verified' ? (
            <View style={{ flexDirection: 'row', gap: 8, backgroundColor: colors.warningTint, padding: 10, borderRadius: 12 }}>
              <Icon name="warning-amber" color="#B45309" size={20} />
              <Text style={[type.small, { color: '#7C4A03', flex: 1 }]}>This is not confirmed as current. Do not rely on it as guaranteed — check the official source before you travel.</Text>
            </View>
          ) : null}
          {r.reconfirm_note ? <Text style={[type.small, { color: colors.primaryDark }]}>When to reconfirm: {r.reconfirm_note}</Text> : null}
          {r.source_url ? <Button title="Open official source" icon="open-in-new" variant="secondary" small onPress={() => openUrl(r.source_url)} style={{ alignSelf: 'flex-start' }} /> : null}
        </View>
      ) : null}
    </Card>
  );
}

export default function Requirements() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const d = useDestination(id);
  const q = useRequirements(id, d.data?.state_id);
  return (
    <Screen>
      <Header title="Documents & permits" subtitle={d.data?.name} />
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : (
        <>
          <VerifyNotice lastVerified={null} extra="Rules can change at short notice." />
          <Section title="Documents">
            <View style={{ gap: 10 }}>
              {q.data?.documents.length ? q.data.documents.map((r) => <ReqCard key={r.id} r={r} kind="document" />) : <Text style={[type.small, { color: colors.muted }]}>No documents listed.</Text>}
            </View>
          </Section>
          <Section title="Permits">
            <View style={{ gap: 10 }}>
              {q.data?.permits.length ? q.data.permits.map((r) => <ReqCard key={r.id} r={r} kind="permit" />) : (
                <Card><Text style={[type.small, { color: colors.muted }]}>No special permits are listed for this destination. Rules change — confirm with local authorities or the official tourism site before you travel.</Text></Card>
              )}
            </View>
          </Section>
        </>
      )}
    </Screen>
  );
}
