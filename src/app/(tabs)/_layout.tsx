import React from 'react';
import { Tabs } from 'expo-router';
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
        // Always show the label under the icon (never beside it, never hidden).
        tabBarLabelPosition: 'below-icon',
        // flexShrink: 0 stops the label being squashed under the icon on small/web layouts.
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', lineHeight: 16, flexShrink: 0 },
        tabBarItemStyle: { paddingVertical: 2 },
        tabBarStyle: {
          // Room for a 24px icon + one line of label + padding, plus the phone's home-indicator area.
          height: 64 + insets.bottom,
          paddingTop: 6,
          paddingBottom: 8 + insets.bottom,
          backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1,
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
