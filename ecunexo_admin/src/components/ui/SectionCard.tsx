import type { ReactNode } from 'react'

export interface SectionCardProps {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = '',
  bodyClassName = '',
}: SectionCardProps) {
  const hasHeader = Boolean(title || subtitle || action)

  return (
    <section className={`ecu-section-card ${className}`.trim()}>
      {hasHeader && (
        <div className="ecu-section-card__header">
          <div className="ecu-section-card__title-wrap">
            {title && <h2 className="ecu-section-card__title">{title}</h2>}
            {subtitle && <p className="ecu-section-card__subtitle">{subtitle}</p>}
          </div>
          {action && <div className="ecu-section-card__action">{action}</div>}
        </div>
      )}
      <div className={`ecu-section-card__body ${bodyClassName}`.trim()}>{children}</div>
    </section>
  )
}
