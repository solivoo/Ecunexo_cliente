import { useCallback, useState } from 'react'
import { Button, useToast } from 'glubox'
import { Check, Copy, ExternalLink, GitBranch, GitCommit, Server } from 'lucide-react'
import { SectionCard } from '@/components/ui'
import { APP_VERSION_INFO, formatBuildDate, buildSupportDiagnostics } from '@/config/appVersion'
import { selectTenantId, selectUserEmail, selectUserId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'

export function AppSettingsSystemSection() {
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)
  const userId = useAppSelector(selectUserId)
  const userEmail = useAppSelector(selectUserEmail)
  const [copied, setCopied] = useState(false)

  const handleCopyDiagnostics = useCallback(async () => {
    const text = buildSupportDiagnostics({ tenantId, userId, userEmail })
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.show({
        title: 'Copiado al portapapeles',
        message: 'Información de diagnóstico copiada.',
        variant: 'success',
      })
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.show({
        title: 'Error',
        message: 'No se pudo copiar la información.',
        variant: 'error',
      })
    }
  }, [tenantId, toast, userEmail, userId])

  return (
    <SectionCard
      title="Sistema y Versión"
      subtitle="Trazabilidad técnica y estado de la versión en ejecución sincronizada con el repositorio."
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleCopyDiagnostics()}
        >
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          <span>{copied ? '¡Copiado!' : 'Copiar diagnóstico'}</span>
        </Button>
      }
    >
      <div className="ecu-system-specs-grid">
        <article className="ecu-system-spec-card">
          <span className="ecu-system-spec-card__label">Versión</span>
          <span className="ecu-system-spec-card__value">
            <span className="ecu-about-modal__badge">v{APP_VERSION_INFO.version}</span>
          </span>
        </article>

        <article className="ecu-system-spec-card">
          <span className="ecu-system-spec-card__label">Commit Git</span>
          <a
            href={APP_VERSION_INFO.commitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ecu-system-spec-card__link"
            title="Ver commit en GitHub"
          >
            <GitCommit size={14} aria-hidden />
            <span>{APP_VERSION_INFO.gitCommit}</span>
            <ExternalLink size={12} aria-hidden />
          </a>
        </article>

        <article className="ecu-system-spec-card">
          <span className="ecu-system-spec-card__label">Rama</span>
          <span className="ecu-system-spec-card__value">
            <GitBranch size={14} aria-hidden />
            <span>{APP_VERSION_INFO.gitBranch}</span>
          </span>
        </article>

        <article className="ecu-system-spec-card">
          <span className="ecu-system-spec-card__label">Entorno</span>
          <span className="ecu-system-spec-card__value">
            <Server size={14} aria-hidden />
            <span>{APP_VERSION_INFO.isProduction ? 'Producción' : 'Desarrollo'}</span>
          </span>
        </article>

        <article className="ecu-system-spec-card ecu-system-spec-card--span-2">
          <span className="ecu-system-spec-card__label">Fecha de Compilación</span>
          <span className="ecu-system-spec-card__value" title={APP_VERSION_INFO.buildTime}>
            {formatBuildDate(APP_VERSION_INFO.buildTime)}
          </span>
        </article>
      </div>
    </SectionCard>
  )
}
