import { useState } from 'react'
import { Button, ColorPicker } from 'glubox'
import { Plus, X } from 'lucide-react'
import {
  isHexColor,
  parseColorList,
  serializeColorList,
} from '@/lib/catalogAttributes'
import './catalogAttributeColorsField.css'

const DEFAULT_HEX = '#2563eb'

export type CatalogAttributeColorsFieldProps = {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly required?: boolean
  readonly disabled?: boolean
  readonly onChange: (next: string) => void
}

function normalizeHex(hex: string): string {
  const trimmed = hex.trim()
  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toUpperCase()
  }
  return trimmed.toUpperCase()
}

export function CatalogAttributeColorsField({
  id,
  label,
  value,
  required = false,
  disabled = false,
  onChange,
}: CatalogAttributeColorsFieldProps) {
  const colors = parseColorList(value)
  const [draft, setDraft] = useState(DEFAULT_HEX)

  const addColor = () => {
    if (!isHexColor(draft)) return
    const normalized = normalizeHex(draft)
    if (colors.some((c) => c.toUpperCase() === normalized)) return
    onChange(serializeColorList([...colors, normalized]))
  }

  const removeAt = (index: number) => {
    onChange(serializeColorList(colors.filter((_, i) => i !== index)))
  }

  return (
    <div className="cat-attr-colors">
      <div className="cat-attr-colors__add">
        <ColorPicker
          id={id}
          label={required ? `${label} *` : label}
          labelPosition="outlined"
          variant="outline"
          value={draft}
          placeholder={DEFAULT_HEX}
          onChange={setDraft}
          disabled={disabled}
          fullWidth
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={`Agregar ${label.toLowerCase()}`}
          onClick={addColor}
        >
          <Plus size={16} strokeWidth={2} aria-hidden />
        </Button>
      </div>
      {colors.length > 0 ? (
        <ul className="cat-attr-colors__list">
          {colors.map((color, index) => (
            <li key={`${color}-${index}`} className="cat-attr-colors__chip">
              <span
                className="cat-attr-colors__swatch"
                style={isHexColor(color) ? { background: color } : undefined}
                title={color}
                aria-hidden
              />
              <span className="cat-attr-colors__hex">{color}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                aria-label={`Quitar ${color}`}
                onClick={() => removeAt(index)}
              >
                <X size={12} strokeWidth={2.25} aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
