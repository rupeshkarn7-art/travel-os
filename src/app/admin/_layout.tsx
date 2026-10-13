import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../providers/AuthProvider';

export default function AdminLayout() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
