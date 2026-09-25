import { Button } from 'glubox'
import { RefreshCw } from 'lucide-react'

export type GridToolbarRefreshProps = {
  readonly loading?: boolean
  readonly onRefresh: () => void
  readonly label?: string
}

/** Acción de recarga para el encabezado de un DataGrid o sección. */
export function GridToolbarRefresh({
  loading = false,
  onRefresh,
  label = 'Actualizar',
}: GridToolbarRefreshProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={loading}
      aria-label={label}
      title={label}
      onClick={onRefresh}
    >
      <RefreshCw
        size={15}
        aria-hidden
        className={loading ? 'app-shell__spin' : undefined}
      />
    </Button>
  )
}
