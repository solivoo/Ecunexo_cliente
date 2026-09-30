import { TagBox } from 'glubox'
import { Plus } from 'lucide-react'

export interface EcuTagInputProps {
  readonly tags: readonly string[]
  readonly onChange: (tags: string[]) => void
  readonly label?: string
  readonly placeholder?: string
  readonly helperText?: string
  readonly suggestedTags?: readonly string[]
  readonly disabled?: boolean
  readonly maxTags?: number
}

function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').trim()
}

/**
 * Tags del catálogo apoyados en glubox `TagBox`, con sugerencias opcionales debajo.
 */
export function EcuTagInput({
  tags,
  onChange,
  label,
  placeholder = 'Añadir etiqueta…',
  helperText,
  suggestedTags = [],
  disabled = false,
  maxTags = 30,
}: EcuTagInputProps) {
  const availableSuggestions = suggestedTags.filter(
    (st) => !tags.some((t) => t.toLowerCase() === normalizeTag(st).toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <TagBox
        label={label}
        labelPosition={label ? 'outlined' : 'top'}
        variant="outline"
        size="sm"
        value={[...tags]}
        onChange={(next) =>
          onChange(next.map(normalizeTag).filter(Boolean))
        }
        placeholder={placeholder}
        helperText={helperText}
        disabled={disabled}
        maxTags={maxTags}
        fullWidth
      />

      {availableSuggestions.length > 0 && !disabled ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>Sugerencias:</span>
          {availableSuggestions.slice(0, 6).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                const cleaned = normalizeTag(st)
                if (!cleaned || tags.length >= maxTags) return
                if (tags.some((t) => t.toLowerCase() === cleaned.toLowerCase())) return
                onChange([...tags, cleaned])
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                border: '1px dashed var(--shell-border, rgba(148, 163, 184, 0.4))',
                background: 'transparent',
                color: 'var(--glb-muted)',
                cursor: 'pointer',
              }}
            >
              <Plus size={10} />
              <span>#{normalizeTag(st)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
