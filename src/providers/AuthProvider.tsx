import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { useQueryClient } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';
import { track } from '../lib/analytics';

interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  recovery: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, phone: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  clearRecovery: () => void;
  resendVerification: (email: string) => Promise<void>;
  /** Set after the user opens a sign-up verification link (or an expired/invalid one). */
  authNotice: { tone: 'success' | 'error'; message: string } | null;
  clearAuthNotice: () => void;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(Ctx);

// On the web the app may be hosted under a sub-path (e.g. https://example.com/travel-os),
// so auth emails and OAuth must return to that path rather than the site root.
const webBaseUrl = () => {
  const base = (Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl ?? '';
  return `${window.location.origin}${base.replace(/\/$/, '')}`;
};
// Auth email links end in "/" so they match a Supabase redirect allow-list entry like https://site/travel-os/**
const webAuthReturnUrl = () => `${webBaseUrl()}/`;
const redirectUrl = () => (Platform.OS === 'web' ? webAuthReturnUrl() : Linking.createURL('reset-password'));
// Where the "verify your email" link should land: the app home (handled by handleUrl / detectSessionInUrl).
const verifyRedirectUrl = () => (Platform.OS === 'web' ? webAuthReturnUrl() : Linking.createURL('/'));

/** Reads Supabase auth parameters from a link's #fragment or ?query. */
function authParams(url: string) {
  const out = new URLSearchParams();
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.split('?')[1] ?? '';
  new URLSearchParams(query).forEach((v, k) => out.set(k, v));
  new URLSearchParams(hash).forEach((v, k) => out.set(k, v));
  return out;
}

function noticeFromLink(q: URLSearchParams): { tone: 'success' | 'error'; message: string } | null {
  const err = q.get('error_code') || q.get('error');
  if (err) {
    return {
      tone: 'error',
      message: /expired/i.test(err + (q.get('error_description') ?? ''))
        ? 'That verification link has expired. Log in to get a new one.'
        : 'That link is no longer valid. Log in to get a new one.',
    };
  }
  const t = q.get('type');
  if (t === 'signup' || t === 'email' || t === 'email_change') return { tone: 'success', message: 'Email verified — welcome to Travel OS!' };
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [authNotice, setAuthNotice] = useState<AuthCtx['authNotice']>(() =>
    Platform.OS === 'web' && typeof window !== 'undefined' ? noticeFromLink(authParams(window.location.href)) : null);

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) { setProfile(null); setIsAdmin(false); return; }
    let p: Profile | null = null;
    for (let i = 0; i < 4 && !p; i++) {
      const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      p = (data as Profile | null) ?? null;
      if (!p) await new Promise((r) => setTimeout(r, 400));
    }
    setProfile(p);
    const { data: adm } = await supabase.from('admin_users').select('role,status').eq('user_id', uid).maybeSingle();
    setIsAdmin(!!adm && adm.status === 'active');
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      if (mounted) setLoading(false);
    }).catch(() => mounted && setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') { qc.clear(); setProfile(null); setIsAdmin(false); }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // defer to avoid deadlocks inside the auth callback
        setTimeout(() => loadProfile(s?.user.id), 0);
      }
    });

    const appSub = AppState.addEventListener('change', (st) => {
      if (Platform.OS === 'web') return;
      if (st === 'active') supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh();
    });
    if (Platform.OS !== 'web') supabase.auth.startAutoRefresh();

    // Auth deep links on native (on the web, supabase-js reads the URL itself):
    //   travelos://reset-password#access_token=…&refresh_token=…&type=recovery  → password reset
    //   travelos://#access_token=…&refresh_token=…&type=signup                  → email verified, signed in
    const handleUrl = async (url: string | null) => {
      if (!url || Platform.OS === 'web') return;
      const q = authParams(url);
      const notice = noticeFromLink(q);
      const at = q.get('access_token');
      const rt = q.get('refresh_token');
      if (at && rt) {
        const { error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt });
        if (error) { setAuthNotice({ tone: 'error', message: 'That link is no longer valid. Log in to get a new one.' }); return; }
        if (q.get('type') === 'recovery') { setRecovery(true); return; }
      }
      if (notice) setAuthNotice(notice);
    };
    Linking.getInitialURL().then(handleUrl).catch(() => {});
    const linkSub = Linking.addEventListener('url', (e) => handleUrl(e.url));

    return () => { mounted = false; sub.subscription.unsubscribe(); appSub.remove(); linkSub.remove(); };
  }, [loadProfile, qc]);

  const value = useMemo<AuthCtx>(() => ({
    session, user: session?.user ?? null, profile, isAdmin, loading, recovery,
    refreshProfile: () => loadProfile(session?.user.id),
    clearRecovery: () => setRecovery(false),
    authNotice,
    clearAuthNotice: () => setAuthNotice(null),
    resendVerification: async (email) => {
      const { error } = await supabase.auth.resend({
        type: 'signup', email: email.trim().toLowerCase(), options: { emailRedirectTo: verifyRedirectUrl() },
      });
      if (error) throw error;
    },
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw error;
    },
    signUp: async (name, email, phone, password) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(), password,
        options: { data: { full_name: name.trim(), phone: phone.trim() }, emailRedirectTo: verifyRedirectUrl() },
      });
      if (error) throw error;
      if (data.user) track('signup_completed');
      return { needsConfirmation: !data.session };
    },
    signOut: async () => { await supabase.auth.signOut(); },
    resetPassword: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: redirectUrl() });
      if (error) throw error;
    },
    updatePassword: async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    signInWithGoogle: async () => {
      const WebBrowser = await import('expo-web-browser');
      const redirectTo = Platform.OS === 'web' ? webAuthReturnUrl() : Linking.createURL('/');
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' } });
      if (error) throw error;
      if (Platform.OS !== 'web' && data.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (res.type === 'success') {
          const frag = res.url.split('#')[1] ?? '';
          const q = new URLSearchParams(frag);
          const at = q.get('access_token'); const rt = q.get('refresh_token');
          if (at && rt) await supabase.auth.setSession({ access_token: at, refresh_token: rt });
        }
      }
    },
  }), [session, profile, isAdmin, loading, recovery, authNotice, loadProfile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
