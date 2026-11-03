import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export interface InfoHintProps {
  /** Contenido informativo (texto, lista de notas o JSX) */
  content: ReactNode
  /** Título opcional dentro del popover (sin título por defecto para lectura directa) */
  title?: string
  /** Etiqueta accesible para el botón disparador */
  ariaLabel?: string
  className?: string
}

interface PopoverCoords {
  top: number
  left: number
  placement: 'bottom' | 'top'
}

export function InfoHint({
  content,
  title,
  ariaLabel = 'Ver información de ayuda',
  className = '',
}: InfoHintProps) {
  const tooltipId = useId()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const closeTimerRef = useRef<number | null>(null)

  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [coords, setCoords] = useState<PopoverCoords>({ top: 0, left: 0, placement: 'bottom' })

  const isOpen = hovered || pinned

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const scheduleClose = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      setHovered(false)
    }, 140)
  }, [clearCloseTimer])

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const popoverWidth = popoverRef.current?.offsetWidth ?? 310
    const popoverHeight = popoverRef.current?.offsetHeight ?? 110
    const margin = 12
    const gap = 8

    let left = rect.left + rect.width / 2 - popoverWidth / 2
    left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin))

    const spaceBelow = window.innerHeight - rect.bottom
    const placement: 'bottom' | 'top' =
      spaceBelow < popoverHeight + gap + margin && rect.top > spaceBelow ? 'top' : 'bottom'

    const top =
      placement === 'bottom' ? rect.bottom + gap : Math.max(margin, rect.top - popoverHeight - gap)

    setCoords({ top, left, placement })
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) return
    updatePosition()
  }, [isOpen, updatePosition, content])

  useEffect(() => {
    if (!isOpen) return

    const handleScrollOrResize = () => updatePosition()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false)
        setHovered(false)
      }
    }
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (
        target &&
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setPinned(false)
        setHovered(false)
      }
    }

    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isOpen, updatePosition])

  useEffect(() => {
    return () => clearCloseTimer()
  }, [clearCloseTimer])

  return (
    <span className={`ecu-info-hint ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        className={`ecu-info-hint__trigger ${isOpen ? 'ecu-info-hint__trigger--active' : ''}`.trim()}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? tooltipId : undefined}
        onClick={(e) => {
          e.stopPropagation()
          setPinned((prev) => !prev)
        }}
        onMouseEnter={() => {
          clearCloseTimer()
          setHovered(true)
        }}
        onMouseLeave={scheduleClose}
        onFocus={() => {
          clearCloseTimer()
          setHovered(true)
        }}
        onBlur={scheduleClose}
      >
        <span className="ecu-info-hint__i" aria-hidden="true">
          i
        </span>
      </button>

      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popoverRef}
              id={tooltipId}
              role="tooltip"
              className={`ecu-info-hint__popover ecu-info-hint__popover--${coords.placement}`}
              style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
              onMouseEnter={() => {
                clearCloseTimer()
                setHovered(true)
              }}
              onMouseLeave={scheduleClose}
            >
              {title ? (
                <div className="ecu-info-hint__header">
                  <span>{title}</span>
                </div>
              ) : null}
              <div className="ecu-info-hint__body">{content}</div>
            </div>,
            document.body
          )
        : null}
    </span>
  )
}
