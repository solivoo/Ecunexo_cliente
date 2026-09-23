import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom'
import { Button } from 'glubox'
import { ArrowLeft, Home, RefreshCw } from 'lucide-react'
import { EmptyState, PageHeader, SectionCard, StatusBadge } from '@/components/ui'

function resolveErrorMessage(error: unknown): { title: string; detail: string; status?: number } {
  if (isRouteErrorResponse(error)) {
    return {
      title: error.status === 404 ? 'Página no encontrada' : 'Error al cargar la vista',
      detail: error.statusText || error.data?.toString?.() || 'Ocurrió un problema al resolver la ruta.',
      status: error.status,
    }
  }
  if (error instanceof Error) {
    return {
      title: 'Error inesperado',
      detail: error.message || 'Algo falló al renderizar esta pantalla.',
    }
  }
  return {
    title: 'Error inesperado',
    detail: 'Ocurrió un problema desconocido. Intenta recargar la página.',
  }
}

export function RouteErrorPage() {
  const error = useRouteError()
  const navigate = useNavigate()
  const { title, detail, status } = resolveErrorMessage(error)

  const handleReload = () => {
    window.location.reload()
  }

  return (
    <div className="ecu-dashboard-layout">
      <PageHeader
        title={title}
        subtitle={status ? `Código ${status}` : 'Error de aplicación'}
        badge={<StatusBadge tone="danger">Error</StatusBadge>}
      />
      <SectionCard title="Detalle">
        <EmptyState
          icon="error"
          title={title}
          description={
            <>
              <p style={{ margin: '0 0 0.75rem' }}>{detail}</p>
              {import.meta.env.DEV && error instanceof Error && error.stack ? (
                <pre
                  style={{
                    margin: 0,
                    padding: '0.75rem',
                    borderRadius: 8,
                    fontSize: '0.72rem',
                    textAlign: 'left',
                    overflow: 'auto',
                    maxHeight: '12rem',
                    background: 'var(--glb-surface-variant, rgba(0,0,0,0.04))',
                    border: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
                  }}
                >
                  {error.stack}
                </pre>
              ) : null}
            </>
          }
          action={
            <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button type="button" variant="primary" onClick={handleReload}>
                <RefreshCw size={16} />
                Recargar
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/inicio')}>
                <Home size={16} />
                Ir al inicio
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                <ArrowLeft size={16} />
                Volver
              </Button>
            </div>
          }
        />
      </SectionCard>
    </div>
  )
}
