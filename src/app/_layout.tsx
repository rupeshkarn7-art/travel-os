import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../providers/AuthProvider';
import { ToastProvider, useToast } from '../components/ui';
import { colors, type } from '../lib/theme';
import { track } from '../lib/analytics';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

function Splash() {
  return (
    <View style={styles.splash}>
      <View style={styles.logo}><Text style={{ fontSize: 40 }}>🧭</Text></View>
      <Text style={[type.display, { color: '#fff', marginTop: 20 }]}>Travel OS</Text>
      <Text style={[type.body, { color: 'rgba(255,255,255,0.85)', marginTop: 6, textAlign: 'center' }]}>Everything you need to plan your trip.</Text>
      <ActivityIndicator color="#fff" style={{ marginTop: 32 }} />
    </View>
  );
}

function Gate() {
  const { session, profile, loading: authLoading, recovery, authNotice, clearAuthNotice } = useAuth();
  const toast = useToast();
  // Preload the icon font so icon-only buttons never render blank (notably on the web).
  const [fontsLoaded, fontError] = useFonts(MaterialIcons.font);
  const loading = authLoading || (!fontsLoaded && !fontError);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const root = segments[0] as string | undefined;
    const inAuth = root === '(auth)';
    const publicRoute = root === 'legal' || root === 'reset-password';
    if (recovery && root !== 'reset-password') { router.replace('/reset-password'); return; }
    if (!session) {
      if (!inAuth && !publicRoute) router.replace('/welcome');
      return;
    }
    if (profile && !profile.onboarded) {
      if (root !== 'preferences' && !publicRoute) router.replace('/preferences');
      return;
    }
    if (inAuth || root === 'preferences' && profile?.onboarded) router.replace('/');
  }, [session, profile, loading, recovery, segments, router]);

  useEffect(() => { if (session) track('app_open', { platform: Platform.OS }); }, [session?.user.id]);

  // Result of opening an email verification link (success, or expired/invalid link).
  useEffect(() => {
    if (loading || !authNotice) return;
    toast(authNotice.message, authNotice.tone);
    if (authNotice.tone === 'success') track('email_verified');
    clearAuthNotice();
  }, [loading, authNotice, toast, clearAuthNotice]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.bg } }} />
      {loading ? <View style={StyleSheet.absoluteFill}><Splash /></View> : null}
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <StatusBar style="dark" />
            <Gate />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logo: { width: 84, height: 84, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
});
