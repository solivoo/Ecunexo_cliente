import type { ButtonHTMLAttributes } from 'react'
import { Button } from 'glubox'
import type { LucideIcon } from 'lucide-react'

export type GridIconButtonProps = {
  readonly label: string
  readonly icon: LucideIcon
  readonly onClick: () => void
  readonly disabled?: boolean
  readonly loading?: boolean
  readonly danger?: boolean
  readonly active?: boolean
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
}: GridIconButtonProps) {
  return (
    <Button
      type="button"
      variant={danger ? 'danger' : active ? 'primary' : 'ghost'}
      size="sm"
      loading={loading}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={title ?? label}
      onClick={onClick}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden />
    </Button>
  )
}
