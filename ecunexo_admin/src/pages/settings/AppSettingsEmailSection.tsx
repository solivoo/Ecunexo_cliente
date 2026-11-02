import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { Button, CheckButton, Select, TextBox, useToast } from 'glubox'
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Mail,
  RotateCcw,
  Save,
  Send,
} from 'lucide-react'
import { SectionCard, StatusBadge } from '@/components/ui'
import { useGluComponentSize } from '@/hooks/useGluComponentSize'
import { readApiError } from '@/lib/readApiError'
import { useAppSelector } from '@/store/hooks'
import {
  getEmailSettings,
  resetEmailSettings,
  testEmailSettings,
  updateEmailSettings,
  type EmailSettingsDto,
} from '@/services/settingsApi'

const ZOHO_DEFAULT_HOST = 'smtp.zoho.com'
const ZOHO_PRO_HOST = 'smtppro.zoho.com'
const ZOHO_DEFAULT_PORT = 465

type EmailEngineMode = 'system' | 'custom'
type EmailProviderPreset = 'zoho_personal' | 'zoho_domain' | 'gmail' | 'outlook' | 'other'

function detectProviderPreset(host: string): EmailProviderPreset {
  const h = host.trim().toLowerCase()
  if (!h || h === 'smtp.zoho.com' || h === 'smtp.zoho.eu') return 'zoho_personal'
  if (h === 'smtppro.zoho.com' || h === 'smtppro.zoho.eu') return 'zoho_domain'
  if (h === 'smtp.gmail.com') return 'gmail'
  if (h === 'smtp.office365.com' || h === 'smtp-mail.outlook.com') return 'outlook'
  return 'other'
}

const PROVIDER_OPTIONS: { value: EmailProviderPreset; label: string }[] = [
  { value: 'zoho_personal', label: 'Zoho Mail (Predeterminado)' },
  { value: 'zoho_domain', label: 'Zoho Mail con dominio propio' },
  { value: 'gmail', label: 'Gmail / Google Workspace' },
  { value: 'outlook', label: 'Outlook / Microsoft 365' },
  { value: 'other', label: 'Otro servidor de correo' },
]

export function AppSettingsEmailSection({
  disabled = false,
}: {
  readonly disabled?: boolean
}) {
  const toast = useToast()
  const size = useGluComponentSize()
  const activeTenantName = useAppSelector((state) => state.auth.tenant?.name)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [resetting, setResetting] = useState(false)

  const [engineMode, setEngineMode] = useState<EmailEngineMode>('system')
  const [providerPreset, setProviderPreset] = useState<EmailProviderPreset>('zoho_personal')
  const [isCustom, setIsCustom] = useState(false)

  const [isEnabled, setIsEnabled] = useState(true)
  const [host, setHost] = useState(ZOHO_DEFAULT_HOST)
  const [port, setPort] = useState<number>(ZOHO_DEFAULT_PORT)
  const [useSsl, setUseSsl] = useState(true)
  const [encryptionMode, setEncryptionMode] = useState<'Auto' | 'SslTls' | 'StartTls' | 'None'>('SslTls')
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [senderEmail, setSenderEmail] = useState('')
  const [senderName, setSenderName] = useState('')
  const [hasPassword, setHasPassword] = useState(false)

  const [targetEmail, setTargetEmail] = useState('')
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const applyDto = useCallback(
    (data: EmailSettingsDto) => {
      const custom = Boolean(data.isCustom)
      setIsCustom(custom)
      setEngineMode(custom ? 'custom' : 'system')
      setIsEnabled(data.isEnabled)
      const resolvedHost = data.host || ZOHO_DEFAULT_HOST
      setHost(resolvedHost)
      setPort(data.port || ZOHO_DEFAULT_PORT)
      setUseSsl(data.useSsl)
      setEncryptionMode(data.encryptionMode ?? 'SslTls')
      setProviderPreset(detectProviderPreset(resolvedHost))
      setUserName(custom ? data.userName || '' : '')
      setSenderEmail(custom ? data.senderEmail || '' : '')
      setSenderName(custom ? data.senderName || activeTenantName || '' : activeTenantName || '')
      setHasPassword(custom ? data.hasPassword : false)
      setPassword('')
    },
    [activeTenantName],
  )

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const data: EmailSettingsDto = await getEmailSettings()
      applyDto(data)
    } catch (err: unknown) {
      toast.show({
        title: 'Error al cargar ajustes de correo',
        message: readApiError(err, 'No se pudo recuperar la configuración de correo.'),
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [applyDto, toast])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const handleProviderChange = (preset: EmailProviderPreset) => {
    setProviderPreset(preset)
    if (preset === 'zoho_personal') {
      setHost(ZOHO_DEFAULT_HOST)
      setPort(465)
      setUseSsl(true)
      setEncryptionMode('SslTls')
    } else if (preset === 'zoho_domain') {
      setHost(ZOHO_PRO_HOST)
      setPort(465)
      setUseSsl(true)
      setEncryptionMode('SslTls')
    } else if (preset === 'gmail') {
      setHost('smtp.gmail.com')
      setPort(465)
      setUseSsl(true)
      setEncryptionMode('SslTls')
    } else if (preset === 'outlook') {
      setHost('smtp.office365.com')
      setPort(587)
      setUseSsl(true)
      setEncryptionMode('StartTls')
    }
  }

  const handleResetToUniversal = async () => {
    setResetting(true)
    try {
      const data = await resetEmailSettings()
      applyDto(data)
      toast.show({
        title: 'Correo predeterminado activado',
        message: 'Tus correos se enviarán automáticamente con el servicio predeterminado del sistema.',
        variant: 'success',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'Error al cambiar',
        message: readApiError(err, 'No se pudo activar el correo predeterminado.'),
        variant: 'error',
      })
    } finally {
      setResetting(false)
    }
  }

  const handleSaveCustom = async () => {
    const cleanUser = userName.trim()
    if (!cleanUser) {
      toast.show({
        title: 'Correo requerido',
        message: 'Ingresa la dirección de correo desde la que deseas enviar.',
        variant: 'warning',
      })
      return
    }
    if (!hasPassword && !password.trim()) {
      toast.show({
        title: 'Contraseña requerida',
        message: 'Ingresa la contraseña de tu cuenta de correo.',
        variant: 'warning',
      })
      return
    }
    if (!host.trim()) {
      toast.show({
        title: 'Servidor requerido',
        message: 'Indica el servidor de correo en las opciones avanzadas.',
        variant: 'warning',
      })
      return
    }

    setSaving(true)
    try {
      const effectiveSenderEmail = senderEmail.trim() || cleanUser
      const effectiveSenderName = senderName.trim() || activeTenantName || 'EcuNexo'
      const updated = await updateEmailSettings({
        isEnabled,
        host: host.trim(),
        port: Number(port) || ZOHO_DEFAULT_PORT,
        useSsl,
        encryptionMode,
        userName: cleanUser,
        password: password.trim() ? password.trim() : undefined,
        senderEmail: effectiveSenderEmail,
        senderName: effectiveSenderName,
      })

      applyDto(updated)

      toast.show({
        title: 'Correo personal guardado',
        message: 'Tu cuenta de correo quedó configurada para esta empresa.',
        variant: 'success',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'Error al guardar',
        message: readApiError(err, 'No se pudo guardar la configuración de correo.'),
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (!targetEmail.trim()) {
      toast.show({
        title: 'Destinatario requerido',
        message: 'Ingresa un correo electrónico para enviar el mensaje de prueba.',
        variant: 'warning',
      })
      return
    }

    setTesting(true)
    setTestResult(null)
    try {
      const payload =
        engineMode === 'system'
          ? { targetEmail: targetEmail.trim() }
          : {
              targetEmail: targetEmail.trim(),
              host: host.trim(),
              port: Number(port) || ZOHO_DEFAULT_PORT,
              useSsl,
              encryptionMode,
              userName: userName.trim(),
              password: password.trim() ? password.trim() : undefined,
              senderEmail: senderEmail.trim() || userName.trim(),
              senderName: senderName.trim() || activeTenantName || 'EcuNexo',
            }

      const res = await testEmailSettings(payload)

      setTestResult(res)
      toast.show({
        title: res.success ? 'Correo enviado' : 'No se pudo enviar',
        message: res.message,
        variant: res.success ? 'success' : 'error',
      })
    } catch (err: unknown) {
      const msg = readApiError(err, 'No se pudo completar el envío de prueba.')
      setTestResult({ success: false, message: msg })
      toast.show({
        title: 'Error de envío',
        message: msg,
        variant: 'error',
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <SectionCard
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span>Servicio de Correo Electrónico</span>
          <StatusBadge tone={isCustom ? 'success' : isEnabled ? 'info' : 'neutral'}>
            {isCustom ? 'Correo Propio Activo' : isEnabled ? 'Correo Predeterminado Activo' : 'Deshabilitado'}
          </StatusBadge>
        </span>
      }
      info="Elige si deseas enviar tus facturas y notificaciones con el servicio predeterminado o desde tu propia cuenta de correo."
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.25rem',
        }}
      >
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => setEngineMode('system')}
          style={{
            textAlign: 'left',
            padding: '0.9rem 1rem',
            borderRadius: '0.625rem',
            cursor: disabled || loading ? 'not-allowed' : 'pointer',
            border:
              engineMode === 'system'
                ? '2px solid var(--shell-primary, #0284c7)'
                : '1px solid var(--shell-border, var(--glb-border))',
            background:
              engineMode === 'system'
                ? 'rgba(2, 132, 199, 0.08)'
                : 'var(--shell-surface-alt, rgba(0,0,0,0.02))',
            color: 'var(--glb-text)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <strong style={{ fontSize: '0.92rem' }}>Correo predeterminado (Zoho)</strong>
            {!isCustom ? (
              <StatusBadge tone="info">En uso</StatusBadge>
            ) : null}
          </div>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: 'var(--glb-muted)' }}>
            Listo para usar sin configuración adicional. Envía comprobantes y avisos automáticamente.
          </p>
        </button>

        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => setEngineMode('custom')}
          style={{
            textAlign: 'left',
            padding: '0.9rem 1rem',
            borderRadius: '0.625rem',
            cursor: disabled || loading ? 'not-allowed' : 'pointer',
            border:
              engineMode === 'custom'
                ? '2px solid var(--shell-primary, #0284c7)'
                : '1px solid var(--shell-border, var(--glb-border))',
            background:
              engineMode === 'custom'
                ? 'rgba(2, 132, 199, 0.08)'
                : 'var(--shell-surface-alt, rgba(0,0,0,0.02))',
            color: 'var(--glb-text)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <strong style={{ fontSize: '0.92rem' }}>Usar mi propio correo</strong>
            {isCustom ? (
              <StatusBadge tone="success">En uso</StatusBadge>
            ) : null}
          </div>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: 'var(--glb-muted)' }}>
            Conecta tu cuenta personal o corporativa para que los correos salgan con tu dirección.
          </p>
        </button>
      </div>

      {engineMode === 'system' ? (
        <div
          style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            border: '1px solid rgba(2, 132, 199, 0.28)',
            background: 'rgba(2, 132, 199, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CheckCircle2 className="w-5 h-5 text-sky-600 flex-shrink-0" />
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--glb-text)' }}>
                {isCustom
                  ? 'Actualmente estás usando tu correo personal'
                  : 'El correo predeterminado está activo y listo para enviar'}
              </p>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--glb-muted)' }}>
                {isCustom
                  ? 'Haz clic en «Activar correo predeterminado» para volver a usar el correo incluido en el sistema.'
                  : 'Tus comprobantes electrónicos y notificaciones se envían automáticamente sin que tengas que configurar nada.'}
              </p>
            </div>
          </div>

          {isCustom ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={resetting}
              disabled={disabled || loading || resetting}
              onClick={handleResetToUniversal}
            >
              <RotateCcw size={14} aria-hidden />
              <span>Activar correo predeterminado</span>
            </Button>
          ) : null}
        </div>
      ) : (
        <div>
          <div className="ecu-companies-form__grid ecu-companies-form__grid--2">
            <div className="ecu-companies-form__field">
              <Select
                id="email-provider-preset"
                label="Proveedor de correo"
                labelPosition="outlined"
                variant="outline"
                value={providerPreset}
                onChange={(val: string) => handleProviderChange(val as EmailProviderPreset)}
                disabled={disabled || loading}
                options={PROVIDER_OPTIONS}
                fullWidth
                size={size}
              />
            </div>

            <div className="ecu-companies-form__field">
              <TextBox
                id="smtp-sender-name"
                label="Nombre visible al enviar"
                labelPosition="outlined"
                variant="outline"
                value={senderName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSenderName(e.target.value)}
                disabled={disabled || loading}
                placeholder={activeTenantName || 'Ej: Mi Empresa'}
                fullWidth
                size={size}
              />
            </div>

            <div className="ecu-companies-form__field">
              <TextBox
                id="smtp-username"
                label="Tu correo electrónico"
                labelPosition="outlined"
                variant="outline"
                value={userName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const next = e.target.value
                  setUserName(next)
                  if (!senderEmail || senderEmail === userName) {
                    setSenderEmail(next)
                  }
                }}
                disabled={disabled || loading}
                placeholder="facturacion@tuempresa.com"
                fullWidth
                size={size}
              />
            </div>

            <div className="ecu-companies-form__field">
              <div style={{ position: 'relative' }}>
                <TextBox
                  id="smtp-password"
                  label={hasPassword ? 'Contraseña (Guardada)' : 'Contraseña de tu correo'}
                  labelPosition="outlined"
                  variant="outline"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  disabled={disabled || loading}
                  placeholder={
                    hasPassword
                      ? '•••••••• (Deja en blanco para mantener la actual)'
                      : 'Ingresa tu contraseña o clave de aplicación'
                  }
                  fullWidth
                  size={size}
                />
                {password ? (
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: 'var(--glb-muted, #64748b)',
                      display: 'flex',
                      alignItems: 'center',
                      zIndex: 2,
                    }}
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                ) : null}
              </div>
              {hasPassword && !password ? (
                <p
                  style={{
                    margin: '0.35rem 0 0 0',
                    fontSize: '0.8rem',
                    color: '#16a34a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                  <span>Contraseña guardada. Déjala en blanco si no deseas cambiarla.</span>
                </p>
              ) : null}
            </div>
          </div>

          <details
            open={providerPreset === 'other'}
            style={{
              marginTop: '0.75rem',
              padding: '0.65rem 0.9rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--shell-border, var(--glb-border))',
              background: 'var(--shell-surface-alt, rgba(0,0,0,0.02))',
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--glb-muted)',
                userSelect: 'none',
              }}
            >
              Opciones avanzadas de conexión
            </summary>

            <div
              className="ecu-companies-form__grid ecu-companies-form__grid--2"
              style={{ marginTop: '0.85rem' }}
            >
              <div className="ecu-companies-form__field">
                <TextBox
                  id="smtp-host"
                  label="Servidor de salida"
                  labelPosition="outlined"
                  variant="outline"
                  value={host}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setHost(e.target.value)
                    setProviderPreset(detectProviderPreset(e.target.value))
                  }}
                  disabled={disabled || loading}
                  placeholder="smtp.zoho.com"
                  fullWidth
                  size={size}
                />
              </div>

              <div className="ecu-companies-form__field">
                <TextBox
                  id="smtp-port"
                  label="Puerto"
                  labelPosition="outlined"
                  variant="outline"
                  type="number"
                  value={String(port)}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPort(Number(e.target.value))}
                  disabled={disabled || loading}
                  placeholder="465"
                  fullWidth
                  size={size}
                />
              </div>

              <div className="ecu-companies-form__field">
                <TextBox
                  id="smtp-sender-email"
                  label="Correo remitente (si es distinto al de acceso)"
                  labelPosition="outlined"
                  variant="outline"
                  value={senderEmail}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSenderEmail(e.target.value)}
                  disabled={disabled || loading}
                  placeholder={userName || 'facturacion@tuempresa.com'}
                  fullWidth
                  size={size}
                />
              </div>

              <div className="ecu-companies-form__field ecu-companies-form__field--check-align">
                <CheckButton
                  variant="ghost"
                  checked={isEnabled}
                  onChange={(checked: boolean) => setIsEnabled(checked)}
                  disabled={disabled || loading}
                  size={size}
                >
                  Habilitar envío de correos
                </CheckButton>
              </div>
            </div>
          </details>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <Button
              type="button"
              variant="primary"
              loading={saving}
              disabled={disabled || loading}
              onClick={handleSaveCustom}
            >
              <Save size={15} aria-hidden />
              <span>Guardar mi correo</span>
            </Button>

            {isCustom ? (
              <Button
                type="button"
                variant="outline"
                loading={resetting}
                disabled={disabled || loading || resetting}
                onClick={handleResetToUniversal}
              >
                <RotateCcw size={15} aria-hidden />
                <span>Volver al correo predeterminado</span>
              </Button>
            ) : null}
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: '1.5rem',
          padding: '1rem',
          borderRadius: '0.5rem',
          border: '1px solid var(--shell-border, var(--glb-border))',
          background: 'var(--shell-surface-alt, var(--glb-surface-variant, rgba(0,0,0,0.02)))',
        }}
      >
        <h4
          style={{
            margin: '0 0 0.35rem 0',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Send size={15} color="var(--shell-primary, #0284c7)" aria-hidden />
          <span>Enviar correo de prueba</span>
        </h4>
        <p className="ecu-companies-form__hint" style={{ margin: '0 0 0.75rem 0' }}>
          Ingresa un correo electrónico para verificar que los mensajes lleguen correctamente.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '240px' }}>
            <TextBox
              id="smtp-test-target"
              label="Correo de destino"
              labelPosition="outlined"
              variant="outline"
              value={targetEmail}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTargetEmail(e.target.value)}
              disabled={disabled || testing}
              placeholder="tu-correo@empresa.com"
              fullWidth
              size={size}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            loading={testing}
            disabled={disabled || testing || !targetEmail}
            onClick={handleTestConnection}
          >
            <Mail size={15} aria-hidden />
            <span>Enviar prueba</span>
          </Button>
        </div>

        {testResult ? (
          <div
            role="status"
            style={{
              marginTop: '0.75rem',
              padding: '0.65rem 0.85rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              background: testResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: testResult.success ? '#15803d' : '#b91c1c',
              border: `1px solid ${testResult.success ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
            }}
          >
            {testResult.success ? (
              <CheckCircle2 size={16} style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden />
            ) : (
              <AlertCircle size={16} style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden />
            )}
            <span>{testResult.message}</span>
          </div>
        ) : null}
      </div>
    </SectionCard>
  )
}
