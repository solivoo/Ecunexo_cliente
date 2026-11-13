import { useState, type ChangeEvent } from 'react'
import { Button, Popup, Select, TextBox } from 'glubox'
import { Plus } from 'lucide-react'
import { appendListOption } from '@/lib/catalogListOptions'

export type ListOptionSelectProps = {
  readonly label?: string
  readonly value: string
  readonly options: readonly string[]
  readonly onChange: (value: string) => void
  readonly attributeName: string
  readonly tenantId?: string | null
  readonly onAdded?: (value: string) => void | Promise<void>
  readonly disabled?: boolean
  readonly emptyLabel?: string
  readonly allowEmpty?: boolean
  readonly size?: 'sm' | 'md' | 'lg'
  readonly id?: string
}

export function ListOptionSelect({
  label,
  value,
  options,
  onChange,
  attributeName,
  tenantId = null,
  onAdded,
  disabled = false,
  emptyLabel = 'Sin definir',
  allowEmpty = true,
  size = 'md',
  id,
}: ListOptionSelectProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localExtra, setLocalExtra] = useState<string[]>([])

  const hasOwnLabel = Boolean(label?.trim())
  const btnSize = size === 'sm' ? 28 : 32
  const seen = new Set(options.map((item) => item.toLowerCase()))
  const merged = [...options]
  for (const extra of localExtra) {
    if (!seen.has(extra.toLowerCase())) {
      seen.add(extra.toLowerCase())
      merged.push(extra)
    }
  }

  const selectOptions = [
    ...(allowEmpty ? [{ value: '', label: emptyLabel }] : []),
    ...merged.map((item) => ({ value: item, label: item })),
    ...(value && !seen.has(value.toLowerCase()) ? [{ value, label: value }] : []),
  ]

  const handleConfirm = async () => {
    const clean = draft.trim()
    if (!clean) {
      setError('El nombre es obligatorio.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const saved = tenantId ? await appendListOption(tenantId, attributeName, clean) : clean
      if (!tenantId) {
        setLocalExtra((prev) => (prev.some((item) => item.toLowerCase() === saved.toLowerCase()) ? prev : [...prev, saved]))
      }
      await onAdded?.(saved)
      onChange(saved)
      setDraft('')
      setOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar la opción.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0, maxWidth: '100%' }}>
      <div style={{ display: 'flex', gap: '0.35rem', alignItems: hasOwnLabel ? 'flex-end' : 'center', minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Select
            id={id}
            label={hasOwnLabel ? label : undefined}
            labelPosition={hasOwnLabel ? 'outlined' : 'top'}
            variant="outline"
            size={size}
            options={selectOptions}
            value={value}
            onChange={onChange}
            disabled={disabled || busy}
            fullWidth
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size={size === 'sm' ? 'sm' : 'md'}
          title={`Agregar opción a ${attributeName}`}
          aria-label={`Agregar opción a ${attributeName}`}
          onClick={() => {
            setDraft('')
            setError(null)
            setOpen(true)
          }}
          disabled={disabled || busy}
          style={{
            width: btnSize,
            height: btnSize,
            minWidth: btnSize,
            padding: 0,
            borderRadius: '999px',
            flexShrink: 0,
            marginBottom: hasOwnLabel ? 2 : 0,
          }}
        >
          <Plus size={size === 'sm' ? 14 : 16} strokeWidth={2} aria-hidden />
        </Button>
      </div>

      <Popup
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={`Nueva opción · ${attributeName}`}
        width={420}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.25rem 0' }}>
          <TextBox
            id={`list-option-${attributeName}`}
            label="Nombre"
            labelPosition="outlined"
            variant="outline"
            value={draft}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
            placeholder="Escriba aquí..."
            disabled={busy}
            fullWidth
            autoFocus
          />
          {error ? (
            <p role="alert" style={{ margin: 0, fontSize: '0.82rem', color: 'var(--glb-danger-text, #b91c1c)' }}>
              {error}
            </p>
          ) : (
            <p className="ecu-hint" style={{ margin: 0 }}>
              Se agrega a la lista del atributo y queda seleccionada.
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void handleConfirm()}
              loading={busy}
              disabled={busy || !draft.trim()}
            >
              Agregar
            </Button>
          </div>
        </div>
      </Popup>
    </div>
  )
}
