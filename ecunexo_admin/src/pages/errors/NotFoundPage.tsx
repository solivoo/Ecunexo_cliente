import { useNavigate } from 'react-router-dom'
import { Button } from 'glubox'
import { ArrowLeft, Home } from 'lucide-react'
import { EmptyState, PageHeader, SectionCard, StatusBadge } from '@/components/ui'

export type NotFoundPageProps = {
  /** Dentro del shell autenticado (sidebar visible). */
  readonly embedded?: boolean
}

export function NotFoundPage({ embedded = false }: NotFoundPageProps) {
  const navigate = useNavigate()

  const content = (
    <SectionCard title="Ruta no registrada">
      <EmptyState
        icon="travel_explore"
        title="No encontramos esta página"
        description="La dirección no existe, cambió de nombre o ya no está disponible. Revisa el enlace o vuelve al inicio."
        action={
          <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button type="button" variant="primary" onClick={() => navigate('/inicio')}>
              <Home size={16} />
              Ir al inicio
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft size={16} />
              Volver atrás
            </Button>
          </div>
        }
      />
    </SectionCard>
  )

  if (embedded) {
    return (
      <div className="ecu-dashboard-layout ecu-section-page ecu-section-page">
        <PageHeader
          title="Página no encontrada"
          subtitle="Error 404"
          badge={<StatusBadge tone="neutral">404</StatusBadge>}
        />
        {content}
      </div>
    )
  }

  return (
    <div
      className="ecu-dashboard-layout ecu-section-page ecu-section-page"
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
    >
      <PageHeader
        title="Página no encontrada"
        subtitle="Error 404 · EcuNexo"
        badge={<StatusBadge tone="neutral">404</StatusBadge>}
      />
      {content}
    </div>
  )
}
