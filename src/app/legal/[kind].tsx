import React from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Header, Screen } from '../../components/ui';
import { colors, space, type } from '../../lib/theme';

const CONTACT = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@example.com';

const DOCS: Record<string, { title: string; sections: [string, string][] }> = {
  privacy: {
    title: 'Privacy policy',
    sections: [
      ['Template notice', 'This is a starting template. Have it reviewed by a qualified professional and replace the contact details before publishing the app.'],
      ['What we collect', 'Account details (name, email, optional phone and photo), your travel preferences, trips, itineraries, budgets, expenses, checklists and saved places, and basic usage events that help us improve the app.'],
      ['How we use it', 'To provide the app, personalise destination suggestions, send trip reminders you enable, and keep the service secure. We do not sell personal data.'],
      ['Where it is stored', 'Data is stored with our backend provider (Supabase) and protected by per-user access rules, so only you can see your trips.'],
      ['AI features', 'When you use the AI planner, your trip details (destination, dates, budget, interests) are sent to an AI provider to generate suggestions. Do not include sensitive personal information in notes.'],
      ['Your choices', 'You can edit your profile, switch notifications off, and delete your account and data any time from Settings & privacy.'],
      ['Contact', `Questions: ${CONTACT}`],
    ],
  },
  terms: {
    title: 'Terms of use',
    sections: [
      ['Template notice', 'This is a starting template. Have it reviewed by a qualified professional before publishing the app.'],
      ['Planning aid only', 'Travel OS provides informational guidance. Permit rules, prices, opening hours and safety conditions change; always confirm with official sources. Information is not a guarantee of safety, availability or eligibility.'],
      ['No bookings', 'The app does not sell or book travel services. Third-party links and map directions are provided for convenience.'],
      ['Content labels', 'Content is labelled Official, Verified, Community or AI-generated. Items marked “needs review” have not been independently verified.'],
      ['Your account', 'You are responsible for keeping your login secure and for the accuracy of what you enter.'],
      ['Acceptable use', 'Do not misuse the service, attempt to access other users’ data, or submit unlawful content.'],
      ['Contact', `Questions: ${CONTACT}`],
    ],
  },
};

export default function Legal() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const d = DOCS[kind as string] ?? DOCS.privacy;
  return (
    <Screen>
      <Header title={d.title} />
      {d.sections.map(([h, b]) => (
        <React.Fragment key={h}>
          <Text style={[type.title, { color: colors.text, marginTop: space.lg }]}>{h}</Text>
          <Text style={[type.body, { color: colors.muted, marginTop: 6 }]}>{b}</Text>
        </React.Fragment>
      ))}
    </Screen>
  );
}
