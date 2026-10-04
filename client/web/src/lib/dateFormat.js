/**
 * FET-09 — shared date/time formatting for appointments, schedules,
 * blocked dates and the queue board. One place to change if the
 * display format ever needs to change, instead of each component
 * calling `toLocaleDateString` with slightly different options.
 *
 * House format: "16th Aug 2026; Sunday" (ordinal day — short month
 * name — year — weekday name), per explicit client instruction. Not
 * `toLocaleDateString` output, since no built-in Intl option
 * produces an ordinal suffix or this exact separator layout.
 *
 * FET-17 — Multilingual UI & Localization ("Localized dates"): the
 * house layout (ordinal day, month, year, weekday, in that order and
 * punctuation) is preserved for every language — the client's
 * instruction was about the *structure*, not English specifically —
 * but the month/weekday *names* and the ordinal suffix now come from
 * `i18n.language` via `MONTHS_BY_LANG`/`WEEKDAYS_BY_LANG` below
 * rather than being hardcoded English. This file has no React hook
 * access (it's called from plain lib code and inside render, not
 * just components), so it reads the shared `i18n` singleton directly
 * — the same pattern this project already uses for locale (see
 * `ThemeProvider.jsx`) rather than requiring every call site to pass
 * a language down.
 */
import i18n from './i18n.js';

const MONTHS_BY_LANG = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  bn: ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'],
};

const WEEKDAYS_BY_LANG = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  bn: ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'],
};

/**
 * FET-17 — the appointment calendar's month header ("August 2026")
 * needs full month names, not the 3-letter `MONTHS_BY_LANG` form used
 * by the house date format above. Kept as a separate table rather
 * than deriving one from the other, since English and Bangla
 * have distinct long and short forms.
 */
const FULL_MONTHS_BY_LANG = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  bn: ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'],
};

/** FET-17 — short weekday label ("Sun") for the appointment calendar's week-view day headers. */
const SHORT_WEEKDAYS_BY_LANG = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  bn: ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'],
};

const currentLangCode = () => (MONTHS_BY_LANG[i18n.language] ? i18n.language : 'en');

/**
 * English keeps its ordinal suffix ("16th"). Bangla doesn't
 * use an English-style ordinal suffix on dates in ordinary UI
 * copy — there, the plain day number is the correct localized form.
 */
const ordinalDay = (day, lang) => {
  if (lang === 'bn') return String(day);
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
};

/** "16th Aug 2026; Sunday" (localized month/weekday names and day form) */
export const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const lang = currentLangCode();
  const months = MONTHS_BY_LANG[lang];
  const weekdays = WEEKDAYS_BY_LANG[lang];
  const day = ordinalDay(date.getDate(), lang);
  return `${day} ${months[date.getMonth()]} ${date.getFullYear()}; ${weekdays[date.getDay()]}`;
};

/** "9:30 AM" */
export const formatTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const lang = currentLangCode();
  return date.toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' });
};

/** "16th Aug 2026; Sunday, 9:30 AM" */
export const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${formatDate(date)}, ${formatTime(date)}`;
};

/** Weekday label used by the doctor-schedule editor's day rows (current language). */
export const WEEKDAY_LABELS = new Proxy(WEEKDAYS_BY_LANG.en, {
  get(target, prop) {
    return WEEKDAYS_BY_LANG[currentLangCode()][prop] ?? Reflect.get(target, prop);
  },
});

/**
 * FET-12 — "3h ago" / "2 days ago" style relative timestamp, used by
 * the notification bell/list and the conversation/message timelines
 * where an exact date is less useful at a glance than recency.
 * Falls back to `formatDate` past 6 days rather than producing an
 * ever-growing "412 days ago".
 */
export const formatRelativeTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diffSeconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 30) return 'Just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 6) return `${diffDays}d ago`;
  return formatDate(date);
};

/** "August 2026" (localized full month name + year) — appointment calendar's month-view header. */
export const formatMonthYear = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const lang = currentLangCode();
  const months = FULL_MONTHS_BY_LANG[lang];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
};

/** "Sun" (localized short weekday) — appointment calendar's week-view day headers. */
export const formatWeekdayShort = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return SHORT_WEEKDAYS_BY_LANG[currentLangCode()][date.getDay()];
};

/** "2026-08-16" — the `date` query param the backend's availability/queue/blocked-date endpoints expect. */
export const toDateParam = (dateLike) => {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
