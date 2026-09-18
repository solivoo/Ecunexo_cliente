import { useCallback, useEffect, useState } from 'react'
import { Button, Select, TextBox, useToast } from 'glubox'
import { Copy, Eye, FileCode2, RotateCcw, Save, Sparkles } from 'lucide-react'
import { SectionCard, StatusBadge } from '@/components/ui'
import { useGluComponentSize } from '@/hooks/useGluComponentSize'
import { readApiError } from '@/lib/readApiError'
import {
  getEmailTemplates,
  previewEmailTemplate,
  resetEmailTemplate,
  updateEmailTemplate,
  type EmailTemplateDto,
} from '@/services/settingsApi'

export function AppSettingsEmailTemplatesSection({
  disabled = false,
}: {
  readonly disabled?: boolean
}) {
  const toast = useToast()
  const size = useGluComponentSize()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  const [templates, setTemplates] = useState<EmailTemplateDto[]>([])
  const [selectedAction, setSelectedAction] = useState<string>('sri.invoice.authorized')

  const [subjectTemplate, setSubjectTemplate] = useState('')
  const [bodyHtmlTemplate, setBodyHtmlTemplate] = useState('')
  const [isCustom, setIsCustom] = useState(false)

  const [previewSubject, setPreviewSubject] = useState('')
  const [previewHtml, setPreviewHtml] = useState('')
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor')

  const currentTemplate = templates.find((t) => t.actionCode === selectedAction)

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getEmailTemplates()
      setTemplates(data)
      if (data.length > 0) {
        const found = data.find((t) => t.actionCode === selectedAction) ?? data[0]
        setSelectedAction(found.actionCode)
        setSubjectTemplate(found.subjectTemplate)
        setBodyHtmlTemplate(found.bodyHtmlTemplate)
        setIsCustom(found.isCustom)
      }
    } catch (err: unknown) {
      toast.show({
        title: 'Error al cargar plantillas',
        message: readApiError(err, 'No se pudieron obtener las plantillas de correo.'),
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [selectedAction, toast])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  const handleSelectAction = (actionCode: string) => {
    setSelectedAction(actionCode)
    const t = templates.find((item) => item.actionCode === actionCode)
    if (t) {
      setSubjectTemplate(t.subjectTemplate)
      setBodyHtmlTemplate(t.bodyHtmlTemplate)
      setIsCustom(t.isCustom)
      setPreviewHtml('')
      setPreviewSubject('')
    }
  }

  const handleSave = async () => {
    if (!subjectTemplate.trim()) {
      toast.show({
        title: 'Asunto obligatorio',
        message: 'Ingresa un asunto para la plantilla de correo.',
        variant: 'warning',
      })
      return
    }

    setSaving(true)
    try {
      const updated = await updateEmailTemplate(selectedAction, {
        subjectTemplate: subjectTemplate.trim(),
        bodyHtmlTemplate: bodyHtmlTemplate.trim(),
      })

      setTemplates((prev) =>
        prev.map((t) => (t.actionCode === selectedAction ? updated : t))
      )
      setIsCustom(true)

      toast.show({
        title: 'Plantilla guardada',
        message: `Se actualizó la plantilla para '${updated.actionName}'.`,
        variant: 'success',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'Error al guardar',
        message: readApiError(err, 'No se pudo guardar la plantilla.'),
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      const restored = await resetEmailTemplate(selectedAction)
      setTemplates((prev) =>
        prev.map((t) => (t.actionCode === selectedAction ? restored : t))
      )
      setSubjectTemplate(restored.subjectTemplate)
      setBodyHtmlTemplate(restored.bodyHtmlTemplate)
      setIsCustom(false)

      toast.show({
        title: 'Plantilla restablecida',
        message: 'Se volvió al diseño predeterminado del sistema.',
        variant: 'info',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'Error al restablecer',
        message: readApiError(err, 'No se pudo restablecer la plantilla.'),
        variant: 'error',
      })
    } finally {
      setResetting(false)
    }
  }

  const handleGeneratePreview = async () => {
    setPreviewing(true)
    try {
      const res = await previewEmailTemplate({
        actionCode: selectedAction,
        subjectTemplate,
        bodyHtmlTemplate,
      })
      setPreviewSubject(res.renderedSubject)
      setPreviewHtml(res.renderedHtmlBody)
      setActiveTab('preview')
    } catch (err: unknown) {
      toast.show({
        title: 'Error en vista previa',
        message: readApiError(err, 'No se pudo generar la vista previa.'),
        variant: 'error',
      })
    } finally {
      setPreviewing(false)
    }
  }

  const handleInsertPlaceholder = (placeholder: string) => {
    try {
      void navigator.clipboard.writeText(placeholder)
      toast.show({
        title: 'Variable copiada',
        message: `Se copió ${placeholder} al portapapeles. Pégala en el asunto o cuerpo HTML.`,
        variant: 'success',
      })
    } catch {
      // Ignorar fallback
    }
  }

  return (
    <SectionCard
      title="Plantillas de Correo por Acciones de Negocio"
      subtitle="Personaliza el asunto y el diseño HTML para facturación SRI, cotizaciones, taller y notificaciones corporativas."
      action={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isCustom ? (
            <StatusBadge tone="warning">Personalizado por Empresa</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Predeterminado del Sistema</StatusBadge>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="ecu-companies-form__field">
          <Select
            id="email-action-selector"
            label="Acción o Evento de Negocio"
            labelPosition="outlined"
            variant="outline"
            value={selectedAction}
            onChange={(val: string) => handleSelectAction(val)}
            disabled={disabled || loading}
            options={templates.map((t) => ({
              value: t.actionCode,
              label: t.actionName,
            }))}
            fullWidth
            size={size}
          />
          {currentTemplate && (
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: 'var(--glb-muted)' }}>
              {currentTemplate.description}
            </p>
          )}
        </div>

        {currentTemplate && currentTemplate.availablePlaceholders.length > 0 && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'var(--glb-surface-variant, rgba(255,255,255,0.04))',
              border: '1px solid var(--shell-border, rgba(255,255,255,0.08))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <Sparkles size={14} style={{ color: 'var(--shell-primary)' }} />
              <strong style={{ fontSize: '0.82rem', color: 'var(--glb-text)' }}>
                Variables Disponibles (haz clic para copiar):
              </strong>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {currentTemplate.availablePlaceholders.map((ph) => (
                <button
                  key={ph}
                  type="button"
                  onClick={() => handleInsertPlaceholder(ph)}
                  title={`Haz clic para copiar ${ph}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(var(--shell-primary-rgb), 0.1)',
                    border: '1px solid color-mix(in srgb, var(--shell-primary) 30%, transparent)',
                    color: 'var(--shell-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <Copy size={11} /> {ph}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--shell-border)' }}>
          <Button
            type="button"
            variant={activeTab === 'editor' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('editor')}
          >
            <FileCode2 size={14} /> Editor de Plantilla
          </Button>
          <Button
            type="button"
            variant={activeTab === 'preview' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => void handleGeneratePreview()}
            disabled={previewing}
          >
            <Eye size={14} /> Vista Previa con Datos Reales
          </Button>
        </div>

        {activeTab === 'editor' ? (
          <>
            <div className="ecu-companies-form__field">
              <TextBox
                id="email-template-subject"
                label="Asunto del Correo (Soporta Variables)"
                labelPosition="outlined"
                variant="outline"
                value={subjectTemplate}
                onChange={(e) => setSubjectTemplate(e.target.value)}
                disabled={disabled || loading}
                placeholder="ej: Factura Electrónica {{FacturaNumero}} — {{TenantName}}"
                fullWidth
                size={size}
              />
            </div>

            <div className="ecu-companies-form__field">
              <label
                htmlFor="email-template-body"
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  marginBottom: '0.35rem',
                  color: 'var(--glb-text)',
                }}
              >
                Cuerpo del Mensaje en HTML (Plantilla Responsiva):
              </label>
              <textarea
                id="email-template-body"
                value={bodyHtmlTemplate}
                onChange={(e) => setBodyHtmlTemplate(e.target.value)}
                disabled={disabled || loading}
                rows={12}
                style={{
                  width: '100%',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
                  fontSize: '0.82rem',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  backgroundColor: 'var(--glb-surface)',
                  color: 'var(--glb-text)',
                  border: '1px solid var(--shell-border)',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>
          </>
        ) : (
          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              border: '1px solid var(--shell-border)',
            }}
          >
            <div
              style={{
                paddingBottom: '0.75rem',
                marginBottom: '1rem',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                Asunto Renderizado:
              </span>
              <h4 style={{ margin: '0.25rem 0 0 0', color: '#1e293b', fontSize: '1rem' }}>
                {previewSubject || subjectTemplate}
              </h4>
            </div>

            <div
              style={{ minHeight: '260px' }}
              dangerouslySetInnerHTML={{ __html: previewHtml || bodyHtmlTemplate }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          {isCustom && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleReset()}
              disabled={disabled || resetting || saving}
            >
              <RotateCcw size={14} /> Restablecer a Predeterminada
            </Button>
          )}

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => void handleSave()}
            disabled={disabled || saving || loading}
          >
            <Save size={14} /> Guardar Plantilla
          </Button>
        </div>
      </div>
    </SectionCard>
  )
}
