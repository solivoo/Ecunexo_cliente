import type { CSSProperties, ReactNode } from 'react'

export interface StatCardProps {
  label: string
  value: ReactNode
  icon?: ReactNode
  toneColor?: string
  badge?: ReactNode
  footerText?: ReactNode
  className?: string
}

export function StatCard({
  label,
  value,
  icon,
  toneColor,
  badge,
  footerText,
  className = '',
}: StatCardProps) {
  const style = toneColor ? ({ '--stat-tone': toneColor } as CSSProperties) : undefined

  return (
    <div className={`ecu-stat-card ${className}`.trim()} style={style}>
      <div className="ecu-stat-card__header">
        <span className="ecu-stat-card__label">{label}</span>
        {icon && (
          <div className="ecu-stat-card__icon-wrap" aria-hidden>
            {typeof icon === 'string' ? (
              <span className="material-symbols-outlined">{icon}</span>
            ) : (
              icon
            )}
          </div>
        )}
      </div>
      <div className="ecu-stat-card__value">{value}</div>
      {(badge || footerText) && (
        <div className="ecu-stat-card__footer">
          {badge}
          {footerText && <span>{footerText}</span>}
        </div>
      )}
    </div>
  )
}
