export type EcuThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'ecunexo.ui.theme'

/** Lee el modo guardado en localStorage, si no existe devuelve "dark". */
export function readStoredTheme(): EcuThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark') return raw
  } catch { /* ignore */ }
  return 'dark'
}

/** Aplica el modo: clase sf-dark-mode (tokens CSS) + gluBox (data-mode). */
export function applyEcuTheme(mode: EcuThemeMode): void {
  const isDark = mode === 'dark'
  document.documentElement.classList.toggle('sf-dark-mode', isDark)
  document.documentElement.setAttribute('data-mode', mode)
  try { localStorage.setItem(STORAGE_KEY, mode) } catch { /* ignore */ }
}

/** Devuelve el modo actual leyendo el classList de <html>. */
export function readCurrentTheme(): EcuThemeMode {
  return document.documentElement.classList.contains('sf-dark-mode') ? 'dark' : 'light'
}
