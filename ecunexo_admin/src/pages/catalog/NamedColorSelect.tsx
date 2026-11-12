import { useMemo, useState } from 'react'
import { Button, Select } from 'glubox'
import { Plus, X } from 'lucide-react'
import {
  paletteFromDimensionMap,
  upsertSystemNamedColor,
  type NamedColor,
} from '@/lib/catalogNamedColors'
import type { DimensionLookup } from '@/lib/catalogArchetype'
import { NamedColorPopup } from '@/pages/catalog/NamedColorPopup'

export type NamedColorSelectProps = {
  readonly label?: string
  readonly value?: string
  readonly onChange?: (colorName: string) => void
  /** Varios nombres separados; si se define, el control es multi (chips). */
  readonly multiValues?: readonly string[]
  readonly onMultiChange?: (names: string[]) => void
  readonly dimensionValuesMap?: Map<string, DimensionLookup>
  readonly palette?: readonly NamedColor[]
  readonly tenantId?: string | null
  readonly onPaletteUpdated?: () => void | Promise<void>
  readonly disabled?: boolean
  readonly emptyLabel?: string
  readonly allowEmpty?: boolean
  /** En filas densas (matriz) usar `sm` y label externo. */
  readonly size?: 'sm' | 'md' | 'lg'
}

function Swatch({ hex, size = 14 }: { readonly hex: string; readonly size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        backgroundColor: hex || '#808080',
        border: '1px solid rgba(0,0,0,0.2)',
        flexShrink: 0,
        display: 'inline-block',
      }}
    />
  )
}

export function NamedColorSelect({
  label,
  value = '',
  onChange = () => undefined,
  multiValues,
  onMultiChange,
  dimensionValuesMap,
  palette: paletteProp,
  tenantId = null,
  onPaletteUpdated,
  disabled = false,
  emptyLabel = 'Ninguno',
  allowEmpty = true,
  size = 'md',
}: NamedColorSelectProps) {
  const [popupOpen, setPopupOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [localExtra, setLocalExtra] = useState<NamedColor[]>([])

  const isMulti = Array.isArray(multiValues) && typeof onMultiChange === 'function'
  // Sin label propio: no usar "outlined" (rompe el borde del trigger).
  const hasOwnLabel = Boolean(label?.trim())
  const btnSize = size === 'sm' ? 28 : 32

  const basePalette = useMemo(() => {
    if (paletteProp !== undefined) return [...paletteProp]
    return paletteFromDimensionMap(dimensionValuesMap)
  }, [dimensionValuesMap, paletteProp])

  const palette = useMemo(() => {
    const seen = new Set(basePalette.map((c) => c.name.toLowerCase()))
    const merged = [...basePalette]
    for (const c of localExtra) {
      const key = c.name.toLowerCase()
      if (seen.has(key)) {
        // Preferir hex recién creado sobre stub gris.
        const idx = merged.findIndex((m) => m.name.toLowerCase() === key)
        if (idx >= 0) merged[idx] = { ...merged[idx], hex: c.hex || merged[idx].hex }
        continue
      }
      seen.add(key)
      merged.push(c)
    }
    // Valores ya guardados que no están en la paleta (legado) siguen visibles.
    const current = isMulti ? (multiValues ?? []) : value ? [value] : []
    for (const name of current) {
      const key = name.trim().toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      merged.push({ name: name.trim(), hex: '#808080' })
    }
    return merged
  }, [basePalette, localExtra, isMulti, multiValues, value])

  const hexFor = (name: string) =>
    palette.find((c) => c.name.toLowerCase() === name.trim().toLowerCase())?.hex ?? '#808080'

  const selectOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = []
    if (allowEmpty && !isMulti) opts.push({ value: '', label: emptyLabel })
    if (isMulti) opts.push({ value: '', label: 'Elegir color…' })
    for (const c of palette) {
      if (isMulti && multiValues?.some((v) => v.toLowerCase() === c.name.toLowerCase())) continue
      opts.push({ value: c.name, label: c.name })
    }
    return opts
  }, [allowEmpty, emptyLabel, isMulti, multiValues, palette])

  const selectedHex = value ? hexFor(value) : ''

  const applySelection = (colorName: string) => {
    if (isMulti && onMultiChange) {
      const next = [...(multiValues ?? [])]
      if (!next.some((n) => n.toLowerCase() === colorName.toLowerCase())) {
        next.push(colorName)
      }
      onMultiChange(next)
      return
    }
    onChange(colorName)
  }

  const handleCreated = async (color: NamedColor) => {
    setBusy(true)
    try {
      // 1) Listar de inmediato (hex correcto) aunque el refetch del padre tarde.
      setLocalExtra((prev) => {
        const key = color.name.toLowerCase()
        const without = prev.filter((c) => c.name.toLowerCase() !== key)
        return [...without, color]
      })
      // 2) Persistencia en la paleta del sistema.
      if (tenantId) {
        await upsertSystemNamedColor(tenantId, color)
        await onPaletteUpdated?.()
      }
      // 3) Agregar a la selección del producto.
      applySelection(color.name)
      setPopupOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: 0, maxWidth: '100%' }}>
      <div style={{ display: 'flex', gap: '0.35rem', alignItems: hasOwnLabel ? 'flex-end' : 'center', minWidth: 0 }}>
        {!isMulti && value ? (
          <span
            title={value}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: size === 'sm' ? 18 : 20,
              height: size === 'sm' ? 18 : 20,
              borderRadius: 6,
              border: '1px solid var(--shell-border, rgba(0,0,0,0.2))',
              flexShrink: 0,
              background: selectedHex,
              marginBottom: hasOwnLabel ? 2 : 0,
            }}
          />
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Select
            label={hasOwnLabel ? label : undefined}
            labelPosition={hasOwnLabel ? 'outlined' : 'top'}
            variant="outline"
            size={size}
            options={selectOptions}
            value={isMulti ? '' : value}
            onChange={(val) => {
              if (!val) {
                if (!isMulti) onChange('')
                return
              }
              if (isMulti && onMultiChange) {
                if (multiValues?.some((n) => n.toLowerCase() === val.toLowerCase())) return
                onMultiChange([...(multiValues ?? []), val])
                return
              }
              onChange(val)
            }}
            disabled={disabled || busy}
            fullWidth
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size={size === 'sm' ? 'sm' : 'md'}
          title="Nuevo color nombrado"
          aria-label="Nuevo color nombrado"
          onClick={() => setPopupOpen(true)}
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

      {isMulti && (multiValues?.length ?? 0) > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {multiValues!.map((name) => (
            <span
              key={name}
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
              <Swatch hex={hexFor(name)} size={12} />
              {name}
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Quitar ${name}`}
                  onClick={() =>
                    onMultiChange?.(multiValues!.filter((n) => n.toLowerCase() !== name.toLowerCase()))
                  }
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
      ) : null}

      {popupOpen ? (
        <NamedColorPopup
          key="named-color-select-popup"
          open={popupOpen}
          title="Nuevo color nombrado"
          busy={busy}
          onClose={() => !busy && setPopupOpen(false)}
          onConfirm={handleCreated}
        />
      ) : null}
    </div>
  )
}
