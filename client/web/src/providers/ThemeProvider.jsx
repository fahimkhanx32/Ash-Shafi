import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import i18n from '../lib/i18n.js';
import { toI18nCode } from '../lib/languageCode.js';

import { useAuth } from './AuthProvider.jsx';
import * as preferencesService from '../services/preferencesService.js';
import { DEFAULT_PREFERENCES } from '../constants/theme.js';
import {
  readStoredPreferences,
  storePreferences,
  applyPreferencesToDocument,
} from '../lib/applyTheme.js';

const ThemeContext = createContext(null);

const SAVE_DEBOUNCE_MS = 600;

/**
 * FET-03 — theme, accessibility & wallpaper preferences.
 *
 * Three layers, in priority order: (1) React state, applied to the
 * DOM synchronously on every change so the UI never waits on a
 * network round trip; (2) localStorage, updated on every change, so
 * a reload or a logged-out visitor keeps their choice and the
 * `index.html` bootstrap script can apply it before React even
 * mounts; (3) the backend (`PATCH /auth/me/preferences`), debounced
 * and only attempted when authenticated, so the preference follows
 * the person to another device. On login, the backend's stored value
 * (in `user.uiPreferences`) is treated as authoritative and
 * overwrites whatever was cached locally for that device.
 */
export function ThemeProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [preferences, setPreferences] = useState(readStoredPreferences);
  const saveTimeoutRef = useRef(null);
  const hasSyncedFromServerRef = useRef(false);
  // Only the keys changed since the last flush are sent. Sending the
  // whole local object (as this used to) let a stale cached value —
  // e.g. an assistant name changed by voice on the server — be
  // written back over the server's newer one by an unrelated change
  // like toggling dark mode. The server merges top-level keys.
  const pendingRef = useRef({});

  // Apply to the DOM on every change, plus once on mount (covers the
  // case where the bootstrap script's OS media-query read is now
  // stale by the time React mounted, e.g. SYSTEM mode).
  useEffect(() => {
    applyPreferencesToDocument(preferences);
    storePreferences(preferences);
    const targetLng = toI18nCode(preferences.language);
    if (i18n.language !== targetLng) i18n.changeLanguage(targetLng);
  }, [preferences]);

  // Once, per login: the server's stored preferences (if the user has
  // ever saved any) take over from whatever was cached on this device.
  useEffect(() => {
    if (!isAuthenticated || !user?.uiPreferences || hasSyncedFromServerRef.current) return;
    hasSyncedFromServerRef.current = true;
    setPreferences((prev) => ({ ...prev, ...user.uiPreferences }));
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated) hasSyncedFromServerRef.current = false;
  }, [isAuthenticated]);

  // Keep SYSTEM mode responsive to a live OS theme change, not just a reload.
  useEffect(() => {
    if (preferences.mode !== 'SYSTEM') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyPreferencesToDocument(preferences);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [preferences]);

  const persistToServer = useCallback(
    (next) => {
      if (!isAuthenticated) return;
      pendingRef.current = { ...pendingRef.current, ...next };
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        const payload = pendingRef.current;
        pendingRef.current = {};
        preferencesService.updateMyPreferences(payload).catch(() => {
          // Best-effort sync — the change already applied locally and
          // persisted to localStorage; a failed server save just means
          // it won't follow the user to another device yet.
        });
      }, SAVE_DEBOUNCE_MS);
    },
    [isAuthenticated],
  );

  const updatePreferences = useCallback(
    (partial) => {
      persistToServer(partial);
      setPreferences((prev) => ({ ...prev, ...partial }));
    },
    [persistToServer],
  );

  const resetPreferences = useCallback(() => {
    setPreferences((prev) => ({ ...DEFAULT_PREFERENCES, voiceAssistant: prev.voiceAssistant }));
    persistToServer(DEFAULT_PREFERENCES);
  }, [persistToServer]);

  const value = useMemo(
    () => ({ preferences, updatePreferences, resetPreferences }),
    [preferences, updatePreferences, resetPreferences],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
