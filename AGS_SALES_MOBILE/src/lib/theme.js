import { storage } from './storage';

export const THEME_PRESETS = {
  orange: {
    accent: '#f97316',
    accentLight: '#fb923c',
    accentDim: 'rgba(249, 115, 22, 0.15)'
  },
  purple: {
    accent: '#a855f7',
    accentLight: '#c084fc',
    accentDim: 'rgba(168, 85, 247, 0.15)'
  },
  green: {
    accent: '#22c55e',
    accentLight: '#4ade80',
    accentDim: 'rgba(34, 197, 94, 0.15)'
  },
  cyan: {
    accent: '#06b6d4',
    accentLight: '#22d3ee',
    accentDim: 'rgba(6, 182, 212, 0.15)'
  }
};

export const applyTheme = (themeName) => {
  const preset = THEME_PRESETS[themeName] || THEME_PRESETS.orange;
  const root = document.documentElement;
  root.style.setProperty('--color-accent', preset.accent);
  root.style.setProperty('--color-accent-light', preset.accentLight);
  root.style.setProperty('--color-accent-dim', preset.accentDim);
};

export const loadAndApplyTheme = async () => {
  try {
    const saved = await storage.get('app_theme');
    const theme = saved || 'orange';
    applyTheme(theme);
    return theme;
  } catch (e) {
    applyTheme('orange');
    return 'orange';
  }
};

export const saveTheme = async (themeName) => {
  try {
    await storage.set('app_theme', themeName);
    applyTheme(themeName);
  } catch (e) {
    console.warn("Error saving theme preference:", e);
  }
};
