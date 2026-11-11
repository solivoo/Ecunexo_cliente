import type { ReactElement, ReactNode } from 'react'
import { isValidElement } from 'react'
import { PageActionsMenu, type PageActionItem } from 'glubox'
import './ecuPageActions.css'

export type EcuPageActionsProps = {
  readonly items: readonly PageActionItem[]
  readonly triggerLabel: string
  readonly variant?: 'outline' | 'ghost' | 'primary'
  readonly renderIcon?: (name: string, className?: string) => ReactNode
  readonly onNavigate?: (route: string) => void
  readonly onActionSelect?: (item: PageActionItem) => void
}

export function EcuPageActions(props: EcuPageActionsProps) {
  const { items, triggerLabel, variant = 'outline', renderIcon } = props

  const menuRenderIcon = renderIcon
    ? (name: string, className: string): ReactElement | null => {
        const node = renderIcon(name, className)
        return isValidElement(node) ? node : null
      }
    : undefined

  return (
    <div className="ecu-page-actions">
      <PageActionsMenu
        items={[...items]}
        variant={variant}
        triggerLabel={triggerLabel}
        renderIcon={menuRenderIcon}
        onNavigate={props.onNavigate}
        onActionSelect={props.onActionSelect}
      />
    </div>
  )
}
