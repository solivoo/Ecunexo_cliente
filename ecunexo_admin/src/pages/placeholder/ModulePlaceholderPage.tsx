import { useMatches } from 'react-router-dom'
import { EmptyState, PageHeader, SectionCard, StatusBadge } from '@/components/ui'

export function ModulePlaceholderPage() {
  const matches = useMatches()
  const last = matches[matches.length - 1]
  const title =
    last && typeof last.handle === 'object' && last.handle !== null && 'title' in last.handle
      ? String((last.handle as { title: string }).title)
      : 'Próximamente'

  return (
    <div className="ecu-dashboard-layout">
      <PageHeader
        title={title}
        subtitle="Módulo planificado en la hoja de ruta de la plataforma."
        badge={<StatusBadge tone="neutral">En Desarrollo</StatusBadge>}
      />
      <SectionCard
        title={`Módulo: ${title}`}
        subtitle="Integración de funcionalidades y servicios"
      >
        <EmptyState
          icon="layers"
          title={`Funcionalidad de ${title}`}
          description={`Este módulo se encuentra actualmente en la hoja de ruta técnica. La pantalla operativa definitiva se habilitará automáticamente una vez que la API de ${title.toLowerCase()} esté desplegada.`}
        />
      </SectionCard>
    </div>
  )
}
