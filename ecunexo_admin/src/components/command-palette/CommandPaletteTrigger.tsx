import { useMemo } from 'react'
import './commandPalette.css'

export interface CommandPaletteTriggerProps {
  readonly onClick: () => void
  readonly className?: string
}

export function CommandPaletteTrigger({ onClick, className = '' }: CommandPaletteTriggerProps) {
  const isMac = useMemo(() => {
    if (typeof navigator === 'undefined') return false
    return /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent || '')
  }, [])

  const shortcutLabel = isMac ? '⌘K' : 'Ctrl K'

  return (
    <button
      type="button"
      className={`ecu-cmd-trigger ${className}`.trim()}
      onClick={onClick}
      aria-label={`Buscar páginas, módulos o acciones (${shortcutLabel})`}
      title={`Buscar páginas, módulos o acciones (${shortcutLabel})`}
    >
      <span className="ecu-cmd-trigger__start">
        <span className="material-symbols-outlined ecu-cmd-trigger__icon" aria-hidden>
          search
        </span>
        <span className="ecu-cmd-trigger__text">Buscar páginas o acciones...</span>
      </span>
      <kbd className="ecu-cmd-trigger__kbd" aria-hidden>
        {shortcutLabel}
      </kbd>
    </button>
  )
}
