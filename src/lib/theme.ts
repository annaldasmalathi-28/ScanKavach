/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Theme = 'dark' | 'light';

const THEME_KEY = 'scankavach_theme';

export function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // Default
  }
  return 'dark'; // Dark theme default for medical imaging contrast
}

export function applyTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  } catch {
    // Ignore
  }
}
