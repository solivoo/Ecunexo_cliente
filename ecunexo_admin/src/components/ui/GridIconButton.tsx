import type { ButtonHTMLAttributes, MouseEvent } from 'react'
import { Button } from 'glubox'
import type { LucideIcon } from 'lucide-react'

export type GridIconButtonProps = {
  readonly label: string
  readonly icon: LucideIcon
  readonly onClick: (event: MouseEvent<HTMLButtonElement>) => void
  readonly disabled?: boolean
  readonly loading?: boolean
  readonly danger?: boolean
  readonly active?: boolean
  readonly className?: string
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'title'>

export function GridIconButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  loading,
  danger = false,
  active = false,
  title,
  className,
}: GridIconButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? 'primary' : 'ghost'}
      size="sm"
      loading={loading}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={title ?? label}
      className={className}
      onClick={onClick}
    >
      <Icon
        size={16}
        strokeWidth={1.75}
        aria-hidden
        color={danger ? 'var(--glb-danger, #ef4444)' : undefined}
      />
    </Button>
  )
}
