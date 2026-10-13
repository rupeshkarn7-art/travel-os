import React from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '../../components/ui';
import { colors } from '../../lib/theme';

const tab = (name: IconName) => ({ color }: { color: string | import('react-native').OpaqueColorValue }) => <Icon name={name} color={color as string} size={24} />;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: {
          height: 56 + Math.max(insets.bottom, Platform.OS === 'web' ? 0 : 8),
          paddingBottom: Math.max(insets.bottom, 8), paddingTop: 6,
          backgroundColor: colors.surface, borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tab('home') }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: tab('explore') }} />
      <Tabs.Screen name="trips" options={{ title: 'Trips', tabBarIcon: tab('flight-takeoff') }} />
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: tab('map') }} />
      <Tabs.Screen name="profile" options={{ title: 'Me', tabBarIcon: tab('person') }} />
    </Tabs>
  );
}
