import { useState } from 'react'
import { Button, ColorPicker } from 'glubox'
import { Plus, X } from 'lucide-react'

export interface EcuColorListInputProps {
  readonly colors: readonly string[]
  readonly onChange: (colors: string[]) => void
  readonly label?: string
  readonly helperText?: string
  readonly disabled?: boolean
  readonly maxColors?: number
}

const HEX_TOKEN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

function normalizeHex(raw: string): string {
  return raw.trim().toLowerCase()
}

export function EcuColorListInput({
  colors,
  onChange,
  label,
  helperText,
  disabled = false,
  maxColors = 12,
}: EcuColorListInputProps) {
  const [draft, setDraft] = useState('#3b82f6')

  const canAdd =
    !disabled && colors.length < maxColors && HEX_TOKEN.test(draft) &&
    !colors.some((color) => normalizeHex(color) === normalizeHex(draft))

  const handleAdd = () => {
    if (!canAdd) return
    onChange([...colors, normalizeHex(draft)])
  }

  const handleRemove = (color: string) => {
    if (disabled) return
    onChange(colors.filter((item) => normalizeHex(item) !== normalizeHex(color)))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--glb-text)' }}>
            {label}
          </label>
          <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
            {colors.length} / {maxColors}
          </span>
        </div>
      )}

      {colors.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {colors.map((color) => (
            <span
              key={color}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.2rem 0.55rem',
                borderRadius: '9999px',
                fontSize: '0.78rem',
                fontWeight: 600,
                border: '1px solid var(--shell-border, rgba(0,0,0,0.15))',
                background: 'var(--glb-surface, #fff)',
                color: 'var(--glb-text)',
              }}
            >
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: color,
                  border: '1px solid rgba(0,0,0,0.15)',
                }}
              />
              <span>{color}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(color)}
                  aria-label={`Quitar ${color}`}
                  style={{
                    display: 'inline-flex',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'var(--glb-muted, #94a3b8)',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {!disabled && colors.length < maxColors && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ColorPicker
            value={draft}
            onChange={(hex: string) => setDraft(hex)}
            size="sm"
            variant="outline"
            disabled={disabled}
            width={140}
          />
          <Button type="button" variant="outline" size="sm" onClick={handleAdd} disabled={!canAdd}>
            <Plus size={13} />
            <span>Añadir</span>
          </Button>
        </div>
      )}

      {helperText && (
        <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>{helperText}</span>
      )}
    </div>
  )
}
