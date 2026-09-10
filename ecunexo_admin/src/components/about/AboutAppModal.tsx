import { useCallback, useState } from 'react'
import { Button, Popup, useToast } from 'glubox'
import { Check, Clock, Copy, ExternalLink, GitBranch, GitCommit, Sparkles } from 'lucide-react'
import { APP_VERSION_INFO, formatBuildDate, buildSupportDiagnostics } from '@/config/appVersion'
import { selectTenantId, selectUserEmail, selectUserId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'

export interface AboutAppModalProps {
  readonly open: boolean
  readonly onClose: () => void
}

export function AboutAppModal({ open, onClose }: AboutAppModalProps) {
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
        message: 'Información técnica copiada para soporte.',
        variant: 'success',
      })
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.show({
        title: 'Error',
        message: 'No se pudo copiar al portapapeles.',
        variant: 'error',
      })
    }
  }, [tenantId, toast, userEmail, userId])

  return (
    <Popup
      open={open}
      title="Acerca de EcuNexo"
      onClose={onClose}
      width="min(92vw, 30rem)"
      actions={[
        {
          id: 'close',
          label: 'Entendido',
          variant: 'primary',
          onClick: onClose,
        },
      ]}
    >
      <div className="ecu-about-modal">
        <div className="ecu-about-modal__hero">
          <img
            src="/favicon.svg"
            alt="EcuNexo"
            className="ecu-about-modal__logo"
            width={48}
            height={48}
          />
          <div className="ecu-about-modal__titles">
            <h3 className="ecu-about-modal__title">EcuNexo Admin</h3>
            <p className="ecu-about-modal__subtitle">Plataforma Empresarial & Facturación SRI</p>
          </div>
        </div>

        <div className="ecu-about-modal__grid">
          <div className="ecu-about-modal__item">
            <span className="ecu-about-modal__label">Versión</span>
            <span className="ecu-about-modal__value ecu-about-modal__badge">
              v{APP_VERSION_INFO.version}
            </span>
          </div>

          <div className="ecu-about-modal__item">
            <span className="ecu-about-modal__label">Commit</span>
            <a
              href={APP_VERSION_INFO.commitUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ecu-about-modal__link"
              title="Ver commit en GitHub"
            >
              <GitCommit size={14} aria-hidden />
              <span>{APP_VERSION_INFO.gitCommit}</span>
              <ExternalLink size={12} aria-hidden />
            </a>
          </div>

          <div className="ecu-about-modal__item">
            <span className="ecu-about-modal__label">Rama</span>
            <span className="ecu-about-modal__value">
              <GitBranch size={14} aria-hidden />
              <span>{APP_VERSION_INFO.gitBranch}</span>
            </span>
          </div>

          <div className="ecu-about-modal__item">
            <span className="ecu-about-modal__label">Compilación</span>
            <span className="ecu-about-modal__value" title={APP_VERSION_INFO.buildTime}>
              <Clock size={14} aria-hidden />
              <span>{formatBuildDate(APP_VERSION_INFO.buildTime)}</span>
            </span>
          </div>
        </div>

        <div className="ecu-about-modal__changelog">
          <div className="ecu-about-modal__changelog-header">
            <Sparkles size={15} aria-hidden />
            <span>Novedades v{APP_VERSION_INFO.version} — Clientes Comerciales, Filtros DataGrid & Taller B2B</span>
          </div>
          <ul className="ecu-about-modal__changelog-list">
            <li><strong>Directorio de Clientes estabilizado:</strong> Migración de clasificación comercial (tipo e identificación) y UI alineada al patrón enterprise (PageHeader, KPIs, filtros en SectionCard/DataGrid).</li>
            <li><strong>Módulo Autónomo de Clientes:</strong> Directorio comercial transversal con clasificación comercial (Corporativo B2B, Persona Natural, Distribuidor Mayorista, Taller Aliado, Consumidor Final, Institución Pública) y cuotas por plan.</li>
            <li><strong>Validación SRI & Rangos de Fecha en DataGrid:</strong> Validación algorítmica SRI (Cédula Módulo 10, RUC Módulo 11) e integración de componentes glubox (RangeDateBox, Select) en cabeceras de datos.</li>
            <li><strong>Taller y Lotes B2B:</strong> Gestión integral de lotes de reacondicionamiento masivo con tarifas parametrizadas por severidad de daño (N1, N2, N3).</li>
            <li><strong>Importación Excel Inteligente:</strong> Carga masiva mediante plantillas dinámicas ClosedXML y validación estricta de series duplicadas en muelle.</li>
            <li><strong>Custodia Fotográfica en AWS S3:</strong> Evidencia visual por etapas (Recepción, Proceso, Finalizado) con URLs prefirmadas y arquitectura cero-blob.</li>
            <li><strong>Actas de Despacho Criptográficas con QR:</strong> Generación de albaranes inalterables con hash SHA-256 y verificación pública instantánea desde móviles.</li>
          </ul>
        </div>

        <div className="ecu-about-modal__support">
          <p className="ecu-about-modal__support-hint">
            ¿Reportando un problema técnico? Copia el diagnóstico para adjuntarlo en tu ticket de soporte.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleCopyDiagnostics()}
            className="ecu-about-modal__copy-btn"
          >
            {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
            <span>{copied ? '¡Copiado!' : 'Copiar diagnóstico de soporte'}</span>
          </Button>
        </div>
      </div>
    </Popup>
  )
}
