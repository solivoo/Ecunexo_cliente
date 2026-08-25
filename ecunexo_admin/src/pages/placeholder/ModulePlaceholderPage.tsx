import { useMatches } from 'react-router-dom'

export function ModulePlaceholderPage() {
  const matches = useMatches()
  const last = matches[matches.length - 1]
  const title =
    last && typeof last.handle === 'object' && last.handle !== null && 'title' in last.handle
      ? String((last.handle as { title: string }).title)
      : 'Próximamente'

  return (
    <>
      <h1 className="app-shell__page-title">{title}</h1>
      <p className="app-shell__page-lead">
        Módulo en hoja de ruta. La pantalla definitiva se conectará cuando exista la API.
      </p>
      <div className="app-shell__card">
        <p className="app-shell__muted">
          Cuando exista API de {title.toLowerCase()}, esta ruta mostrará la UI real.
        </p>
      </div>
    </>
  )
}
