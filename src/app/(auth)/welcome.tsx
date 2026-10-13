import React, { useRef, useState } from 'react';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, Pressable, Text, View, useWindowDimensions, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '../../components/ui';
import { colors, space, type } from '../../lib/theme';

const slides = [
  { emoji: '🏔️', grad: ['#2F80ED', '#0B1F3A'] as [string, string], title: 'Plan your entire trip in one place.', text: 'Discover destinations, understand travel requirements and organise your journey without switching between multiple apps.', points: [] as string[] },
  { emoji: '📋', grad: ['#FF8A3D', '#9A3412'] as [string, string], title: 'Know what you need before you go.', text: 'See the documents and permits for your destination — always with a source and a last-verified date.', points: ['Documents', 'Permits', 'Local rules', 'Safety information'] },
  { emoji: '🧳', grad: ['#16A34A', '#064E3B'] as [string, string], title: 'Build a trip that fits you.', text: 'Set your dates, travellers and budget. Get a day-wise itinerary, a budget and a checklist in minutes.', points: ['Dates', 'Travellers', 'Budget', 'Interests', 'Transport'] },
];

export default function Welcome() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  // Shrink the picture on short phones so the slide text never runs under the buttons.
  const heroH = Math.max(130, Math.min(280, height - 450));
  const w = Math.min(width, 520);
  const [i, setI] = useState(0);
  const ref = useRef<FlatList>(null);
  const goTo = (k: number) => { setI(k); ref.current?.scrollToIndex({ index: k, animated: true }); };
  // Track the visible slide from scroll position (momentum events don't fire on the web).
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const k = Math.round(e.nativeEvent.contentOffset.x / w);
    if (k !== i && k >= 0 && k < slides.length) setI(k);
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center' }}>
      <View style={{ width: w, flex: 1 }}>
        <FlatList
          ref={ref}
          data={slides}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(s) => s.title}
          onScroll={onScroll}
          scrollEventThrottle={32}
          getItemLayout={(_, index) => ({ length: w, offset: w * index, index })}
          renderItem={({ item }) => (
            <View style={{ width: w, padding: space.lg }}>
              <LinearGradient colors={item.grad} style={[styles.hero, { height: heroH }]}>
                <Text style={{ fontSize: heroH < 200 ? 64 : 96 }}>{item.emoji}</Text>
              </LinearGradient>
              <Text style={[heroH < 200 ? type.h2 : type.h1, { color: colors.text, marginTop: heroH < 200 ? space.lg : space.xl }]}>{item.title}</Text>
              <Text style={[type.body, { color: colors.muted, marginTop: space.sm }]}>{item.text}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.lg }}>
                {item.points.map((p: string) => (
                  <View key={p} style={styles.point}><Text style={[type.small, { color: colors.success, fontWeight: '600' }]}>✓ {p}</Text></View>
                ))}
              </View>
            </View>
          )}
        />
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: space.lg }}>
            {slides.map((_, k) => (
              <Pressable key={k} onPress={() => goTo(k)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Show slide ${k + 1} of ${slides.length}`}
                accessibilityState={{ selected: k === i }}>
                <View style={{ width: k === i ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: k === i ? colors.primary : colors.faint }} />
              </Pressable>
            ))}
          </View>
          <Button title="Create an account" icon="person-add" onPress={() => router.push('/register')} />
          <View style={{ height: 10 }} />
          <Button title="I already have an account" variant="secondary" onPress={() => router.push('/login')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { height: 280, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  point: { backgroundColor: colors.successTint, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
});
