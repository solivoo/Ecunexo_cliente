import type { ReactNode } from 'react'
import { Button, PageActionsMenu, type PageActionItem } from 'glubox'
import './ecuPageActions.css'

export type EcuPageActionsProps = {
  readonly items: readonly PageActionItem[]
  readonly triggerLabel: string
  readonly variant?: 'outline' | 'ghost' | 'primary'
  readonly renderIcon?: (name: string, className?: string) => ReactNode
  readonly onNavigate?: (route: string) => void
  readonly onActionSelect?: (item: PageActionItem) => void
}

function activate(item: PageActionItem, props: EcuPageActionsProps): void {
  if (item.disabled) return
  props.onActionSelect?.(item)
  if (item.route) props.onNavigate?.(item.route)
}

export function EcuPageActions(props: EcuPageActionsProps) {
  const { items, triggerLabel, variant = 'outline', renderIcon } = props

  return (
    <div className="ecu-page-actions">
      <div className="ecu-page-actions__desktop" role="toolbar" aria-label={triggerLabel}>
        {items.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant={variant}
            size="md"
            disabled={item.disabled}
            title={item.disabled ? (item.disabledReason ?? item.label) : item.label}
            onClick={() => activate(item, props)}
          >
            {item.icon && renderIcon ? (
              <span className="ecu-page-actions__icon">{renderIcon(item.icon)}</span>
            ) : null}
            {item.label}
          </Button>
        ))}
      </div>
      <div className="ecu-page-actions__mobile">
        <PageActionsMenu
          items={[...items]}
          variant={variant}
          triggerLabel={triggerLabel}
          renderIcon={renderIcon}
          onNavigate={props.onNavigate}
          onActionSelect={props.onActionSelect}
        />
      </div>
    </div>
  )
}
