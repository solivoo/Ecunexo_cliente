import type { ReactNode } from 'react'
import { InfoHint } from './InfoHint'

export interface SectionCardProps {
  title?: ReactNode
  subtitle?: ReactNode
  /** Información contextual mostrada en un botón "i" junto al título */
  info?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export function SectionCard({
  title,
  subtitle,
  info,
  action,
  children,
  className = '',
  bodyClassName = '',
}: SectionCardProps) {
  const hasHeader = Boolean(title || subtitle || info || action)

  return (
    <section className={`ecu-section-card ${className}`.trim()}>
      {hasHeader && (
        <div className="ecu-section-card__header">
          <div className="ecu-section-card__title-wrap">
            {title && (
              <div className="ecu-section-card__title-row">
                <h2 className="ecu-section-card__title">{title}</h2>
                {info ? <InfoHint content={info} /> : null}
              </div>
            )}
            {subtitle && <p className="ecu-section-card__subtitle">{subtitle}</p>}
          </div>
          {action && <div className="ecu-section-card__action">{action}</div>}
        </div>
      )}
      <div className={`ecu-section-card__body ${bodyClassName}`.trim()}>{children}</div>
    </section>
  )
}
