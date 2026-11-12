import { useState, type ChangeEvent } from 'react'
import { Button, ColorPicker, Popup, TextBox } from 'glubox'
import { normalizeHexColor, type NamedColor } from '@/lib/catalogNamedColors'

export type NamedColorPopupProps = {
  readonly open: boolean
  readonly title?: string
  readonly initialName?: string
  readonly initialHex?: string
  readonly busy?: boolean
  readonly onClose: () => void
  readonly onConfirm: (color: NamedColor) => void | Promise<void>
}

export function NamedColorPopup({
  open,
  title = 'Nuevo color',
  initialName = '',
  initialHex = '#3B82F6',
  busy = false,
  onClose,
  onConfirm,
}: NamedColorPopupProps) {
  const [name, setName] = useState(initialName)
  const [hex, setHex] = useState(normalizeHexColor(initialHex) || '#3B82F6')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const disabled = busy || saving
  const canSave = Boolean(name.trim() && normalizeHexColor(hex))

  const handleConfirm = async () => {
    const cleanName = name.trim()
    const cleanHex = normalizeHexColor(hex)
    if (!cleanName) {
      setError('El nombre es obligatorio.')
      return
    }
    if (!cleanHex) {
      setError('Elige un color hexadecimal válido.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onConfirm({ name: cleanName, hex: cleanHex })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el color.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popup open={open} onClose={() => !disabled && onClose()} title={title} width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '0.25rem 0' }}>
        <TextBox
          id="named-color-name"
          label="Nombre del color"
          labelPosition="outlined"
          variant="outline"
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          placeholder="Ej. Rojo Nike"
          required
          disabled={disabled}
          fullWidth
        />
        <ColorPicker
          id="named-color-hex"
          label="Muestra (hex)"
          labelPosition="outlined"
          variant="outline"
          value={hex}
          onChange={(value: string) => setHex(normalizeHexColor(value) || value)}
          disabled={disabled}
          fullWidth
        />
        {error ? (
          <p role="alert" style={{ margin: 0, fontSize: '0.82rem', color: 'var(--glb-danger-text, #b91c1c)' }}>
            {error}
          </p>
        ) : (
          <p className="ecu-hint" style={{ margin: 0 }}>
            El nombre identifica el color en el catálogo; el hex es la muestra visual.
          </p>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
            paddingTop: '0.5rem',
            borderTop: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
          }}
        >
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={disabled}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => void handleConfirm()}
            loading={saving}
            disabled={disabled || !canSave}
          >
            Guardar color
          </Button>
        </div>
      </div>
    </Popup>
  )
}
