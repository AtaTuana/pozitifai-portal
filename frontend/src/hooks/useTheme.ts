import { useCallback, useLayoutEffect, useState } from 'react';

import { transitionTheme } from './themeTransition';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'pozitifai.theme';

/** Persist an explicit preference; storage restrictions must not break the switch. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
  );

  useLayoutEffect(() => {
    transitionTheme(theme);
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // The current tab still works when the browser blocks persistent storage.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme };
}
