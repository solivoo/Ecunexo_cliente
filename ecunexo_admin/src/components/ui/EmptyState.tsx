import type { ReactNode } from 'react'

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`ecu-empty-state ${className}`.trim()}>
      <div className="ecu-empty-state__icon-box" aria-hidden>
        {typeof icon === 'string' ? (
          <span className="material-symbols-outlined">{icon}</span>
        ) : (
          icon
        )}
      </div>
      <h3 className="ecu-empty-state__title">{title}</h3>
      {description && <div className="ecu-empty-state__desc">{description}</div>}
      {action && <div className="ecu-empty-state__action">{action}</div>}
    </div>
  )
}
