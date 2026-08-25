import type { ReactNode } from 'react'

export interface PageLoadStateProps {
  readonly loading: boolean
  readonly error: string | null
  readonly empty?: boolean
  readonly emptyMessage?: string
  readonly children: ReactNode
}

export function PageLoadState({
  loading,
  error,
  empty = false,
  emptyMessage = 'Sin datos.',
  children,
}: PageLoadStateProps) {
  if (error) {
    return (
      <p className="welcome-onboarding__error" role="alert">
        {error}
      </p>
    )
  }

  if (loading) {
    return <p className="app-shell__muted">Cargando…</p>
  }

  if (empty) {
    return <p className="app-shell__muted">{emptyMessage}</p>
  }

  return <>{children}</>
}
