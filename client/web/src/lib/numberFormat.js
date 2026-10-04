/**
 * FET-17 — Multilingual UI & Localization ("Localized numbers" /
 * "Localized currency"): shared number formatting for English
 * and Bangla. Same architecture as `dateFormat.js` — this
 * file has no React hook access (called from plain lib code and
 * inside render, not just components), so it reads the shared `i18n`
 * singleton directly rather than requiring every call site to pass a
 * language down.
 *
 * Adding a fourth language means adding one entry to
 * `INTL_LOCALE_BY_LANG` below — nothing else in this file, or in any
 * call site, changes.
 */
import i18n from './i18n.js';

const INTL_LOCALE_BY_LANG = {
  en: 'en',
  // Bengali digit shapes ('bn' alone) render Bangla numerals
  // (০-৯), which this project deliberately avoids for financial and
  // clinical figures — a patient ID, invoice total, or dosage count
  // needs to be unambiguous to every member of staff, not just fluent
  // Bangla readers. The Unicode `-u-nu-latn` extension keeps Bangla's
  // own digit-*grouping* convention (South Asian lakh/crore style —
  // e.g. ৳ 12,34,567.00 instead of 1,234,567.00) while forcing
  // Western digit glyphs, matching how Bangladeshi banking/mobile-
  // finance apps display money in practice.
  bn: 'bn-u-nu-latn',
};

const currentLocale = () => INTL_LOCALE_BY_LANG[i18n.language] || INTL_LOCALE_BY_LANG.en;

/**
 * Plain localized number — grouping/decimal separator for the active
 * language, Western digit glyphs always (see note above). Used for
 * counts (patients, appointments, prescriptions…) wherever a raw
 * `.toLocaleString()` call would otherwise silently use the browser's
 * default locale instead of the app's selected language.
 */
export const formatNumber = (value, options) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(currentLocale(), options).format(value);
};

/** "45.6%" — same digit/decimal rules as `formatNumber`. `value` is a fraction (0.456), not 45.6. */
export const formatPercent = (value, fractionDigits = 1) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(currentLocale(), {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
};

/**
 * Localized amount, digits only (no currency code/symbol) — e.g.
 * "1,234,567.50" (en) vs "12,34,567.50" (bn). Deliberately does
 * NOT use `Intl`'s `style: 'currency'`: `currency` is a free-text
 * 3-letter field on the Fee/Invoice models (not locked to BDT), and
 * a symbol-based render can show the wrong glyph — or throw — for a
 * currency code `Intl` doesn't recognize. Pairing this with an
 * explicit currency *code* (see `constants/billing.js#formatMoney`)
 * stays unambiguous regardless of which currency a record holds, and
 * matches the project's existing "CODE amount" display convention.
 */
export const formatCurrencyAmount = (amount, options) => {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat(currentLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
};
