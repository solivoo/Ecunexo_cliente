import type { ReactNode } from 'react'

export type StatusBadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export interface StatusBadgeProps {
  children: ReactNode
  tone?: StatusBadgeTone
  withDot?: boolean
  className?: string
}

export function StatusBadge({
  children,
  tone = 'neutral',
  withDot = false,
  className = '',
}: StatusBadgeProps) {
  return (
    <span className={`ecu-badge ecu-badge--${tone} ${className}`.trim()}>
      {withDot && <span className="ecu-badge--dot" aria-hidden />}
      {children}
    </span>
  )
}
