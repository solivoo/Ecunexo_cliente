import type { ReactNode } from 'react'
import { InfoHint } from './InfoHint'

export interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  /** Información contextual mostrada en un botón "i" junto al título */
  info?: ReactNode
  badge?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  subtitle,
  info,
  badge,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`ecu-page-header ${className}`.trim()}>
      <div className="ecu-page-header__main">
        <div className="ecu-page-header__title-row">
          <h3 className="ecu-page-header__title">{title}</h3>
          {info ? <InfoHint content={info} /> : null}
          {badge}
        </div>
        {subtitle && <div className="ecu-page-header__subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="ecu-page-header__actions">{actions}</div>}
    </header>
  )
}
