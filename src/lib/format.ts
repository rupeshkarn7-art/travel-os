export const inr = (n: number | null | undefined) =>
  n == null ? '—' : '₹' + Math.round(Number(n)).toLocaleString('en-IN');

export const inrRange = (a: number | null, b: number | null) =>
  a == null && b == null ? '—' : `${inrShort(a)} – ${inrShort(b)}`;

export const inrShort = (n: number | null | undefined) => {
  if (n == null) return '—';
  const v = Number(n);
  if (v >= 100000) return '₹' + (v / 100000).toFixed(v % 100000 === 0 ? 0 : 1) + 'L';
  if (v >= 1000) return '₹' + (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'K';
  return '₹' + v;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Parse YYYY-MM-DD as a local date (avoids UTC off-by-one). */
export const parseDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayISO = () => toISO(new Date());
export const addDays = (s: string, n: number) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const daysBetween = (a: string, b: string) =>
  Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);

export const fmtDate = (s: string | null | undefined) => {
  if (!s) return '—';
  const d = parseDate(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
export const fmtDateLong = (s: string | null | undefined) => {
  if (!s) return '—';
  const d = parseDate(s);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
export const fmtRange = (a: string, b: string) => `${fmtDate(a)} – ${fmtDate(b)}`;
export const fmtTime = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s);

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export const isHttpUrl = (s: string | null | undefined) => {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
};

export const errMsg = (e: unknown) => {
  const m = (e as any)?.message ?? String(e);
  if (/Failed to fetch|Network request failed|network/i.test(m)) return 'No internet connection. Please check and try again.';
  return m;
};
