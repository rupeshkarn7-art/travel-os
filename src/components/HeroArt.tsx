import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { categoryArt } from '../lib/theme';

export function artFor(categories?: string[] | null) {
  const c = categories?.find((x) => categoryArt[x]) ?? 'default';
  return categoryArt[c] ?? categoryArt.default;
}

/** Photo if uploaded, otherwise a category-themed gradient (no broken images, ever). */
export function HeroArt({
  image, categories, height = 160, radius = 16, children, style, emojiSize = 56,
}: {
  image?: string | null; categories?: string[] | null; height?: number; radius?: number;
  children?: React.ReactNode; style?: StyleProp<ViewStyle>; emojiSize?: number;
}) {
  const art = artFor(categories);
  const [failed, setFailed] = React.useState(false);
  return (
    <View style={[{ height, borderRadius: radius, overflow: 'hidden' }, style]}>
      <LinearGradient colors={art.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {image && !failed ? (
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
      ) : (
        <Text style={{ position: 'absolute', right: 16, top: 12, fontSize: emojiSize, opacity: 0.9 }}>{art.emoji}</Text>
      )}
      {children}
    </View>
  );
}
