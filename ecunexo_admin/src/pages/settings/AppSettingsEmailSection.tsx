import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { Button, CheckButton, TextBox, useToast } from 'glubox'
import {
  AlertCircle,
  CheckCircle2,
  Mail,
  RotateCcw,
  Save,
  Send,
  Sparkles,
} from 'lucide-react'
import { SectionCard, StatusBadge } from '@/components/ui'
import { useGluComponentSize } from '@/hooks/useGluComponentSize'
import { readApiError } from '@/lib/readApiError'
import {
  getEmailSettings,
  resetEmailSettings,
  testEmailSettings,
  updateEmailSettings,
  type EmailSettingsDto,
} from '@/services/settingsApi'

const ZOHO_DEFAULT_HOST = 'smtp.zoho.com'
const ZOHO_DEFAULT_PORT = 465

export function AppSettingsEmailSection({
  disabled = false,
}: {
  readonly disabled?: boolean
}) {
  const toast = useToast()
  const size = useGluComponentSize()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const [isEnabled, setIsEnabled] = useState(true)
  const [host, setHost] = useState(ZOHO_DEFAULT_HOST)
  const [port, setPort] = useState<number>(ZOHO_DEFAULT_PORT)
  const [useSsl, setUseSsl] = useState(true)
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [senderEmail, setSenderEmail] = useState('')
  const [senderName, setSenderName] = useState('EcuNexo')
  const [hasPassword, setHasPassword] = useState(false)

  const [targetEmail, setTargetEmail] = useState('')
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isCustom, setIsCustom] = useState(false)
  const [scope, setScope] = useState<'Global' | 'Tenant'>('Global')
  const [resetting, setResetting] = useState(false)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const data: EmailSettingsDto = await getEmailSettings()
      setIsEnabled(data.isEnabled)
      setHost(data.host || ZOHO_DEFAULT_HOST)
      setPort(data.port || ZOHO_DEFAULT_PORT)
      setUseSsl(data.useSsl)
      setUserName(data.userName || '')
      setSenderEmail(data.senderEmail || '')
      setSenderName(data.senderName || 'EcuNexo')
      setHasPassword(data.hasPassword)
      setIsCustom(Boolean(data.isCustom))
      setScope(data.scope ?? 'Global')
      if (data.hasPassword) {
        setPassword('********')
      }
    } catch (err: unknown) {
      toast.show({
        title: 'Error al cargar ajustes de correo',
        message: readApiError(err, 'No se pudo recuperar la configuración de correo.'),
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const handleResetToUniversal = async () => {
    setResetting(true)
    try {
      const data = await resetEmailSettings()
      setIsEnabled(data.isEnabled)
      setHost(data.host || ZOHO_DEFAULT_HOST)
      setPort(data.port || ZOHO_DEFAULT_PORT)
      setUseSsl(data.useSsl)
      setUserName(data.userName || '')
      setSenderEmail(data.senderEmail || '')
      setSenderName(data.senderName || 'EcuNexo')
      setHasPassword(data.hasPassword)
      setIsCustom(false)
      setScope('Global')
      setPassword(data.hasPassword ? '********' : '')
      toast.show({
        title: 'Motor predeterminado restablecido',
        message: 'Esta empresa volvió a utilizar el motor universal de EcuNexo.',
        variant: 'info',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'Error al restablecer',
        message: readApiError(err, 'No se pudo restablecer la configuración de correo.'),
        variant: 'error',
      })
    } finally {
      setResetting(false)
    }
  }

  const handleApplyZohoDefaults = () => {
    setHost(ZOHO_DEFAULT_HOST)
    setPort(ZOHO_DEFAULT_PORT)
    setUseSsl(true)
    if (!senderName) {
      setSenderName('EcuNexo')
    }
    toast.show({
      title: 'Parámetros de Zoho Mail aplicados',
      message: 'Host configurado a smtp.zoho.com (puerto 465 SSL). Ingresa tu usuario y clave de aplicación.',
      variant: 'info',
    })
  }

  const handleSave = async () => {
    if (!host.trim()) {
      toast.show({
        title: 'Campo obligatorio',
        message: 'El servidor SMTP (Host) no puede estar vacío.',
        variant: 'warning',
      })
      return
    }

    setSaving(true)
    try {
      const updated = await updateEmailSettings({
        isEnabled,
        host: host.trim(),
        port: Number(port) || ZOHO_DEFAULT_PORT,
        useSsl,
        userName: userName.trim(),
        password: password === '********' ? undefined : password,
        senderEmail: senderEmail.trim(),
        senderName: senderName.trim(),
      })

      setHasPassword(updated.hasPassword)
      if (updated.hasPassword) {
        setPassword('********')
      }

      toast.show({
        title: 'Configuración guardada',
        message:
          scope === 'Tenant'
            ? 'Los parámetros del motor de correo se guardaron para esta empresa.'
            : 'Los parámetros del motor de correo se guardaron como configuración global de plataforma.',
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
        message: 'Ingresa un correo electrónico destinatario para enviar el correo de prueba.',
        variant: 'warning',
      })
      return
    }

    setTesting(true)
    setTestResult(null)
    try {
      const res = await testEmailSettings({
        targetEmail: targetEmail.trim(),
        host: host.trim(),
        port: Number(port) || ZOHO_DEFAULT_PORT,
        useSsl,
        userName: userName.trim(),
        password: password === '********' ? undefined : password,
        senderEmail: senderEmail.trim(),
        senderName: senderName.trim(),
      })

      setTestResult(res)
      toast.show({
        title: res.success ? 'Conexión exitosa' : 'Fallo en la prueba',
        message: res.message,
        variant: res.success ? 'success' : 'error',
      })
    } catch (err: unknown) {
      const msg = readApiError(err, 'No se pudo completar la prueba de correo.')
      setTestResult({ success: false, message: msg })
      toast.show({
        title: 'Error de prueba',
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
          <span>Motor de Correo Electrónico (Zoho Mail / SMTP)</span>
          <StatusBadge tone={isCustom ? 'success' : isEnabled ? 'info' : 'neutral'}>
            {isCustom ? 'Motor Propio de la Empresa' : isEnabled ? 'Universal EcuNexo (Heredado)' : 'Deshabilitado'}
          </StatusBadge>
        </span>
      }
      subtitle={
        scope === 'Tenant'
          ? 'Personaliza el servidor SMTP exclusivo de esta empresa. Si no configuras uno propio, el sistema utiliza el motor universal de EcuNexo automáticamente.'
          : 'Configuración global de plataforma que actúa como respaldo universal para todas las empresas sin correo propio.'
      }
      action={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isCustom && scope === 'Tenant' && !disabled ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={resetting || loading}
              onClick={handleResetToUniversal}
            >
              <RotateCcw size={14} aria-hidden />
              <span>{resetting ? 'Restableciendo…' : 'Restaurar motor EcuNexo'}</span>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || loading}
            onClick={handleApplyZohoDefaults}
          >
            <Sparkles size={14} aria-hidden />
            <span>Preajuste Zoho Mail</span>
          </Button>
        </div>
      }
    >
      {scope === 'Tenant' ? (
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '0.875rem 1rem',
            borderRadius: '8px',
            border: isCustom ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(2, 132, 199, 0.3)',
            background: isCustom ? 'rgba(16, 185, 129, 0.06)' : 'rgba(2, 132, 199, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isCustom ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-sky-600 flex-shrink-0" />
            )}
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--glb-text)' }}>
                {isCustom
                  ? 'Motor de Correo Propio de esta Empresa'
                  : 'Motor Universal EcuNexo (Por Defecto)'}
              </p>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--glb-muted)' }}>
                {isCustom
                  ? 'Esta empresa utiliza sus propias credenciales SMTP exclusivas para facturas y comprobantes. No afecta a las demás empresas.'
                  : 'Esta empresa aún no tiene un correo propio configurado y está usando el motor universal de la plataforma. Si guardas datos aquí, se creará su propio motor sin afectar a las demás empresas.'}
              </p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="ecu-companies-form__grid ecu-companies-form__grid--2">
        <div className="ecu-companies-form__field">
          <TextBox
            id="smtp-host"
            label="Servidor SMTP (Host)"
            labelPosition="outlined"
            variant="outline"
            value={host}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setHost(e.target.value)}
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
            id="smtp-username"
            label="Usuario / Correo de autenticación"
            labelPosition="outlined"
            variant="outline"
            value={userName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setUserName(e.target.value)}
            disabled={disabled || loading}
            placeholder="notificaciones@tudominio.com"
            fullWidth
            size={size}
          />
        </div>

        <div className="ecu-companies-form__field">
          <TextBox
            id="smtp-password"
            label="Contraseña o Clave de Aplicación"
            labelPosition="outlined"
            variant="outline"
            type="password"
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            disabled={disabled || loading}
            placeholder={hasPassword ? '••••••••' : 'Clave de aplicación Zoho'}
            fullWidth
            size={size}
          />
        </div>

        <div className="ecu-companies-form__field">
          <TextBox
            id="smtp-sender-email"
            label="Correo del Remitente (From Address)"
            labelPosition="outlined"
            variant="outline"
            value={senderEmail}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSenderEmail(e.target.value)}
            disabled={disabled || loading}
            placeholder="ej: facturacion@tudominio.com"
            fullWidth
            size={size}
          />
        </div>

        <div className="ecu-companies-form__field">
          <TextBox
            id="smtp-sender-name"
            label="Nombre del Remitente (From Name)"
            labelPosition="outlined"
            variant="outline"
            value={senderName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSenderName(e.target.value)}
            disabled={disabled || loading}
            placeholder="EcuNexo Notificaciones"
            fullWidth
            size={size}
          />
        </div>

        <div className="ecu-companies-form__field ecu-companies-form__field--check-align">
          <CheckButton
            variant="ghost"
            checked={useSsl}
            onChange={(checked: boolean) => setUseSsl(checked)}
            disabled={disabled || loading}
            size={size}
          >
            Usar conexión segura SSL / TLS (Recomendado para Zoho en puerto 465 o 587)
          </CheckButton>
        </div>

        <div className="ecu-companies-form__field ecu-companies-form__field--check-align">
          <CheckButton
            variant="ghost"
            checked={isEnabled}
            onChange={(checked: boolean) => setIsEnabled(checked)}
            disabled={disabled || loading}
            size={size}
          >
            {scope === 'Tenant'
              ? 'Habilitar motor de correos para esta empresa'
              : 'Habilitar motor de correos para todas las empresas'}
          </CheckButton>
        </div>
      </div>

      <p className="ecu-companies-form__hint" style={{ marginTop: '0.5rem' }}>
        <strong>Nota sobre Zoho Mail:</strong> Si tu cuenta de Zoho tiene autenticación en dos pasos (2FA),
        debes generar una <em>Contraseña de Aplicación</em> en tu panel de seguridad de Zoho (Seguridad &rarr; Contraseñas de aplicación)
        y pegarla en este campo.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <Button
          type="button"
          variant="primary"
          loading={saving}
          disabled={disabled || loading}
          onClick={handleSave}
        >
          <Save size={15} aria-hidden />
          <span>Guardar Configuración</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={disabled || loading}
          onClick={() => void loadSettings()}
        >
          <RotateCcw size={15} aria-hidden />
          <span>Restablecer</span>
        </Button>
      </div>

      <div
        style={{
          marginTop: '1.5rem',
          padding: '1rem',
          borderRadius: '0.5rem',
          border: '1px solid var(--shell-border, var(--glb-border))',
          background: 'var(--shell-surface-alt, var(--glb-surface-variant, rgba(0,0,0,0.02)))',
        }}
      >
        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Send size={15} color="var(--shell-primary, #0284c7)" aria-hidden />
          <span>Prueba de Envío y Diagnóstico SMTP</span>
        </h4>
        <p className="ecu-companies-form__hint" style={{ margin: '0 0 0.75rem 0' }}>
          Envía un correo de verificación en tiempo real para validar que el servidor, puerto y credenciales de Zoho respondan correctamente.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '240px' }}>
            <TextBox
              id="smtp-test-target"
              label="Correo de destino para la prueba"
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
            <span>Enviar Correo de Prueba</span>
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
