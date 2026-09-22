import { useMemo, useState, type ChangeEvent } from 'react'
import { Button, OptionGroup, Select, TextBox } from 'glubox'
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react'
import type { ProductTemplateLevel, VariantDimensionTemplateDto } from '@/types/catalogApi'
import {
  buildDimensionValuesMap,
  describeTemplateLine,
  isColorDimension,
  readPhotoChoice,
  writePhotoChoice,
  type TemplatePhotoChoice,
} from '@/lib/catalogArchetype'

export interface HierarchyTemplateTreeBuilderProps {
  levels: ProductTemplateLevel[]
  onChange: (levels: ProductTemplateLevel[]) => void
  availableAttributes: VariantDimensionTemplateDto[]
  disabled?: boolean
}

function nextLevelId(): string {
  return `lvl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
}

function usedNames(levels: readonly ProductTemplateLevel[]): Set<string> {
  const names = new Set<string>()
  for (const lvl of levels) {
    for (const name of [...lvl.attributes, ...(lvl.axes ?? [])]) {
      const clean = name.trim().toLowerCase()
      if (clean) names.add(clean)
    }
  }
  return names
}

function withColorFlag(
  levels: readonly ProductTemplateLevel[],
  lookup: Map<string, { isColor: boolean }>
): ProductTemplateLevel[] {
  return levels.map((lvl) => ({
    ...lvl,
    hasColor: (lvl.axes ?? []).some((name) => {
      const found = lookup.get(name.trim().toLowerCase())
      return found?.isColor || isColorDimension(name)
    }),
  }))
}

export function HierarchyTemplateTreeBuilder({
  levels,
  onChange,
  availableAttributes,
  disabled = false,
}: HierarchyTemplateTreeBuilderProps) {
  const [customByLevel, setCustomByLevel] = useState<Record<string, { data: string; axis: string }>>({})

  const attributeLookup = useMemo(
    () => buildDimensionValuesMap(availableAttributes),
    [availableAttributes]
  )

  const photo = useMemo(() => readPhotoChoice(levels), [levels])
  const summary = useMemo(
    () => describeTemplateLine(levels, attributeLookup),
    [levels, attributeLookup]
  )

  const allAxes = useMemo(() => {
    const seen = new Set<string>()
    const names: string[] = []
    for (const lvl of levels) {
      for (const name of lvl.axes ?? []) {
        const clean = name.trim()
        const key = clean.toLowerCase()
        if (!clean || seen.has(key)) continue
        seen.add(key)
        names.push(clean)
      }
    }
    return names
  }, [levels])

  const commit = (next: ProductTemplateLevel[], choice = photo.choice, groupBy = photo.groupBy) => {
    const keptGroup = groupBy.filter((name) =>
      next.some((lvl) => (lvl.axes ?? []).some((axis) => axis.trim().toLowerCase() === name.trim().toLowerCase()))
    )
    const withPhoto = writePhotoChoice(next, choice, choice === 'group' ? keptGroup : [])
    onChange(withColorFlag(withPhoto, attributeLookup))
  }

  const patchLevel = (index: number, patch: Partial<ProductTemplateLevel>) => {
    commit(levels.map((lvl, i) => (i === index ? { ...lvl, ...patch } : lvl)))
  }

  const addToList = (index: number, list: 'attributes' | 'axes', rawName: string) => {
    const name = rawName.trim()
    if (!name) return
    const key = name.toLowerCase()
    if (usedNames(levels).has(key)) return
    const level = levels[index]
    const current = list === 'axes' ? (level.axes ?? []) : level.attributes
    patchLevel(index, { [list]: [...current, name] })
  }

  const removeFromList = (index: number, list: 'attributes' | 'axes', name: string) => {
    const level = levels[index]
    const key = name.trim().toLowerCase()
    const current = list === 'axes' ? (level.axes ?? []) : level.attributes
    patchLevel(index, { [list]: current.filter((item) => item.trim().toLowerCase() !== key) })
  }

  const moveAcross = (index: number, from: 'attributes' | 'axes', name: string) => {
    const to = from === 'attributes' ? 'axes' : 'attributes'
    const level = levels[index]
    const key = name.trim().toLowerCase()
    const source = (from === 'axes' ? level.axes ?? [] : level.attributes).filter(
      (item) => item.trim().toLowerCase() !== key
    )
    const target = [...(to === 'axes' ? level.axes ?? [] : level.attributes), name]
    patchLevel(index, { [from]: source, [to]: target })
  }

  const dictionaryOptions = (preferAxis: boolean) => {
    const taken = usedNames(levels)
    return availableAttributes
      .filter((attr) => !taken.has(attr.name.trim().toLowerCase()))
      .slice()
      .sort((a, b) => {
        const aAxis = a.isVariantAxis !== false
        const bAxis = b.isVariantAxis !== false
        if (aAxis !== bAxis) {
          if (preferAxis) return aAxis ? -1 : 1
          return aAxis ? 1 : -1
        }
        return a.name.localeCompare(b.name, 'es')
      })
      .map((attr) => ({ value: attr.name, label: attr.name }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {levels.map((lvl, index) => (
        <div
          key={lvl.id}
          style={{
            borderRadius: '12px',
            border: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
            background: 'var(--glb-surface, #fff)',
            padding: '1rem 1.1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.9rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--shell-primary, #2563eb)',
              }}
            >
              Nivel {index + 1}
            </span>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <Button
                type="button"
                variant="outline"
                disabled={disabled || index === 0}
                onClick={() => {
                  const next = [...levels]
                  const [item] = next.splice(index, 1)
                  next.splice(index - 1, 0, item)
                  commit(next)
                }}
                aria-label="Subir nivel"
              >
                <ArrowUp size={15} />
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={disabled || index === levels.length - 1}
                onClick={() => {
                  const next = [...levels]
                  const [item] = next.splice(index, 1)
                  next.splice(index + 1, 0, item)
                  commit(next)
                }}
                aria-label="Bajar nivel"
              >
                <ArrowDown size={15} />
              </Button>
              {levels.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => commit(levels.filter((_, i) => i !== index))}
                  aria-label="Quitar nivel"
                >
                  <Trash2 size={15} color="var(--glb-danger, #ef4444)" />
                </Button>
              )}
            </div>
          </div>

          <TextBox
            id={`level-name-${lvl.id}`}
            label="Nombre del nivel"
            labelPosition="outlined"
            variant="outline"
            value={lvl.name}
            placeholder="Ej. Colección, Modelo, Presentación"
            disabled={disabled}
            onChange={(e: ChangeEvent<HTMLInputElement>) => patchLevel(index, { name: e.target.value })}
            fullWidth
          />

          <LevelList
            title="Datos de este nivel"
            hint="Se completan una vez en este peldaño."
            items={lvl.attributes}
            disabled={disabled}
            options={dictionaryOptions(false)}
            customValue={customByLevel[lvl.id]?.data ?? ''}
            onCustomChange={(value) =>
              setCustomByLevel((prev) => ({
                ...prev,
                [lvl.id]: { data: value, axis: prev[lvl.id]?.axis ?? '' },
              }))
            }
            onPick={(name) => addToList(index, 'attributes', name)}
            onAddCustom={() => {
              addToList(index, 'attributes', customByLevel[lvl.id]?.data ?? '')
              setCustomByLevel((prev) => ({
                ...prev,
                [lvl.id]: { data: '', axis: prev[lvl.id]?.axis ?? '' },
              }))
            }}
            onRemove={(name) => removeFromList(index, 'attributes', name)}
            onMove={(name) => moveAcross(index, 'attributes', name)}
            moveLabel="Pasar a ejes"
          />

          <LevelList
            title="Ejes de este nivel"
            hint="Cada valor genera un código distinto. El orden es el orden del código."
            items={lvl.axes ?? []}
            disabled={disabled}
            options={dictionaryOptions(true)}
            customValue={customByLevel[lvl.id]?.axis ?? ''}
            onCustomChange={(value) =>
              setCustomByLevel((prev) => ({
                ...prev,
                [lvl.id]: { data: prev[lvl.id]?.data ?? '', axis: value },
              }))
            }
            onPick={(name) => addToList(index, 'axes', name)}
            onAddCustom={() => {
              addToList(index, 'axes', customByLevel[lvl.id]?.axis ?? '')
              setCustomByLevel((prev) => ({
                ...prev,
                [lvl.id]: { data: prev[lvl.id]?.data ?? '', axis: '' },
              }))
            }}
            onRemove={(name) => removeFromList(index, 'axes', name)}
            onMove={(name) => moveAcross(index, 'axes', name)}
            moveLabel="Pasar a datos"
          />
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() =>
          commit([
            ...levels,
            {
              id: nextLevelId(),
              name: '',
              hasColor: false,
              hasImages: false,
              attributes: [],
              axes: [],
              photoScope: 'none',
            },
          ])
        }
      >
        <Plus size={16} />
        <span>Agregar nivel</span>
      </Button>

      <div
        style={{
          borderRadius: '12px',
          border: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
          padding: '1rem 1.1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Fotos</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--glb-muted, #64748b)', marginTop: '0.15rem' }}>
            Dónde se cargan las imágenes de este tipo de producto.
          </div>
        </div>
        <OptionGroup
          id="template-photo-choice"
          name="template-photo-choice"
          layout="segmented"
          variant="outline"
          value={photo.choice}
          options={[
            { value: 'none', label: 'Sin fotos' },
            { value: 'model', label: 'Del producto' },
            { value: 'group', label: 'Por un eje' },
            { value: 'variant', label: 'Por cada código' },
          ]}
          onChange={(value: string) => {
            const choice = value as TemplatePhotoChoice
            if (choice === 'group' && allAxes.length === 0) return
            commit(levels, choice, choice === 'group' ? photo.groupBy : [])
          }}
          disabled={disabled}
        />
        {photo.choice === 'group' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {allAxes.length === 0 ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--glb-muted)' }}>
                Agrega un eje para elegir cuáles comparten la foto.
              </span>
            ) : (
              allAxes.map((axis) => {
                const active = photo.groupBy.some((name) => name.trim().toLowerCase() === axis.trim().toLowerCase())
                return (
                  <button
                    key={axis}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      const next = active
                        ? photo.groupBy.filter((name) => name.trim().toLowerCase() !== axis.trim().toLowerCase())
                        : [...photo.groupBy, axis]
                      commit(levels, 'group', next)
                    }}
                    style={{
                      borderRadius: '999px',
                      padding: '0.28rem 0.7rem',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: active
                        ? '1px solid color-mix(in srgb, var(--shell-primary, #2563eb) 45%, transparent)'
                        : '1px solid var(--shell-border, rgba(0,0,0,0.12))',
                      background: active
                        ? 'color-mix(in srgb, var(--shell-primary, #2563eb) 12%, transparent)'
                        : 'transparent',
                      color: 'var(--glb-text)',
                    }}
                  >
                    {axis}
                  </button>
                )
              })
            )}
          </div>
        )}
        <div style={{ fontSize: '0.85rem', color: 'var(--glb-text)' }}>{summary}</div>
      </div>
    </div>
  )
}

function LevelList({
  title,
  hint,
  items,
  disabled,
  options,
  customValue,
  onCustomChange,
  onPick,
  onAddCustom,
  onRemove,
  onMove,
  moveLabel,
}: {
  title: string
  hint: string
  items: readonly string[]
  disabled: boolean
  options: { value: string; label: string }[]
  customValue: string
  onCustomChange: (value: string) => void
  onPick: (name: string) => void
  onAddCustom: () => void
  onRemove: (name: string) => void
  onMove: (name: string) => void
  moveLabel: string
}) {
  return (
    <div
      style={{
        borderRadius: '10px',
        padding: '0.85rem',
        background: 'color-mix(in srgb, var(--shell-primary, #2563eb) 4%, var(--glb-surface, #fff))',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
      }}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{title}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #64748b)' }}>{hint}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.4fr) minmax(160px, 1fr)', gap: '0.6rem' }}>
        <Select
          placeholder="Agregar del diccionario"
          value=""
          disabled={disabled || options.length === 0}
          options={[{ value: '', label: 'Agregar del diccionario' }, ...options]}
          onChange={(value: string) => {
            if (value) onPick(value)
          }}
          fullWidth
        />
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <TextBox
            variant="outline"
            value={customValue}
            placeholder="Agregar otro"
            disabled={disabled}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onCustomChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onAddCustom()
              }
            }}
            fullWidth
          />
          <Button type="button" variant="outline" disabled={disabled || !customValue.trim()} onClick={onAddCustom}>
            <Plus size={15} />
          </Button>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {items.length === 0 ? (
          <span style={{ fontSize: '0.78rem', color: 'var(--glb-muted)' }}>Ninguno todavía.</span>
        ) : (
          items.map((item) => (
            <span
              key={item}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.2rem 0.45rem 0.2rem 0.6rem',
                borderRadius: '999px',
                fontSize: '0.78rem',
                fontWeight: 600,
                background: 'var(--glb-surface, #fff)',
                border: '1px solid var(--shell-border, rgba(0,0,0,0.1))',
              }}
            >
              {item}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onMove(item)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--shell-primary, #2563eb)',
                  cursor: 'pointer',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                }}
              >
                {moveLabel}
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemove(item)}
                aria-label={`Quitar ${item}`}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex' }}
              >
                <X size={13} />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  )
}
