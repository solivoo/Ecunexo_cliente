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
            <span>Novedades v{APP_VERSION_INFO.version} — Galería e-commerce de productos y carga en bloque</span>
          </div>
          <ul className="ecu-about-modal__changelog-list">
            <li><strong>Galería e-commerce de productos y SEO:</strong> Zona moderna de carga Drag & Drop multi-archivo con compresión WebP automática en 3 variantes responsive (Thumb 200px, Medium 800px, Large 1600px); controles de reordenamiento para el carrusel de la tienda online; badge de portada principal; y editor de texto alternativo (Alt Text) para posicionamiento en Google Shopping.</li>
            <li><strong>Navegación secuencial y ergonomía en taller:</strong> Recorrido ágil entre equipos del lote con controles «Anterior / Siguiente» y atajos de teclado (Alt + ◄ / ►); botón de avance rápido a la siguiente fase operativa con 1 clic (Diagnóstico, Reparación, QC); selector segmentado Glubox para fotos; zona Drag & Drop con soporte de cámara móvil; y controles de rotación 90° y copiado de enlace en Lightbox.</li>
            <li><strong>Ficha individual de equipo y galería multimedia:</strong> Vista dedicada para cada equipo del lote con ficha técnica, notas operativas (diagnóstico, reparación y QC), trazabilidad de auditoría en línea de tiempo, galería fotográfica WebP en Cloud S3/B2 y lightbox ampliado; el DataGrid del lote queda optimizado con filas compactas y enlaces directos.</li>
            <li><strong>Diagnóstico de credenciales de almacenamiento:</strong> Validación preventiva de claves Backblaze B2 / S3 y control seguro de excepciones para carga de fotografías de taller e imágenes de catálogo.</li>
            <li><strong>Optimización de compilación Docker:</strong> Resolución del target MSBuild de SixLabors para builds en modo Release de la API e inclusión de Directory.Build.targets en contenedor.</li>
            <li><strong>Validación de precio en actas de reparación:</strong> Bloqueo estricto para salidas de equipos reparados sin tarifa acordada; incluye alerta visual, badges «Sin tarifa» en DataGrid y resolución automática contra el tarifario maestro del cliente.</li>
            <li><strong>Galería multimedia de catálogo:</strong> Carga múltiple de imágenes con almacenamiento en AWS S3 / LocalStack, optimización automática WebP y miniaturas.</li>
            <li><strong>Gestión de imágenes de producto:</strong> Reordenamiento secuencial interactivo, selección de imagen principal con badge distintivo y edición de texto alternativo.</li>
            <li><strong>Fotografías de recepción Whirlpool:</strong> Registro fotográfico y visualización de equipos recepcionados en el portal de servicio técnico.</li>
            <li><strong>Tarifario fuera de la ficha:</strong> En Clientes, el icono de tarifas abre un modal solo para N1/N2/N3; la ficha queda para datos comerciales.</li>
            <li><strong>Tarifario solo en Clientes:</strong> El asistente de importar lote ya no edita N1/N2/N3; usa el maestro del cliente y guarda snapshot en el lote.</li>
            <li><strong>Tarifario por cliente:</strong> Maestro N1/N2/N3 en el directorio; al importar el lote se precarga y se guarda snapshot. Factura usa servicios de catálogo REP-N1/N2/N3.</li>
            <li><strong>Directorio de clientes más limpio:</strong> El grid muestra texto y badges sin iconos decorativos ni etiqueta SRI bajo la identificación.</li>
            <li><strong>Vista de despacho parcial:</strong> Genera actas desde una pantalla completa con DataGrid multi-select; el lote puede salir en varias salidas.</li>
            <li><strong>Detalle de acta + facturar:</strong> QR, series y borrador de factura SRI agrupado por tarifas N1/N2/N3, vinculado al acta.</li>
            <li><strong>Modales enterprise del taller:</strong> Acta de despacho, QR, evidencia fotográfica y formularios rápidos usan paneles M3, gap consistente y EmptyState compacto.</li>
            <li><strong>Importar lote a ancho completo:</strong> El asistente de ingreso usa el layout fluido para aprovechar el viewport y visualizar mejor la previsualización Excel.</li>
            <li><strong>Modales de taller con ritmo vertical:</strong> Fase técnica y evidencia fotográfica usan el mismo stack de formularios con gap consistente para labels outlined.</li>
            <li><strong>Rastreo por serie rediseñado:</strong> Resultados del portal corporativo en tarjetas enterprise con jerarquía clara, diagnóstico destacado y acción primaria «Ver lote».</li>
            <li><strong>Tipos de cliente editables:</strong> Crea, edita y desactiva clasificaciones personalizadas en Clientes → Tipos; el directorio usa esos tipos al registrar o editar fichas.</li>
            <li><strong>Permiso customers.manage:</strong> Alta, edición y estado de clientes (y tipos) quedan acotados a este permiso; la lectura del directorio sigue con customers.read.</li>
            <li><strong>Clientes unificados:</strong> El directorio vive bajo Clientes; Reparaciones y Facturación seleccionan los mismos clientes habilitados al crear lotes o emitir facturas.</li>
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
