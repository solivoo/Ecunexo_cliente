import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import type { CommandCategory, CommandPaletteItem } from './types'
import './commandPalette.css'

export interface CommandPaletteModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly items: CommandPaletteItem[]
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function renderItemIcon(icon: string | React.ReactNode) {
  if (typeof icon !== 'string') {
    return icon
  }
  const sidebarIcon = renderSidebarIcon(icon, 'ecu-cmd-item__icon')
  if (sidebarIcon) {
    return sidebarIcon
  }
  return (
    <span className="material-symbols-outlined ecu-cmd-item__icon" aria-hidden>
      {icon}
    </span>
  )
}

export function CommandPaletteModal({ open, onClose, items }: CommandPaletteModalProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // Filtrado reactivo en memoria con normalización de acentos y sinónimos
  const filteredItems = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      return items
    }

    const words = normalize(trimmed).split(/\s+/).filter(Boolean)

    return items.filter((item) => {
      const searchTarget = normalize(
        [
          item.title,
          item.subtitle ?? '',
          item.category,
          item.badge ?? '',
          ...(item.keywords ?? []),
        ].join(' ')
      )
      return words.every((w) => searchTarget.includes(w))
    })
  }, [items, query])

  // Reset del índice activo al escribir
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // Auto-focus al abrir
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      const t = setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
      return () => clearTimeout(t)
    }
  }, [open])

  // Desplazar item activo a la vista
  useEffect(() => {
    if (!open || !listRef.current) return
    const activeEl = listRef.current.querySelector<HTMLElement>('[data-active="true"]')
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  // Ejecución del elemento seleccionado
  const executeItem = useCallback(
    (item: CommandPaletteItem) => {
      onClose()
      // Pequeño timeout para permitir que la animación de cierre inicie suavemente
      setTimeout(() => {
        item.onSelect()
      }, 10)
    },
    [onClose]
  )

  // Manejo de teclado (flechas, Enter, Escape)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (filteredItems.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) => (prev + 1) % filteredItems.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const selected = filteredItems[activeIndex]
        if (selected) {
          executeItem(selected)
        }
      }
    },
    [activeIndex, executeItem, filteredItems, onClose]
  )

  // Agrupamiento por categorías manteniendo el orden general
  const groupedItems = useMemo(() => {
    const categoryOrder: CommandCategory[] = [
      'Acciones Rápidas',
      'Navegación',
      'Sistema y Preferencias',
    ]
    const map = new Map<CommandCategory, { item: CommandPaletteItem; flatIndex: number }[]>()

    filteredItems.forEach((item, flatIndex) => {
      const list = map.get(item.category) ?? []
      list.push({ item, flatIndex })
      map.set(item.category, list)
    })

    return categoryOrder
      .filter((cat) => (map.get(cat)?.length ?? 0) > 0)
      .map((cat) => ({
        category: cat,
        entries: map.get(cat) ?? [],
      }))
  }, [filteredItems])

  if (!open) {
    return null
  }

  return (
    <div
      className="ecu-cmd-backdrop"
      onClick={onClose}
      role="presentation"
      onKeyDown={handleKeyDown}
    >
      <div
        className="ecu-cmd-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ecu-cmd-modal__header">
          <span className="material-symbols-outlined ecu-cmd-modal__search-icon" aria-hidden>
            search
          </span>
          <input
            ref={inputRef}
            type="search"
            className="ecu-cmd-modal__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar páginas, acciones o atajos... (ej. Factura, Usuarios, Modo oscuro)"
            aria-label="Buscar en el sistema"
            autoComplete="off"
            spellCheck={false}
          />
          {query.length > 0 && (
            <button
              type="button"
              className="ecu-cmd-modal__clear"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              title="Borrar búsqueda"
              aria-label="Borrar búsqueda"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
                close
              </span>
            </button>
          )}
          <span className="ecu-cmd-modal__esc-badge" aria-hidden>
            ESC
          </span>
        </header>

        <div className="ecu-cmd-modal__body" ref={listRef}>
          {filteredItems.length === 0 ? (
            <div className="ecu-cmd-modal__empty">
              <div className="ecu-cmd-modal__empty-icon">
                <span className="material-symbols-outlined" aria-hidden>
                  search_off
                </span>
              </div>
              <p className="ecu-cmd-modal__empty-title">
                Sin resultados para &ldquo;{query}&rdquo;
              </p>
              <p className="ecu-cmd-modal__empty-desc">
                Intenta con otros términos como <em>factura</em>, <em>usuario</em>, <em>bodega</em>,{' '}
                <em>inventario</em>, <em>tema</em> o <em>configuración</em>.
              </p>
            </div>
          ) : (
            groupedItems.map(({ category, entries }) => (
              <div key={category} className="ecu-cmd-group">
                <div className="ecu-cmd-group__title">{category}</div>
                <div className="ecu-cmd-group__items" role="listbox">
                  {entries.map(({ item, flatIndex }) => {
                    const isActive = flatIndex === activeIndex
                    return (
                      <div
                        key={item.id}
                        role="option"
                        aria-selected={isActive}
                        data-active={isActive ? 'true' : 'false'}
                        data-index={flatIndex}
                        className={`ecu-cmd-item${isActive ? ' ecu-cmd-item--active' : ''}`}
                        onClick={() => executeItem(item)}
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                      >
                        <div className="ecu-cmd-item__start">
                          <div className="ecu-cmd-item__icon-wrap">
                            {renderItemIcon(item.icon)}
                          </div>
                          <div className="ecu-cmd-item__content">
                            <span className="ecu-cmd-item__title">{item.title}</span>
                            {item.subtitle && (
                              <span className="ecu-cmd-item__subtitle">{item.subtitle}</span>
                            )}
                          </div>
                        </div>
                        <div className="ecu-cmd-item__end">
                          {item.badge && (
                            <span className="ecu-cmd-item__badge">{item.badge}</span>
                          )}
                          <span className="ecu-cmd-item__enter" aria-hidden>
                            ↵
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <footer className="ecu-cmd-modal__footer">
          <div className="ecu-cmd-modal__shortcuts">
            <span className="ecu-cmd-modal__shortcut">
              <kbd>↑</kbd> <kbd>↓</kbd> navegar
            </span>
            <span className="ecu-cmd-modal__shortcut">
              <kbd>↵</kbd> seleccionar
            </span>
            <span className="ecu-cmd-modal__shortcut">
              <kbd>esc</kbd> cerrar
            </span>
          </div>
          <div className="ecu-cmd-modal__brand">
            <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>
              bolt
            </span>
            <span>EcuNexo Global Command</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
