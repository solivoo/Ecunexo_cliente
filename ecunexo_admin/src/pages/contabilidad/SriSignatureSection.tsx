import type { ChangeEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Button, FileBox, Select, TextBox, useToast } from 'glubox'
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  FileKey,
  Lock,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
  UserCheck,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui'
import { readApiError } from '@/lib/readApiError'
import {
  type BillingEmitProfileId,
} from '@/lib/billingEmitProfile'
import {
  getSigningCertificateStatus,
  uploadSigningCertificate,
  type SigningCertificateStatusDto,
} from '@/services/tenantApi'

export type SriSignatureValues = {
  readonly password: string
  readonly expiresAt: string
  readonly fileName: string | null
  readonly emitProfile: BillingEmitProfileId
}

export type SriSignatureSectionProps = {
  readonly values: SriSignatureValues
  readonly disabled?: boolean
  readonly onChange: <K extends keyof SriSignatureValues>(
    key: K,
    value: SriSignatureValues[K]
  ) => void
  readonly embedded?: boolean
  readonly tenantId?: string | null
}

const ENVIRONMENT_OPTIONS = [
  {
    value: 'dev_sri',
    label: 'Ambiente 1 — Pruebas / Certificación (SRI celcer)',
  },
  {
    value: 'production',
    label: 'Ambiente 2 — Producción (SRI cel)',
  },
]


function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return '-'
  try {
    const d = new Date(isoString)
    return d.toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    })
  } catch {
    return isoString
  }
}

export function SriSignatureSection({
  values,
  disabled = false,
  onChange,
  embedded = false,
  tenantId,
}: SriSignatureSectionProps) {
  const toast = useToast()
  const [certFiles, setCertFiles] = useState<File[]>([])
  const [uploadPassword, setUploadPassword] = useState('')
  const [uploading, setUploading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [certStatus, setCertStatus] = useState<SigningCertificateStatusDto | null>(null)
  const [showReplaceForm, setShowReplaceForm] = useState(false)

  const emitChange: SriSignatureSectionProps['onChange'] = (key, value) => {
    if (disabled) return
    onChange(key, value)
  }

  const loadCertStatus = useCallback(async () => {
    if (!tenantId) return
    setLoadingStatus(true)
    try {
      const status = await getSigningCertificateStatus(tenantId)
      setCertStatus(status)
      if (status.isConfigured && status.validTo) {
        emitChange('expiresAt', status.validTo.slice(0, 10))
        if (status.originalFileName) {
          emitChange('fileName', status.originalFileName)
        }
      }
    } catch {
      // Si falla la consulta inicial no bloqueamos la UI
    } finally {
      setLoadingStatus(false)
    }
  }, [tenantId])

  useEffect(() => {
    void loadCertStatus()
  }, [loadCertStatus])

  const onPickFiles = (files: File[]) => {
    if (disabled) return
    if (files.length > 0 && files[0]) {
      setCertFiles([files[0]])
      emitChange('fileName', files[0].name)
      toast.show({
        title: 'Certificado preparado',
        message: `Se cargó "${files[0].name}". Ingresa la contraseña y haz clic en "Cargar y Validar Firma".`,
        variant: 'info',
      })
    } else {
      setCertFiles([])
      emitChange('fileName', null)
    }
  }

  const handleUploadCertificate = async () => {
    if (!tenantId) {
      toast.show({
        title: 'Empresa no identificada',
        message: 'No se pudo identificar la empresa para cargar el certificado.',
        variant: 'error',
      })
      return
    }

    const file = certFiles[0]
    if (!file) {
      toast.show({
        title: 'Archivo requerido',
        message: 'Selecciona un archivo .p12 o .pfx antes de continuar.',
        variant: 'error',
      })
      return
    }

    if (!uploadPassword.trim()) {
      toast.show({
        title: 'Contraseña requerida',
        message: 'Ingresa la contraseña del certificado para validarlo en memoria.',
        variant: 'error',
      })
      return
    }

    setUploading(true)
    try {
      const updatedStatus = await uploadSigningCertificate(tenantId, file, uploadPassword.trim())
      setCertStatus(updatedStatus)
      emitChange('fileName', updatedStatus.originalFileName ?? file.name)
      if (updatedStatus.validTo) {
        emitChange('expiresAt', updatedStatus.validTo.slice(0, 10))
      }
      setCertFiles([])
      setUploadPassword('')
      setShowReplaceForm(false)

      toast.show({
        title: 'Firma electrónica verificada',
        message: `Certificado cargado y cifrado con AES-256-GCM. Titular: ${updatedStatus.subject || 'SRI'}.`,
        variant: 'success',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'Error al validar firma',
        message: readApiError(
          err,
          'No se pudo abrir o validar el certificado. Verifica la contraseña y el archivo.'
        ),
        variant: 'error',
      })
    } finally {
      setUploading(false)
    }
  }

  const body = (
    <div className="sri-config-field-stack" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Estado del Certificado Cifrado en Base de Datos */}
      {loadingStatus ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--glb-muted, #64748b)', padding: '1rem' }}>
          <RefreshCw size={16} className="animate-spin" />
          <span>Consultando estado del certificado digital...</span>
        </div>
      ) : certStatus?.isConfigured ? (
        <div
          style={{
            borderRadius: '0.75rem',
            border: '1px solid var(--shell-border, rgba(255, 255, 255, 0.1))',
            backgroundColor: 'var(--glb-surface, #ffffff)',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: '0.5rem',
                  backgroundColor: certStatus.isExpired
                    ? 'rgba(239, 68, 68, 0.12)'
                    : 'rgba(16, 185, 129, 0.12)',
                  color: certStatus.isExpired ? '#ef4444' : '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {certStatus.isExpired ? <AlertTriangle size={20} /> : <ShieldCheck size={20} />}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--glb-text, inherit)' }}>
                    Certificado Digital Almacenado
                  </h4>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '0.25rem',
                      backgroundColor: 'rgba(99, 102, 241, 0.12)',
                      color: '#6366f1',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <Lock size={10} /> AES-256-GCM
                  </span>
                </div>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--glb-muted, #64748b)' }}>
                  {certStatus.originalFileName || 'certificado_firma.p12'}
                </p>
              </div>
            </div>

            <div>
              {certStatus.isExpired ? (
                <StatusBadge tone="danger" withDot>
                  Certificado Expirado
                </StatusBadge>
              ) : certStatus.daysRemaining <= 30 ? (
                <StatusBadge tone="warning" withDot>
                  Caduca pronto ({certStatus.daysRemaining} días)
                </StatusBadge>
              ) : (
                <StatusBadge tone="success" withDot>
                  Vigente ({certStatus.daysRemaining} días)
                </StatusBadge>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.75rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              backgroundColor: 'rgba(0, 0, 0, 0.02)',
              fontSize: '0.8125rem',
            }}
          >
            <div>
              <div style={{ color: 'var(--glb-muted, #64748b)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <UserCheck size={13} /> Titular / Subject
              </div>
              <div style={{ fontWeight: 600, color: 'var(--glb-text, inherit)', marginTop: '0.15rem', wordBreak: 'break-word' }}>
                {certStatus.subject || 'Sin especificar'}
              </div>
            </div>

            <div>
              <div style={{ color: 'var(--glb-muted, #64748b)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <FileKey size={13} /> RUC / Identificación
              </div>
              <div style={{ fontWeight: 600, color: 'var(--glb-text, inherit)', marginTop: '0.15rem' }}>
                {certStatus.subjectTaxId || 'Extraído del certificado'}
              </div>
            </div>

            <div>
              <div style={{ color: 'var(--glb-muted, #64748b)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={13} /> Vigencia
              </div>
              <div style={{ fontWeight: 600, color: 'var(--glb-text, inherit)', marginTop: '0.15rem' }}>
                {formatDate(certStatus.validFrom)} &rarr; {formatDate(certStatus.validTo)}
              </div>
            </div>

            <div>
              <div style={{ color: 'var(--glb-muted, #64748b)', fontSize: '0.75rem' }}>
                Entidad de Certificación (AC)
              </div>
              <div style={{ fontWeight: 600, color: 'var(--glb-text, inherit)', marginTop: '0.15rem', wordBreak: 'break-word' }}>
                {certStatus.issuer || 'SRI Ecuador'}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => setShowReplaceForm(!showReplaceForm)}
            >
              <RefreshCw size={13} />
              {showReplaceForm ? 'Cancelar reemplazo' : 'Reemplazar certificado .p12'}
            </Button>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            padding: '1rem',
            borderRadius: '0.5rem',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            backgroundColor: 'rgba(239, 68, 68, 0.06)',
            fontSize: '0.85rem',
          }}
        >
          <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: '0.1rem' }} />
          <div>
            <strong style={{ color: 'var(--glb-text, inherit)' }}>Sin firma electrónica configurada:</strong>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--glb-muted, #64748b)' }}>
              Para emitir facturas, notas de crédito, retenciones (07) o liquidaciones de compra (03) autorizadas por el SRI,
              carga tu archivo de firma electrónica (.p12 o .pfx) con su respectiva clave.
            </p>
          </div>
        </div>
      )}

      {/* 2. Formulario para Cargar / Reemplazar Firma Digital */}
      {(!certStatus?.isConfigured || showReplaceForm) && (
        <div
          style={{
            borderRadius: '0.75rem',
            border: '1px solid var(--shell-border, rgba(255, 255, 255, 0.08))',
            padding: '1.25rem',
            backgroundColor: 'var(--glb-surface, rgba(0, 0, 0, 0.02))',
          }}
        >
          <h5 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--glb-text, inherit)' }}>
            {certStatus?.isConfigured ? 'Reemplazar archivo de firma electrónica' : 'Subir archivo de firma electrónica'}
          </h5>

          <div className="ecu-companies-form__grid ecu-companies-form__grid--2">
            <div className="ecu-companies-form__field">
              <FileBox
                id="sri-cert-file-upload"
                label="Archivo digital (.p12 / .pfx / binario)"
                labelPosition="outlined"
                variant="outline"
                size="md"
                displayMode="dropzone"
                accept="*/*"
                multiple={false}
                value={certFiles}
                onChange={onPickFiles}
                onReject={(rejected) => {
                  if (disabled) return
                  const file = rejected[0]?.file
                  if (file) {
                    setCertFiles([file])
                    emitChange('fileName', file.name)
                    toast.show({
                      title: 'Certificado preparado',
                      message: `Se cargó "${file.name}". Ingresa la contraseña y haz clic en "Cargar y Validar Firma".`,
                      variant: 'info',
                    })
                  }
                }}
                placeholder="Arrastra o selecciona el archivo de firma electrónica"
                buttonLabel="Examinar"
                helperText={certFiles[0]?.name ? `Seleccionado: ${certFiles[0].name}` : 'Formato PKCS#12 (.p12, .pfx o binario de Security Data / BCE)'}
                disabled={disabled || uploading}
                fullWidth
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
              <TextBox
                id="sri-cert-password-upload"
                label="Contraseña del certificado"
                labelPosition="outlined"
                variant="outline"
                size="md"
                type="password"
                showPasswordToggle
                value={uploadPassword}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setUploadPassword(e.target.value)}
                autoComplete="new-password"
                disabled={disabled || uploading}
                helperText="Se validará en memoria y se cifrará con AES-256-GCM"
                fullWidth
              />

              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Button
                  variant="primary"
                  size="md"
                  disabled={disabled || uploading || certFiles.length === 0 || !uploadPassword.trim()}
                  onClick={() => void handleUploadCertificate()}
                >
                  {uploading ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      Validando y cifrando firma...
                    </>
                  ) : (
                    <>
                      <UploadCloud size={15} />
                      Cargar y Validar Firma
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Ambiente SRI de Emisión */}
      <div style={{ marginTop: '0.75rem' }}>
        <div style={{ maxWidth: '28rem' }}>
          <Select
            id="sri-environment"
            label="Ambiente SRI de Emisión"
            labelPosition="outlined"
            variant="outline"
            options={ENVIRONMENT_OPTIONS}
            value={values.emitProfile === 'production' ? 'production' : 'dev_sri'}
            onChange={(v) => emitChange('emitProfile', v as BillingEmitProfileId)}
            disabled={disabled}
            fullWidth
          />
        </div>

        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.85rem 1rem',
            borderRadius: '0.5rem',
            border: values.emitProfile === 'production'
              ? '1px solid rgba(16, 185, 129, 0.3)'
              : '1px solid rgba(245, 158, 11, 0.3)',
            backgroundColor: values.emitProfile === 'production'
              ? 'rgba(16, 185, 129, 0.06)'
              : 'rgba(245, 158, 11, 0.06)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>
            {values.emitProfile === 'production' ? '🚀' : '🧪'}
          </span>
          <div style={{ fontSize: '0.82rem', lineHeight: 1.45 }}>
            <strong style={{ color: 'var(--glb-text, inherit)', display: 'block', marginBottom: '0.15rem' }}>
              {values.emitProfile === 'production'
                ? 'Ambiente 2 — Producción SRI (cel.sri.gob.ec)'
                : 'Ambiente 1 — Pruebas / Certificación (celcer.sri.gob.ec)'}
            </strong>
            <span style={{ color: 'var(--glb-muted, #64748b)' }}>
              {values.emitProfile === 'production'
                ? 'Los comprobantes emitidos tienen plena validez fiscal y tributaria ante el SRI. Toda factura, retención o nota de crédito emitida será autorizada formalmente ante el fisco.'
                : 'Los comprobantes se enviarán a los servidores de prueba del SRI. No generan obligaciones tributarias ni validez fiscal. Recomendado para pruebas de integración y capacitación.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )

  if (embedded) return body

  return <section className="app-shell__card ecu-companies-form__card">{body}</section>
}
