import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export interface QuickActionCardProps {
  to: string
  icon: string
  title: string
  description: string
  badge?: ReactNode
  className?: string
}

export function QuickActionCard({
  to,
  icon,
  title,
  description,
  badge,
  className = '',
}: QuickActionCardProps) {
  return (
    <Link to={to} className={`ecu-action-card ${className}`.trim()}>
      <div className="ecu-action-card__icon-box" aria-hidden>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div className="ecu-action-card__content">
        <div className="ecu-action-card__title-row">
          <span className="ecu-action-card__title">{title}</span>
          {badge}
          <span className="material-symbols-outlined ecu-action-card__chevron" aria-hidden>
            arrow_forward
          </span>
        </div>
        <span className="ecu-action-card__desc">{description}</span>
      </div>
    </Link>
  )
}
