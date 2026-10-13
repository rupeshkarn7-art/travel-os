import { Platform, Share } from 'react-native';
import Constants from 'expo-constants';

/** Public web address of the app (used for share links). */
export const APP_WEB_URL = 'https://rupeshkumar7.com' + ((Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl ?? '');

export async function shareLink(path: string, title: string): Promise<'shared' | 'copied' | 'failed'> {
  const url = `${APP_WEB_URL}${path}`;
  try {
    if (Platform.OS === 'web') {
      const nav: any = typeof navigator !== 'undefined' ? navigator : null;
      if (nav?.share) { await nav.share({ title, url }); return 'shared'; }
      if (nav?.clipboard) { await nav.clipboard.writeText(url); return 'copied'; }
      return 'failed';
    }
    await Share.share({ message: `${title} — ${url}`, url, title });
    return 'shared';
  } catch {
    return 'failed';
  }
}
