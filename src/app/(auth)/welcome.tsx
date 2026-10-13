import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, G, LinearGradient as SvgGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Button, Icon, IconName } from '../../components/ui';
import { colors, space } from '../../lib/theme';

/* Dawn over India: Himalaya, a fort-and-temple skyline, and a palm coast — one scene, one sunrise. */
const DAWN = { night: '#1A1446', violet: '#5B3C8C', saffron: '#F07A4A', marigold: '#FFC56B', ridge: '#8C79B8', snow: '#F3E9FF', skyline: '#2E2160', sea: '#1769E0', deep: '#0E3F96', ink: '#120E33' };

function Sky() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 400 320" preserveAspectRatio="xMidYMax slice" style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={DAWN.night} />
          <Stop offset="0.45" stopColor={DAWN.violet} />
          <Stop offset="0.78" stopColor={DAWN.saffron} />
          <Stop offset="1" stopColor={DAWN.marigold} />
        </SvgGradient>
      </Defs>
      <Rect x="0" y="0" width="400" height="320" fill="url(#sky)" />
      {[[40, 30, 1.2], [92, 58, 0.8], [150, 22, 1], [228, 44, 0.9], [300, 18, 1.3], [352, 60, 0.8], [270, 80, 0.7], [20, 90, 0.7]].map(([x, y, r], i) => (
        <Circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={0.7} />
      ))}
    </Svg>
  );
}

function Land() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 400 320" preserveAspectRatio="xMidYMax slice" style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={DAWN.sea} />
          <Stop offset="1" stopColor={DAWN.deep} />
        </SvgGradient>
      </Defs>
      {/* Himalayan range */}
      <Path d="M0 212 L38 170 L62 188 L104 132 L132 166 L160 142 L196 186 L238 120 L268 160 L300 136 L340 180 L372 150 L400 172 L400 240 L0 240 Z" fill={DAWN.ridge} opacity={0.9} />
      <Path d="M104 132 L94 145 L104 141 L113 147 Z M238 120 L226 135 L238 131 L249 138 Z M300 136 L291 147 L300 144 L309 149 Z" fill={DAWN.snow} />
      {/* Fort, dome and temple skyline */}
      <Path
        d="M0 246 L0 222 L18 222 L18 214 L24 214 L24 222 L40 222 L40 210 L46 204 L52 210 L52 222 L70 222
           L70 204 Q86 176 102 204 L102 222 L112 222 L112 196 L116 190 L120 196 L120 222 L140 222
           L150 196 L156 182 L160 170 L164 182 L170 196 L180 222 L196 222 L196 212 L232 212 L232 200 L238 200 L238 212 L262 212
           L262 192 L268 186 L274 192 L274 212 L292 212 L300 196 L306 186 L312 196 L320 212 L344 212 L344 204 L366 204 L366 214 L400 214 L400 246 Z"
        fill={DAWN.skyline}
      />
      <Path d="M86 178 L86 170" stroke={DAWN.skyline} strokeWidth={1.5} />
      <Path d="M160 170 L160 160" stroke={DAWN.skyline} strokeWidth={1.5} />
      {/* Sea with sun glints */}
      <Rect x="0" y="244" width="400" height="76" fill="url(#sea)" />
      {[[150, 254, 100], [170, 264, 60], [184, 274, 34], [120, 262, 24], [240, 258, 30]].map(([x, y, w], i) => (
        <Rect key={i} x={x} y={y} width={w} height={2} rx={1} fill={DAWN.marigold} opacity={0.55 - i * 0.07} />
      ))}
      {/* Palms */}
      <G fill={DAWN.ink}>
        <Path d="M24 320 Q30 280 44 248 L47 249 Q36 282 32 320 Z" />
        <Path d="M45 248 Q24 236 4 246 Q24 240 45 251 Z M45 248 Q66 230 86 238 Q66 238 46 251 Z M45 249 Q40 228 22 222 Q42 230 47 250 Z M45 249 Q58 228 76 226 Q58 234 47 251 Z" />
        <Path d="M372 320 Q368 290 356 262 L353 263 Q362 290 364 320 Z" />
        <Path d="M355 262 Q374 250 396 258 Q374 254 355 265 Z M355 262 Q338 246 316 252 Q336 252 354 265 Z M355 263 Q362 244 380 238 Q362 248 356 265 Z" />
      </G>
      {/* Birds */}
      <G stroke="#fff" strokeWidth={1.4} fill="none" opacity={0.8}>
        <Path d="M262 86 q5 -5 10 0 q5 -5 10 0" />
        <Path d="M290 102 q4 -4 8 0 q4 -4 8 0" />
      </G>
    </Svg>
  );
}

function Sun({ reduceMotion }: { reduceMotion: boolean }) {
  const rise = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) { rise.setValue(1); return; }
    Animated.timing(rise, { toValue: 1, duration: 2600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [reduceMotion, rise]);
  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [70, 0] });
  return (
    <Animated.View pointerEvents="none" style={[styles.sun, { transform: [{ translateY }], opacity: rise.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="glow" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
            <Stop offset="0.35" stopColor="#FFE3A3" stopOpacity="1" />
            <Stop offset="0.55" stopColor="#FFB453" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#FF8A3D" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill="url(#glow)" />
        <Circle cx="50" cy="50" r="18" fill="#FFF1C9" />
      </Svg>
    </Animated.View>
  );
}

const PROMISES: [IconName, string][] = [
  ['public', 'Every state and union territory, from Ladakh to the Andamans'],
  ['assignment-turned-in', 'Permits and entry rules, each with its official source'],
  ['event-note', 'Day-by-day plans, budgets and checklists in one place'],
];

const TOUR: { icon: IconName; title: string; text: string }[] = [
  { icon: 'travel-explore', title: 'Find where to go', text: 'Browse India by region and state, filter by month, trip length and budget, or see what is near you.' },
  { icon: 'verified-user', title: 'Know what you need', text: 'See documents and permits such as Inner Line Permits, with the official link and the date we last checked.' },
  { icon: 'map', title: 'Plan the whole trip', text: 'Pick your dates and pace. Get a day-wise plan in sensible order, a budget and a packing checklist.' },
];

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [tour, setTour] = useState<number | null>(null);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {}); }, []);

  const colW = Math.min(width, 560);
  const small = width < 360 || height < 620;
  // The text panel needs ~430px; the scene takes whatever is left (never less than 190px, never more than 470px).
  const sceneH = Math.max(190, Math.min(height - 430 - insets.bottom, 470));
  const step = tour != null ? TOUR[tour] : null;
  const last = tour === TOUR.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: DAWN.night }}>
      <View style={{ height: sceneH + 28, overflow: 'hidden' }} accessible accessibilityRole="image"
        accessibilityLabel="Illustration: sunrise over the Himalaya, a fort and temple skyline, and a palm-lined coast">
        <Sky />
        <Sun reduceMotion={reduceMotion} />
        <Land />
        <View style={[styles.heroText, { paddingTop: insets.top + space.lg, width: colW, alignSelf: 'center' }]}>
          <View style={styles.brand}>
            <View style={styles.mark}><Icon name="explore" size={18} color={DAWN.night} /></View>
            <Text style={styles.brandName}>Travel OS</Text>
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <ScrollView bounces={false} showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, width: colW, alignSelf: 'center', paddingHorizontal: space.xl, paddingBottom: Math.max(insets.bottom, space.lg) }}>
          {step ? (
            <View style={{ flexGrow: 1 }} accessibilityLiveRegion="polite">
              <View style={styles.stepIcon}><Icon name={step.icon} size={26} color={colors.primary} /></View>
              <Text style={styles.headline}>{step.title}</Text>
              <Text style={styles.lede}>{step.text}</Text>
              <View style={styles.dots}>
                {TOUR.map((_, k) => (
                  <Pressable key={k} onPress={() => setTour(k)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Step ${k + 1} of ${TOUR.length}`} accessibilityState={{ selected: k === tour }}>
                    <View style={[styles.dot, k === tour && styles.dotOn]} />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={{ flexGrow: 1 }}>
              <Text style={[styles.headline, small && styles.headlineSm]} accessibilityRole="header">India, planned{'\n'}from first idea to last day.</Text>
              <View style={{ marginTop: small ? space.md : space.lg, gap: small ? 8 : 12 }}>
                {PROMISES.map(([icon, text]) => (
                  <View key={text} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <Icon name={icon} size={20} color={colors.accent} />
                    <Text style={[styles.promise, small && styles.promiseSm]}>{text}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={{ gap: 10, marginTop: space.lg }}>
            {step ? (
              <>
                <Button title={last ? 'Create an account' : 'Next'} icon={last ? 'person-add' : 'arrow-forward'}
                  onPress={() => (last ? router.push('/register') : setTour((tour ?? 0) + 1))} />
                <Button title="I already have an account" variant="secondary" onPress={() => router.push('/login')} />
                <Pressable onPress={() => setTour(null)} accessibilityRole="button" style={styles.textLink}><Text style={styles.textLinkLabel}>Back</Text></Pressable>
              </>
            ) : (
              <>
                <Button title="Get started" icon="arrow-forward" onPress={() => setTour(0)} />
                <Button title="Create an account" icon="person-add" variant="secondary" onPress={() => router.push('/register')} />
                <Pressable onPress={() => router.push('/login')} accessibilityRole="button" style={styles.textLink}>
                  <Text style={styles.textLinkLabel}>I already have an account</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sun: { position: 'absolute', width: 190, height: 190, left: '50%', marginLeft: -95, bottom: '27%' },
  heroText: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: space.xl },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { width: 30, height: 30, borderRadius: 9, backgroundColor: DAWN.marigold, alignItems: 'center', justifyContent: 'center' },
  brandName: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
  panel: { flex: 1, marginTop: -28, overflow: 'hidden', backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: space.xl },
  headline: { color: colors.text, fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.6 },
  headlineSm: { fontSize: 23, lineHeight: 28 },
  promiseSm: { fontSize: 14, lineHeight: 19 },
  lede: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: space.sm },
  promise: { color: colors.text, fontSize: 15, lineHeight: 21, flex: 1 },
  stepIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  dots: { flexDirection: 'row', gap: 8, marginTop: space.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.faint },
  dotOn: { width: 26, backgroundColor: colors.primary },
  textLink: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  textLinkLabel: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});
