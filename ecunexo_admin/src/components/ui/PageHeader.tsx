import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  badge?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`ecu-page-header ${className}`.trim()}>
      <div className="ecu-page-header__main">
        <div className="ecu-page-header__title-row">
          <h1 className="ecu-page-header__title">{title}</h1>
          {badge}
        </div>
        {subtitle && <div className="ecu-page-header__subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="ecu-page-header__actions">{actions}</div>}
    </header>
  )
}
