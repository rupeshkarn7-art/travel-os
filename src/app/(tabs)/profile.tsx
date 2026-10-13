import React from 'react';
import { Image, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Header, Icon, Row, Screen, Section, confirmAction } from '../../components/ui';
import { useAuth } from '../../providers/AuthProvider';
import { useSaved, useTrips } from '../../hooks/data';
import { colors, space, type } from '../../lib/theme';

export default function Profile() {
  const router = useRouter();
  const { profile, user, isAdmin, signOut } = useAuth();
  const trips = useTrips(); const saved = useSaved();
  const name = profile?.full_name || user?.email?.split('@')[0] || 'Traveller';
  return (
    <Screen>
      <Header title="Profile" back={false} />
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={{ width: 64, height: 64, borderRadius: 32 }} accessibilityLabel="Profile photo" />
          : <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}><Text style={[type.h2, { color: colors.primary }]}>{name[0]?.toUpperCase()}</Text></View>}
        <View style={{ flex: 1 }}>
          <Text style={[type.title, { color: colors.text }]}>{name}</Text>
          <Text style={[type.small, { color: colors.muted }]}>{user?.email}</Text>
          <Text style={[type.caption, { color: colors.muted, marginTop: 2 }]}>{trips.data?.length ?? 0} trips · {saved.data?.length ?? 0} saved</Text>
        </View>
      </Card>
      <Section title="Account">
        <Card style={{ paddingVertical: 4 }}>
          <Row icon="edit" label="Edit profile" onPress={() => router.push('/edit-profile')} />
          <Row icon="favorite-border" label="Saved places" onPress={() => router.push('/saved')} />
          <Row icon="notifications-none" label="Notifications" onPress={() => router.push('/notifications')} />
          <Row icon="tune" label="Travel preferences" onPress={() => router.push('/preferences')} />
          <Row icon="settings" label="Settings & privacy" onPress={() => router.push('/settings')} />
        </Card>
      </Section>
      <Section title="Support">
        <Card style={{ paddingVertical: 4 }}>
          <Row icon="help-outline" label="Help & feedback" onPress={() => router.push('/help')} />
          <Row icon="privacy-tip" label="Privacy policy" onPress={() => router.push('/legal/privacy')} />
          <Row icon="description" label="Terms of use" onPress={() => router.push('/legal/terms')} />
          {isAdmin ? <Row icon="admin-panel-settings" label="Admin console" onPress={() => router.push('/admin')} /> : null}
        </Card>
      </Section>
      <View style={{ height: space.lg }} />
      <Card style={{ paddingVertical: 4 }}>
        <Row icon="logout" label="Log out" danger onPress={async () => { if (await confirmAction('Log out?', 'You can sign back in any time.', 'Log out', false)) signOut(); }} />
      </Card>
    </Screen>
  );
}
