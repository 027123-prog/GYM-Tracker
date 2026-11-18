const THEME_KEY = 'hardgainwaf-theme';

export function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'calendar' ? 'calendar' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  if (import.meta.env.MODE === 'android') window.HardGainAndroid?.setLightTheme(theme === 'calendar');
}

export function saveTheme(theme) {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // The current session can still switch themes without browser storage.
  }
}
