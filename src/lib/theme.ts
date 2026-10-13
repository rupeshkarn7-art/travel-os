// Design tokens from the UI/UX document (Travel Blue system, 8dp grid).
export const colors = {
  primary: '#1769E0',
  primaryDark: '#0B1F3A',
  primaryTint: '#E8F0FD',
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  accent: '#FF8A3D',
  accentTint: '#FFF1E6',
  success: '#16A34A',
  successTint: '#E7F6EC',
  warning: '#F59E0B',
  warningTint: '#FEF3DC',
  error: '#DC2626',
  errorTint: '#FDEBEB',
  info: '#2563EB',
  infoTint: '#E7EFFE',
  text: '#0B1F3A',
  muted: '#64748B',
  faint: '#94A3B8',
  border: '#E2E8F0',
  overlay: 'rgba(11,31,58,0.45)',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, huge: 40 };
export const radius = { button: 12, input: 12, card: 16, large: 20, sheet: 24, chip: 20 };

export const type = {
  display: { fontSize: 32, fontWeight: '700' as const },
  h1: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 24, fontWeight: '700' as const },
  h3: { fontSize: 20, fontWeight: '600' as const },
  title: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  small: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  button: { fontSize: 15, fontWeight: '600' as const },
};

export const shadow = {
  card: { shadowColor: '#0B1F3A', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  sheet: { shadowColor: '#0B1F3A', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 8 },
};

// Category visuals used when a destination has no uploaded photo yet.
export const categoryArt: Record<string, { emoji: string; colors: [string, string] }> = {
  mountains: { emoji: '🏔️', colors: ['#2F80ED', '#0B1F3A'] },
  beaches: { emoji: '🏖️', colors: ['#06B6D4', '#1769E0'] },
  heritage: { emoji: '🏛️', colors: ['#FF8A3D', '#9A3412'] },
  spiritual: { emoji: '🛕', colors: ['#8B5CF6', '#3B1D8F'] },
  adventure: { emoji: '🧗', colors: ['#16A34A', '#064E3B'] },
  wildlife: { emoji: '🐅', colors: ['#65A30D', '#14532D'] },
  family: { emoji: '👨‍👩‍👧', colors: ['#F59E0B', '#B45309'] },
  romantic: { emoji: '💞', colors: ['#EC4899', '#831843'] },
  weekend: { emoji: '🧳', colors: ['#0EA5E9', '#1E3A8A'] },
  budget: { emoji: '💰', colors: ['#14B8A6', '#115E59'] },
  luxury: { emoji: '✨', colors: ['#A78BFA', '#1E1B4B'] },
  default: { emoji: '🧭', colors: ['#1769E0', '#0B1F3A'] },
};

export const placeEmoji: Record<string, string> = {
  spiritual: '🛕', adventure: '🧗', sightseeing: '📍', shopping: '🛍️', beach: '🏖️', heritage: '🏛️',
  nature: '🌿', wildlife: '🐅',
};
