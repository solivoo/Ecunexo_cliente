import { useCallback, useSyncExternalStore } from 'react'
import { writeAppPreferences } from '@/lib/appPreferences'
import { readCurrentTheme, type EcuThemeMode } from '@/lib/ecuTheme'

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-mode'],
  })
  return () => observer.disconnect()
}

function getSnapshot(): EcuThemeMode {
  return readCurrentTheme()
}

export interface ThemeToggleButtonProps {
  readonly className?: string
  readonly variant?: 'toolbar' | 'icon'
}

export function ThemeToggleButton({ className = '', variant = 'toolbar' }: ThemeToggleButtonProps) {
  const mode = useSyncExternalStore(subscribe, getSnapshot)

  const toggleMode = useCallback(() => {
    const next = mode === 'dark' ? 'light' : 'dark'
    writeAppPreferences({ startDarkMode: next === 'dark' })
  }, [mode])

  const isDark = mode === 'dark'
  const label = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'

  if (variant === 'icon') {
    return (
      <button
        type="button"
        className={`ecu-theme-toggle ecu-theme-toggle--icon ${className}`.trim()}
        onClick={toggleMode}
        aria-label={label}
        title={label}
      >
        <span className="material-symbols-outlined" aria-hidden>
          {isDark ? 'light_mode' : 'dark_mode'}
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`ecu-theme-toggle ${className}`.trim()}
      onClick={toggleMode}
      aria-pressed={isDark}
      title={label}
    >
      <span className="material-symbols-outlined" aria-hidden>
        {isDark ? 'light_mode' : 'dark_mode'}
      </span>
      <span>{isDark ? 'Modo claro' : 'Modo oscuro'}</span>
    </button>
  )
}
