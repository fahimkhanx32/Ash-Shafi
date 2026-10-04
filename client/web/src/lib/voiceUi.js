/**
 * Safe, allow-listed UI helpers for the ElevenLabs client tools
 * (master prompt §23/§24). Nothing here evaluates code or accepts a
 * selector from the agent: a field/dialog/section is reachable only
 * if a component deliberately tagged it with `data-voice-field`,
 * `data-voice-dialog` or `data-voice-section`, and the key the agent
 * sends must match a strict pattern before it is ever used in a query.
 */

const KEY_PATTERN = /^[A-Za-z0-9_-]{1,60}$/;
const MAX_TEXT = 4000;

/** Pages the agent may navigate to (route paths from `app/App.jsx`). */
export const VOICE_PAGES = Object.freeze({
  dashboard: '/dashboard',
  patients: '/dashboard/patients',
  prescriptions: '/dashboard/prescriptions',
  appointments: '/dashboard/appointments',
  billing: '/dashboard/billing',
  laboratory: '/dashboard/investigations',
  investigations: '/dashboard/investigations',
  reports: '/dashboard/reports',
  medicines: '/dashboard/medicines',
  settings: '/dashboard/settings',
});

const lookup = (attr, key) => {
  if (typeof key !== 'string' || !KEY_PATTERN.test(key)) return null;
  return document.querySelector(`[${attr}="${key}"]`);
};

export const findVoiceField = (key) => {
  const el = lookup('data-voice-field', key);
  return el && !el.disabled && !el.readOnly ? el : null;
};

/** React-controlled inputs ignore `el.value = x`; use the native setter + a real input event. */
export const setNativeValue = (el, value) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

const clean = (text) => String(text ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, MAX_TEXT);

export const setField = (key, value) => {
  const el = findVoiceField(key);
  if (!el) return `I can't edit "${key}" on this screen.`;
  setNativeValue(el, clean(value));
  return `Set ${key}.`;
};

/** Appends dictation to the end of the field, separated by a space. */
export const insertIntoField = (key, text) => {
  const el = findVoiceField(key);
  if (!el) return `I can't edit "${key}" on this screen.`;
  const addition = clean(text).trim();
  if (!addition) return 'There was nothing to insert.';
  const current = el.value || '';
  setNativeValue(el, current ? `${current.replace(/\s+$/, '')} ${addition}` : addition);
  return `Added to ${key}.`;
};

export const clearField = (key) => {
  const el = findVoiceField(key);
  if (!el) return `I can't edit "${key}" on this screen.`;
  setNativeValue(el, '');
  return `Cleared ${key}.`;
};

export const focusField = (key) => {
  const el = findVoiceField(key);
  if (!el) return `I can't find "${key}" on this screen.`;
  el.focus();
  el.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  return `Focused ${key}.`;
};

export const scrollToSection = (key) => {
  const el = lookup('data-voice-section', key);
  if (!el) return `I can't find the "${key}" section on this screen.`;
  el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  return `Scrolled to ${key}.`;
};

/** Opens a dialog only via a trigger a component tagged `data-voice-dialog`. */
export const openDialog = (key) => {
  const el = lookup('data-voice-dialog', key);
  if (!el || el.disabled) return `I can't open "${key}" from this screen.`;
  el.click();
  return `Opened ${key}.`;
};

/** Closes the topmost open dialog the same way the keyboard does. */
export const closeTopDialog = () => {
  const open = document.querySelector('[role="dialog"]');
  if (!open) return 'There is no dialog open.';
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return 'Closed the dialog.';
};

/** The field the doctor last touched, used as the dictation target when none is named. */
export const activeVoiceFieldKey = () => {
  const el = document.activeElement;
  const key = el?.getAttribute?.('data-voice-field');
  return key && KEY_PATTERN.test(key) ? key : null;
};

export const isValidVoiceKey = (key) => typeof key === 'string' && KEY_PATTERN.test(key);
