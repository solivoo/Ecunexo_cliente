import { useState, type KeyboardEvent, type ChangeEvent } from 'react'
import { Tag as TagIcon, X, Plus } from 'lucide-react'
import { Button } from 'glubox'

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

export function EcuTagInput({
  tags,
  onChange,
  label = 'Etiquetas / Tags',
  placeholder = 'Añadir etiqueta (ej. Nike, Algodon, Antideslizante)...',
  helperText,
  suggestedTags = [],
  disabled = false,
  maxTags = 30,
}: EcuTagInputProps) {
  const [inputValue, setInputValue] = useState('')

  const normalizeTag = (raw: string): string => {
    return raw.trim().replace(/^#+/, '').trim()
  }

  const handleAddTag = (rawTag: string) => {
    if (disabled) return
    const cleaned = normalizeTag(rawTag)
    if (!cleaned) return

    // Prevenir duplicados (case-insensitive)
    const exists = tags.some((t) => t.toLowerCase() === cleaned.toLowerCase())
    if (exists) {
      setInputValue('')
      return
    }

    if (tags.length >= maxTags) return

    onChange([...tags, cleaned])
    setInputValue('')
  }

  const handleRemoveTag = (tagToRemove: string) => {
    if (disabled) return
    onChange(tags.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase()))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      handleAddTag(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      handleRemoveTag(tags[tags.length - 1])
    }
  }

  const availableSuggestions = suggestedTags.filter(
    (st) => !tags.some((t) => t.toLowerCase() === normalizeTag(st).toLowerCase())
  )

  return (
    <div className="ecu-tag-input-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--glb-text)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <TagIcon size={14} style={{ color: 'var(--shell-primary, #3b82f6)' }} />
            <span>{label}</span>
          </label>
          <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
            {tags.length} / {maxTags}
          </span>
        </div>
      )}

      {/* Input container with chips and input */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.45rem 0.65rem',
          borderRadius: '8px',
          border: '1px solid var(--shell-border, rgba(255,255,255,0.12))',
          background: 'var(--glb-surface, rgba(255,255,255,0.03))',
          minHeight: '44px',
          transition: 'border-color 0.15s ease',
        }}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.2rem 0.55rem',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              color: 'var(--shell-primary, #60a5fa)',
            }}
          >
            <span>#{tag}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: 'inherit',
                  opacity: 0.7,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.7'
                }}
                title={`Eliminar #${tag}`}
              >
                <X size={12} />
              </button>
            )}
          </span>
        ))}

        {!disabled && tags.length < maxTags && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: '1 1 140px' }}>
            <input
              type="text"
              value={inputValue}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={tags.length === 0 ? placeholder : 'Añadir más...'}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '0.85rem',
                color: 'var(--glb-text)',
                width: '100%',
                minWidth: '120px',
              }}
            />
            {inputValue.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddTag(inputValue)}
                style={{ padding: '0.15rem 0.4rem', height: '24px', fontSize: '0.75rem' }}
              >
                <Plus size={12} />
                <span>Añadir</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Suggested tags if available */}
      {availableSuggestions.length > 0 && !disabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>Sugerencias:</span>
          {availableSuggestions.slice(0, 6).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => handleAddTag(st)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                border: '1px dashed var(--shell-border, rgba(255,255,255,0.15))',
                background: 'transparent',
                color: 'var(--glb-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--shell-primary, #3b82f6)'
                e.currentTarget.style.color = 'var(--glb-text)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--shell-border, rgba(255,255,255,0.15))'
                e.currentTarget.style.color = 'var(--glb-muted)'
              }}
            >
              <Plus size={10} />
              <span>#{st}</span>
            </button>
          ))}
        </div>
      )}

      {helperText && (
        <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
          {helperText}
        </span>
      )}
    </div>
  )
}
