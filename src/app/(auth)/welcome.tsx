import React, { useRef, useState } from 'react';
import { FlatList, Text, View, useWindowDimensions, StyleSheet } from 'react-native';
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
  const { width } = useWindowDimensions();
  const w = Math.min(width, 520);
  const [i, setI] = useState(0);
  const ref = useRef<FlatList>(null);
  const last = i === slides.length - 1;
  const next = () => (last ? router.push('/register') : ref.current?.scrollToIndex({ index: i + 1, animated: true }));
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
          onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / w))}
          getItemLayout={(_, index) => ({ length: w, offset: w * index, index })}
          renderItem={({ item }) => (
            <View style={{ width: w, padding: space.lg }}>
              <LinearGradient colors={item.grad} style={styles.hero}>
                <Text style={{ fontSize: 96 }}>{item.emoji}</Text>
              </LinearGradient>
              <Text style={[type.h1, { color: colors.text, marginTop: space.xl }]}>{item.title}</Text>
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
            {slides.map((_, k) => <View key={k} style={{ width: k === i ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: k === i ? colors.primary : colors.border }} />)}
          </View>
          <Button title={last ? 'Personalise My Travel' : i === 0 ? 'Get Started' : 'Continue'} onPress={next} />
          <View style={{ height: 10 }} />
          <Button title="I already have an account" variant="ghost" onPress={() => router.push('/login')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { height: 280, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  point: { backgroundColor: colors.successTint, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
});
