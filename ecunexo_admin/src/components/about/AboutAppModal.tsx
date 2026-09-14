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
            <span>Novedades v{APP_VERSION_INFO.version} — Herencia de Credenciales Root en Creación de Empresa</span>
          </div>
          <ul className="ecu-about-modal__changelog-list">
            <li><strong>Herencia Automática de Credenciales del Titular Root:</strong> Eliminada la exigencia forzada de crear una contraseña redundante al dar de alta una nueva empresa bajo la suscripción. El usuario titular asigna automáticamente sus credenciales de acceso globales con aviso visual claro y opción voluntaria para contraseñas específicas.</li>
            <li><strong>Matriz de Planes y Precios Sector Transporte:</strong> Documentación oficial de planes comerciales para el sector transporte ecuatoriano (Planes Local $428/año y Empresa $806/año) con auditoría integral de cumplimiento ante el SRI.</li>
            <li><strong>Blindaje de Permisos RBAC y Estado de Firma en Compras:</strong> Retiro de botones redundantes de configuración de firma en vistas operativas de Retenciones y Liquidaciones de Compra para respetar las restricciones de rol administrativo en Ajustes de Empresa, sustitución de términos técnicos crudos (.p12) por conceptos formales de negocio e incorporación de insignias informativas de ambiente SRI (Pruebas / Producción) y vigencia del certificado digital emisor.</li>
            <li><strong>Sincronización Criptográfica de Licenciamiento de Producción:</strong> Actualización de la clave pública RSA en el backend del Cliente (license-public.pem y appsettings.json) sincronizada directamente con la clave privada de producción de license.ecunexo.com, habilitando la verificación y renovación de licencias oficiales sin fallos de firma.</li>
            <li><strong>Unificación de Módulo de Compras:</strong> Normalización de la nomenclatura en catálogos y menús del sistema consolidando «Compras, Gastos & Recepción SRI» bajo la denominación estándar «Compras», manteniendo integrada de forma nativa la recepción de comprobantes electrónicos 01 del SRI y la clasificación de compras y gastos operativos.</li>
            <li><strong>Rediseño Ergonómico de Ampliación de Licencia:</strong> Reestructuración de la interfaz en /organizacion/plan con un flujo guiado en 2 pasos independientes (código de activación con tipografía monoespaciada y selector de archivo criptográfico .ecunexo-license con resumen en chips de módulos y badges de estado), optimizando el aprovechamiento visual del espacio y eliminando elementos asimétricos.</li>
            <li><strong>Plan General de Cuentas Contables NIIF / SCVS Ecuador:</strong> Nuevo módulo de contabilidad con catálogo maestro oficial de 45 cuentas jerárquicas conforme a la Superintendencia de Compañías, Valores y Seguros del Ecuador. Vista jerárquica con identación visual, códigos monoespaciados, control de imputabilidad de movimientos, modal de alta/edición con inferencia automática de tipo y naturaleza contable, y semillero inicial en 1 clic.</li>
            <li><strong>Detección de XML Duplicados y Sinergia de Compras con Bodega:</strong> Bloqueo preventivo y bidireccional contra facturas repetidas en cola e importación masiva por clave de autorización de 49 dígitos o RUC + secuencial. Asignación granular por línea de compra para bienes (stock de almacén) y gastos directos (servicios), ocultamiento condicional del selector de bodega para compras puras de servicios, estado «Pendiente Recepción en Bodega» y columna fija de acciones (sticky) para una visualización fluida.</li>
            <li><strong>Control de Ingreso a Bodega sin Factura & Blindaje Legal/Tributario del Proveedor:</strong> Trazabilidad inmutable de auditoría forense en movimientos de inventario (CreatedBy, ApprovedBy, Time, Warehouse), alerta contextual en interfaz de altas deslindando crédito fiscal ante el SRI, y formalización de la Sección 8 en los Términos y Condiciones contractuales exonerando expresamente al proveedor tecnológico por ingresos sin comprobante de compra según el Código Tributario y el Art. 298 del COIP.</li>
            <li><strong>Catálogo Oficial SRI AIR Tabla 3.10 ATS 2026 y Edición Flexible:</strong> Integración fiel del catálogo reglamentario del SRI desde el 06/Agosto/2026 (Tabla 3.10) para compras y retenciones de Impuesto a la Renta. Corrección de tarifas oficiales (código 332 ajustado a 0% para RIMPE Negocios Populares; código 344 normalizado a 3440 al 3%; adición de 3482 al 5% para comisiones a sociedades, etc.). Selector enriquecido con descripción oficial, tarjeta informativa por concepto, botón de copia rápida a nombre y notas, edición irrestricta de porcentajes de retención y vigencias tanto en conceptos nuevos como del sistema.</li>
            <li><strong>Distinción Operativa entre Bienes y Servicios en Compras:</strong> Manejo autónomo para compras de servicios (fletes, encomiendas Servientrega, couriers, arriendos y honorarios) fijando automáticamente stock en «Sin Stock (Servicio)», inhabilitando bodegas y transitando de inmediato a estado Facturado (Invoiced) sin requerir paso por almacén. Rediseño de /compras/documentos/importar en modo cola y modo auditoría profunda con navegación fluida.</li>
            <li><strong>Despliegue Desacoplado y Clave Pública de Licencias Integrada:</strong> Integración directa de la clave pública RSA en el empaquetado del contenedor API y configuración de appsettings, eliminación del montaje de volumen obligatorio en docker-compose y asignación de valores de contingencia para un despliegue resiliente en Portainer.</li>
            <li><strong>Vista Dedicada de Importación de Compras y Auditoría Preventiva SRI:</strong> Nueva vista de pantalla completa (/compras/documentos/importar) con soporte para carga masiva por lote de múltiples archivos XML o registro de facturas físicas preimpresas (autorización SRI de 10 dígitos). Incorporación del motor de auditoría preventiva (SriPurchaseAuditor) con validación algorítmica de la clave de acceso de 49 dígitos mediante Módulo 11 (ponderaciones 7 a 2), detección de comprobantes emitidos en contingencia o sin autorización oficial por caída del SRI, detección de descuadres aritméticos en bases imponibles vs total, y verificación de tarifas de IVA vigentes (15% vs alertas por 12% desfasado).</li>
            <li><strong>Auditoría Global de Fechas con Glubox DateBox:</strong> Reemplazo sistemático del 100% de los controles nativos de fecha por el componente oficial DateBox de Glubox en compras, proformas, categorías SRI y emisión de comprobantes, garantizando estilos enterprise, soporte dark mode y erradicación del datepicker transparente del navegador.</li>
            <li><strong>Control Estricto de Permisos RBAC en Compras:</strong> Eliminación de bypasses cruzados con facturación de ventas en endpoints backend (facturas, proveedores, categorías y proformas) y evaluación exclusiva de permisos granulares purchases.* en vistas y acciones de usuario.</li>
            <li><strong>Gestión Completa de Categorías de Compra y Conceptos AIR (SRI ATS):</strong> Nuevo modal interactivo de creación y edición de conceptos con selector de códigos AIR estándar (312, 307, 303, 303A, 304, 310, 320, 309, 343) o manuales, autocompletado de tarifas oficiales vigentes desde agosto 2026, vigencias cronológicas (Desde/Hasta), afectación a inventario físico y reglas seguras de borrado/desactivación preventiva.</li>
            <li><strong>Homologación de Recepción en Bodega y Kárdex:</strong> Selector dinámico de ítems de catálogo en recepción física de facturas de compra para vincular productos y recalcular automáticamente el costo promedio ponderado en kárdex.</li>
            <li><strong>Ingesta Robusta de XML de Compra SRI:</strong> Soporte universal para comprobantes envueltos en respuestas oficiales del WebService SRI (&lt;ns2:RespuestaAutorizacion&gt; y &lt;autorizacion&gt;) y auto-creación inmediata del proveedor nuevo en el directorio.</li>
            <li><strong>Identificación Inequívoca de Ambiente de Pruebas SRI:</strong> Detección automática por dígito 24 de clave de acceso con marca de agua y banner prominente en RIDE PDF («AMBIENTE DE PRUEBAS — DOCUMENTO SIN VALIDEZ TRIBUTARIA») y badges en la grilla de comprobantes.</li>
            <li><strong>Corrección de Configuración Legal y Firma Electrónica SRI:</strong> Implementación del endpoint y handler de actualización legal de empresa con soporte para nombre comercial y eliminación del error 403.</li>
            <li><strong>Protección de Claves Criptográficas y Limpieza de Repositorio:</strong> Eliminación de archivos .pem del control de versiones, exclusión estricta en .gitignore y migración de claves de licenciamiento a configuración desacoplada (appsettings local y variables de entorno).</li>
            <li><strong>Unificación de Configuración SRI y Ambiente de Emisión:</strong> Centralización de datos de emisor y firma electrónica en Ajustes de Empresa → Facturación electrónica, eliminación de opciones redundantes en el menú lateral y nuevo selector oficial de ambiente SRI (Pruebas celcer vs Producción cel) con banner descriptivo.</li>
            <li><strong>Vista Dedicada y Modo Híbrido en Proformas de Compra:</strong> Nueva pantalla completa (/compras/proformas/nueva) con soporte para registro documental por enlace externo o PDF (con subtotal y tarifa IVA directa sin forzar ítems) y modo detallado por ítems; control de vigencia con botones de acceso rápido (+7, +15, +30 días).</li>
            <li><strong>Notificación Automática por Correo y Control ABAC:</strong> Reglas de expiración de cotizaciones con bloqueo de aprobación vencida; permiso granular purchases.proformas.approve y emisión automática de correo de adjudicación al proveedor oferente.</li>
            <li><strong>Obligatoriedad de Correo en Proveedores:</strong> Validación estricta con formato RFC para garantizar la entrega de comprobantes y notificaciones formales de compra.</li>
            <li><strong>Soporte Universal para Certificados Digitales Binarios:</strong> Admisión de certificados de firma electrónica sin extensión de archivo obligatoria o formato .bin descargados directamente desde entidades certificadoras (Security Data, BCE) y eliminación de doble borde punteado en el contenedor de carga.</li>
            <li><strong>Actualización Glubox 0.1.23 y Carga de Firma Electrónica:</strong> Actualización del kit de componentes Glubox a v0.1.23 y optimización de la zona de arrastre (drag & drop) para certificados digitales .p12/.pfx en Ajustes de Empresa.</li>
            <li><strong>Aislamiento de Firma Digital (.p12) y Bloqueo de Emisión SRI:</strong> Eliminación de firma compartida por defecto; cada empresa debe registrar su propio certificado .p12 para emitir al SRI. Bloqueo preventivo en interfaz de emisión con acceso a previsualización RIDE sin validez tributaria y ajuste ergonómico de columnas en PDF.</li>
            <li><strong>Marco Legal y Términos de Servicio Ecuador:</strong> Incorporación de cláusulas de consentimiento click-wrap en inicio de sesión y onboarding con respaldo en LOPDP, Ley de Comercio Electrónico y Ficha Técnica SRI v2.32, además de rutas públicas dedicadas (/terminos y /privacidad).</li>
            <li><strong>Corrección de Tema Dark Mode en Modales de Compra:</strong> Normalización de la zona de arrastre (dropzone) y tablas de parseo XML SRI con tokens translúcidos para integración perfecta en modo oscuro.</li>
            <li><strong>Normalización de iconos Material Symbols en Compras:</strong> Corrección de ligaduras tipográficas en StatCards y EmptyStates de Proveedores, Proformas y Tipos de Gasto SRI para garantizar renderizado gráfico nativo en lugar de texto plano.</li>
            <li><strong>Directorio de Proveedores y Validación SRI:</strong> Gestión centralizada de proveedores con validación de RUC de persona natural, sociedades privadas y entidades públicas según el algoritmo oficial Módulo 10/11 del SRI; validación de cédula de identidad; control de condición fiscal (Rimpe Negocio Popular / Emprendedor, Agente de Retención, Contribuyente Especial) y plazos comerciales de crédito.</li>
            <li><strong>Gestión de Proformas y Cotizaciones:</strong> Registro integral de cotizaciones de compra con desglose automático de tarifas de IVA ecuatorianas (0%, 15%, 5%, no objeto, exento); seguimiento de vigencia y aprobación para conversión ágil a facturas de compra.</li>
            <li><strong>Catálogo de Tipos de Gastos SRI / ATS:</strong> Clasificación fiscal de compras y adquisiciones según los códigos de deducción del Anexo Transaccional Simplificado (ATS) y cuentas contables vinculadas.</li>
            <li><strong>Ingesta y Parseo XML de Facturas SRI:</strong> Carga automatizada de comprobantes electrónicos XML bajo esquema offline SRI v2.32; extracción instantánea de clave de acceso de 49 dígitos, emisor, fecha de autorización, desglose impositivo y detalle de ítems facturados.</li>
            <li><strong>Recepción en Bodega y Kárdex Promedio Ponderado:</strong> Ingreso físico de mercadería a almacén destino con verificación ítem por ítem; actualización atómica de existencias físicas y registro cronológico de movimientos en el kárdex contable.</li>
            <li><strong>Miniaturas optimizadas en grid de catálogo:</strong> Normalización estricta de imágenes en el DataGrid de ítems; resolución automática hacia la variante liviana del bucket (_thumb.webp), contenedor de 36×36 px con recorte adaptativo, fallback con icono y prevención de desbordamientos visuales.</li>
            <li><strong>Soporte multientorno para Object Storage:</strong> Configuración centralizada de variables .env / .env.local para Backblaze B2 / S3 y carga preventiva en Program.cs de la API.</li>
            <li><strong>Verificación móvil y estilizado de actas:</strong> Página dedicada responsive para validación QR de actas de despacho con certificación de autenticidad y optimización de albaranes PDF con paleta sobria corporativa.</li>
            <li><strong>Módulo Ecommerce y reserva automática de inventario:</strong> Recepción y procesamiento de pedidos de compra de la tienda en línea; gestión del ciclo de vida (Pendiente, Confirmado, En Preparación, Despachado, Entregado y Cancelado); reserva atómica de stock en bodega para evitar sobreventas; despacho con asignación de transportista/courier y número de guía con liquidación definitiva de kárdex; anulación con liberación inmediata de inventario; y vinculación de factura electrónica SRI.</li>
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
