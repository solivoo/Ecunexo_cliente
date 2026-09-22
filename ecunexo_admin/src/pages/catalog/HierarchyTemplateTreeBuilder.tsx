import { useMemo, useState, type ChangeEvent } from 'react'
import { Button, Select, TextBox } from 'glubox'
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  Copy,
  GitFork,
  Layers,
  LayoutGrid,
  Palette,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  Workflow,
  X,
} from 'lucide-react'
import type {
  ProductTemplateLevel,
  VariantDimensionTemplateDto,
} from '@/types/catalogApi'
import {
  buildDimensionValuesMap,
  getVariantDimensionFields,
  resolveAttributeLookup,
  resolveIsVariantAxis,
  resolvePhotoScope,
} from '@/lib/catalogArchetype'

export interface HierarchyTemplateTreeBuilderProps {
  levels: ProductTemplateLevel[]
  onChange: (levels: ProductTemplateLevel[]) => void
  availableAttributes: VariantDimensionTemplateDto[]
  disabled?: boolean
}

const DATA_TYPE_LABELS: Record<string, string> = {
  text: 'Texto',
  number: 'Número',
  boolean: 'Sí / No',
  color: 'Color',
  multiselect: 'Varios valores',
}

function photoScopeOf(level: ProductTemplateLevel): 'none' | 'variant' | 'group' | 'model' {
  return level.photoScope ?? (level.hasImages ? 'variant' : 'none')
}

function photoScopeLabel(scope: 'none' | 'variant' | 'group' | 'model'): string {
  switch (scope) {
    case 'model':
      return 'Foto: Modelo'
    case 'group':
      return 'Foto: Grupo'
    case 'variant':
      return 'Foto: Variante'
    default:
      return ''
  }
}

function nextLevelId(): string {
  return `lvl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
}

export function HierarchyTemplateTreeBuilder({
  levels,
  onChange,
  availableAttributes,
  disabled = false,
}: HierarchyTemplateTreeBuilderProps) {
  const [selectedAttrByLevel, setSelectedAttrByLevel] = useState<Record<string, string>>({})
  const [customAttrInputByLevel, setCustomAttrInputByLevel] = useState<Record<string, string>>({})
  const [previewMode, setPreviewMode] = useState<'board' | 'tree'>('board')

  const attributeLookup = useMemo(
    () => buildDimensionValuesMap(availableAttributes),
    [availableAttributes]
  )

  const variantFields = useMemo(
    () => getVariantDimensionFields(levels, attributeLookup),
    [levels, attributeLookup]
  )

  const axisFieldNames = useMemo(() => {
    const names = variantFields.map((f) => f.key)
    if (
      levels.some((lvl) => lvl.hasColor) &&
      !names.some((name) => name.trim().toLowerCase().includes('color'))
    ) {
      names.push('Color')
    }
    return names
  }, [levels, variantFields])

  const effectivePhotoScope = useMemo(() => resolvePhotoScope(levels), [levels])

  const attributeRoleLabel = (name: string, levelIndex: number): string =>
    resolveIsVariantAxis(attributeLookup, name, levelIndex, levels.length) ? 'Variantes' : 'Descriptivo'

  const attributeTypeLabel = (name: string): string => {
    const lookup = resolveAttributeLookup(attributeLookup, name)
    if (!lookup) return 'Sin tipado'
    const type = DATA_TYPE_LABELS[lookup.dataType] ?? 'Texto'
    return lookup.unit ? `${type} · ${lookup.unit}` : type
  }

  const handleAddLevel = () => {
    const nextIdx = levels.length + 1
    let defaultName = `Nivel ${nextIdx}`
    let hasColor = false

    if (nextIdx === 1) {
      defaultName = 'Colección / Familia'
    } else if (nextIdx === 2) {
      defaultName = 'Modelo / Estilo'
    } else if (nextIdx === 3) {
      defaultName = 'Variantes Físicas'
      hasColor = true
    }

    const newLevel: ProductTemplateLevel = {
      id: nextLevelId(),
      name: defaultName,
      hasColor,
      hasImages: false,
      attributes: [],
      photoScope: 'none',
    }

    onChange([...levels, newLevel])
  }

  const handleDuplicateLevel = (index: number) => {
    const source = levels[index]
    const cloned: ProductTemplateLevel = {
      id: nextLevelId(),
      name: `${source.name} (Copia)`,
      hasColor: source.hasColor,
      hasImages: source.hasImages,
      attributes: [...source.attributes],
      photoScope: source.photoScope,
    }
    const updated = [...levels]
    updated.splice(index + 1, 0, cloned)
    onChange(updated)
  }

  const handleRemoveLevel = (index: number) => {
    if (levels.length <= 1) return
    const updated = levels.filter((_, i) => i !== index)
    onChange(updated)
  }

  const handleMoveLevel = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= levels.length) return
    const updated = [...levels]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp
    onChange(updated)
  }

  const handleUpdateLevel = (index: number, patch: Partial<ProductTemplateLevel>) => {
    const updated = levels.map((lvl, i) => (i === index ? { ...lvl, ...patch } : lvl))
    onChange(updated)
  }

  const handleAddAttributeFromCatalog = (levelIndex: number, attrName: string) => {
    if (!attrName) return
    const level = levels[levelIndex]
    if (level.attributes.includes(attrName)) return
    handleUpdateLevel(levelIndex, { attributes: [...level.attributes, attrName] })
    setSelectedAttrByLevel((prev) => ({ ...prev, [level.id]: '' }))
  }

  const handleAddCustomAttribute = (levelIndex: number) => {
    const level = levels[levelIndex]
    const val = (customAttrInputByLevel[level.id] ?? '').trim()
    if (!val) return
    if (level.attributes.includes(val)) return
    handleUpdateLevel(levelIndex, { attributes: [...level.attributes, val] })
    setCustomAttrInputByLevel((prev) => ({ ...prev, [level.id]: '' }))
  }

  const handleRemoveAttribute = (levelIndex: number, attrName: string) => {
    const level = levels[levelIndex]
    handleUpdateLevel(levelIndex, {
      attributes: level.attributes.filter((a) => a !== attrName),
    })
  }

  return (
    <div className="cat-hierarchy-builder" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Levels list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {levels.map((lvl, index) => {
          const isFirst = index === 0
          const isLast = index === levels.length - 1
          const levelLabel =
            index === 0
              ? 'Nivel 1 (Base / Colección)'
              : isLast
                ? `Nivel ${index + 1} (Terminal / Variantes)`
                : `Nivel ${index + 1} (Intermedio / Ficha del modelo)`

          // Atributos sugeridos rápidos para este nivel (excluyendo los ya asignados)
          const suggestedAttributes = availableAttributes
            .filter((a) => !lvl.attributes.includes(a.name))
            .slice(0, 4)

          return (
            <div
              key={lvl.id}
              style={{
                borderRadius: '12px',
                border: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
                background: 'var(--glb-surface, #ffffff)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              {/* Level header bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--shell-border, rgba(255,255,255,0.06))',
                  paddingBottom: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '6px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: 'var(--shell-primary, #3b82f6)',
                    }}
                  >
                    {levelLabel}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => handleDuplicateLevel(index)}
                    aria-label="Duplicar este nivel"
                    title="Duplicar este nivel con sus atributos"
                  >
                    <Copy size={15} />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled || isFirst}
                    onClick={() => handleMoveLevel(index, 'up')}
                    aria-label="Mover nivel arriba"
                    title="Mover nivel arriba"
                  >
                    <ArrowUp size={15} />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled || isLast}
                    onClick={() => handleMoveLevel(index, 'down')}
                    aria-label="Mover nivel abajo"
                    title="Mover nivel abajo"
                  >
                    <ArrowDown size={15} />
                  </Button>
                  {levels.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => handleRemoveLevel(index)}
                      aria-label="Eliminar este nivel"
                      title="Eliminar este nivel"
                    >
                      <Trash2 size={15} color="var(--glb-danger, #ef4444)" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Level Name & Media Capabilities */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1rem',
                  alignItems: 'center',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      marginBottom: '0.35rem',
                      color: 'var(--glb-text)',
                    }}
                  >
                    Nombre del Nivel *
                  </label>
                  <TextBox
                    variant="outline"
                    value={lvl.name}
                    placeholder="Ej. Colección, Modelo, Tallas..."
                    disabled={disabled}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleUpdateLevel(index, { name: e.target.value })
                    }
                    fullWidth
                  />
                </div>

                {/* Toggles Color & Photo */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', paddingTop: '1.25rem' }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      background: lvl.hasColor
                        ? 'rgba(16, 185, 129, 0.12)'
                        : 'color-mix(in srgb, var(--shell-primary, #3b82f6) 3%, var(--glb-surface, #ffffff))',
                      border: `1px solid ${
                        lvl.hasColor ? 'rgba(16, 185, 129, 0.35)' : 'var(--shell-border, rgba(0,0,0,0.1))'
                      }`,
                      color: lvl.hasColor ? '#059669' : 'var(--glb-text)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      id={`has-color-${lvl.id}`}
                      type="checkbox"
                      checked={lvl.hasColor}
                      disabled={disabled}
                      onChange={(e) => handleUpdateLevel(index, { hasColor: e.target.checked })}
                      style={{ cursor: 'pointer' }}
                    />
                    <Palette size={16} />
                    <span>Lleva Colores (Paleta / Picker)</span>
                  </label>

                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      minWidth: 300,
                      maxWidth: 360,
                    }}
                  >
                    <Camera size={16} color={lvl.hasImages ? '#7c3aed' : 'var(--glb-muted, #64748b)'} />
                    <Select
                      id={`photo-scope-${lvl.id}`}
                      size="sm"
                      variant="outline"
                      label="Fotografías"
                      labelPosition="left"
                      value={lvl.photoScope ?? (lvl.hasImages ? 'variant' : 'none')}
                      options={[
                        { value: 'none', label: 'Sin fotos' },
                        { value: 'variant', label: 'Por variante (SKU)' },
                        { value: 'group', label: 'Compartidas por grupo' },
                        { value: 'model', label: 'Del modelo (todas las variantes)' },
                      ]}
                      onChange={(scope: string) =>
                        handleUpdateLevel(index, {
                          photoScope: scope as 'none' | 'variant' | 'group' | 'model',
                          hasImages: scope !== 'none',
                        })
                      }
                      disabled={disabled}
                      fullWidth
                    />
                  </div>
                </div>
              </div>

              {/* Attributes Section */}
              <div
                style={{
                  background: 'color-mix(in srgb, var(--shell-primary, #3b82f6) 4%, var(--glb-surface, #ffffff))',
                  border: '1px solid color-mix(in srgb, var(--shell-primary, #3b82f6) 16%, var(--shell-border, rgba(0,0,0,0.08)))',
                  borderRadius: '10px',
                  padding: '1.1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--glb-text)' }}>
                    <Tag size={16} color="var(--shell-primary, #3b82f6)" />
                    <span>Atributos vinculados a este nivel</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
                    Elige atributos del diccionario para evitar duplicados o errores
                  </span>
                </div>

                {/* Attribute selection controls */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(200px, 1.5fr) minmax(180px, 1fr)',
                    gap: '0.75rem',
                    alignItems: 'flex-end',
                  }}
                >
                  {/* Select from master attributes */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--glb-muted)', marginBottom: '0.25rem' }}>
                      Desde el Diccionario de Atributos:
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Select
                        id={`attr-select-${lvl.id}`}
                        placeholder="Seleccionar atributo corporativo..."
                        value={selectedAttrByLevel[lvl.id] ?? ''}
                        disabled={disabled}
                        onChange={(val: string) => {
                          if (val) {
                            handleAddAttributeFromCatalog(index, val)
                          }
                        }}
                        options={[
                          { value: '', label: 'Seleccionar atributo...' },
                          ...availableAttributes
                            .filter((a) => !lvl.attributes.includes(a.name))
                            .map((a) => ({
                              value: a.name,
                              label: `${a.name} · ${DATA_TYPE_LABELS[a.dataType ?? 'text'] ?? 'Texto'} · ${
                                a.isVariantAxis === false ? 'Descriptivo' : 'Variantes'
                              }${a.unit ? ` (${a.unit})` : ''}`,
                            })),
                        ]}
                        fullWidth
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={disabled || !selectedAttrByLevel[lvl.id]}
                        onClick={() => handleAddAttributeFromCatalog(index, selectedAttrByLevel[lvl.id])}
                        title="Vincular atributo seleccionado"
                      >
                        <Plus size={16} />
                      </Button>
                    </div>
                  </div>

                  {/* Custom attribute input */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--glb-muted)', marginBottom: '0.25rem' }}>
                      O agregar nuevo atributo libre:
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <TextBox
                        id={`attr-custom-${lvl.id}`}
                        variant="outline"
                        value={customAttrInputByLevel[lvl.id] ?? ''}
                        placeholder="Ej. Material, Acabado, Capacidad..."
                        disabled={disabled}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setCustomAttrInputByLevel((prev) => ({ ...prev, [lvl.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddCustomAttribute(index)
                          }
                        }}
                        fullWidth
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={disabled || !(customAttrInputByLevel[lvl.id] ?? '').trim()}
                        onClick={() => handleAddCustomAttribute(index)}
                        title="Añadir atributo"
                      >
                        <Plus size={16} />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 1-Click Quick Attribute Suggestions */}
                {suggestedAttributes.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--glb-muted)', fontWeight: 500 }}>
                      Sugeridos para 1 clic:
                    </span>
                    {suggestedAttributes.map((attr) => (
                      <button
                        key={attr.name}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleAddAttributeFromCatalog(index, attr.name)}
                        style={{
                          background: 'color-mix(in srgb, var(--shell-primary, #3b82f6) 8%, var(--glb-surface, #ffffff))',
                          border: '1px solid color-mix(in srgb, var(--shell-primary, #3b82f6) 24%, var(--shell-border, rgba(0,0,0,0.1)))',
                          color: 'var(--shell-primary, #2563eb)',
                          borderRadius: '6px',
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          transition: 'all 0.15s ease',
                        }}
                        title={`Agregar «${attr.name}» en 1 clic`}
                      >
                        <Plus size={11} />
                        <span>{attr.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Active Attribute chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                  {lvl.attributes.length === 0 ? (
                    <span style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--glb-muted)' }}>
                      Sin atributos asignados en este nivel (opcional). Selecciona uno arriba para agregarlo al instante.
                    </span>
                  ) : (
                    lvl.attributes.map((attr) => (
                      <span
                        key={attr}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          background: 'color-mix(in srgb, var(--shell-primary, #3b82f6) 12%, var(--glb-surface, #ffffff))',
                          color: 'var(--shell-primary, #2563eb)',
                          border: '1px solid color-mix(in srgb, var(--shell-primary, #3b82f6) 28%, var(--shell-border, rgba(0,0,0,0.08)))',
                          padding: '0.3rem 0.65rem',
                          borderRadius: '6px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                        }}
                      >
                        <Tag size={13} />
                        <span>{attr}</span>
                        <span
                          title={`${attributeTypeLabel(attr)} · ${attributeRoleLabel(attr, index + 1)}`}
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0 0.35rem',
                            borderRadius: '4px',
                            background:
                              attributeRoleLabel(attr, index + 1) === 'Descriptivo'
                                ? 'color-mix(in srgb, #f59e0b 20%, transparent)'
                                : 'color-mix(in srgb, #10b981 18%, transparent)',
                            color: attributeRoleLabel(attr, index + 1) === 'Descriptivo' ? '#b45309' : '#059669',
                          }}
                        >
                          {attributeRoleLabel(attr, index + 1)}
                        </span>
                        {!disabled && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAttribute(index, attr)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'inherit',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              marginLeft: '0.2rem',
                            }}
                            title={`Remover ${attr}`}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </span>
                    ))
                  )}
                </div>

                {/* Ejes que comparten fotos (solo con alcance "Compartidas por grupo") */}
                {lvl.photoScope === 'group' && (() => {
                  const groupOptions = Array.from(
                    new Set([
                      ...(lvl.hasColor ? ['Color'] : []),
                      ...lvl.attributes.map((a) => a.trim()).filter(Boolean),
                    ])
                  )
                  const selected = lvl.photoGroupBy ?? []
                  return (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.45rem',
                        padding: '0.7rem 0.8rem',
                        borderRadius: '8px',
                        border: '1px dashed color-mix(in srgb, #7c3aed 32%, var(--shell-border, rgba(0,0,0,0.08)))',
                        background: 'color-mix(in srgb, #7c3aed 5%, var(--glb-surface, #ffffff))',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: 'var(--glb-text)',
                        }}
                      >
                        <Camera size={14} color="#7c3aed" />
                        Agrupar fotos por:
                      </span>
                      {groupOptions.length === 0 ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
                          Agrega atributos a este nivel (o activa color) para elegir los ejes que comparten fotos.
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          {groupOptions.map((attr) => {
                            const active = selected.some(
                              (s) => s.trim().toLowerCase() === attr.trim().toLowerCase()
                            )
                            return (
                              <button
                                key={attr}
                                type="button"
                                disabled={disabled}
                                onClick={() => {
                                  const next = active
                                    ? selected.filter((s) => s.trim().toLowerCase() !== attr.trim().toLowerCase())
                                    : [...selected, attr.trim()]
                                  handleUpdateLevel(index, { photoGroupBy: next })
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.28rem 0.6rem',
                                  borderRadius: '6px',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  cursor: disabled ? 'not-allowed' : 'pointer',
                                  border: active
                                    ? '1px solid color-mix(in srgb, #7c3aed 45%, transparent)'
                                    : '1px solid var(--shell-border, rgba(0,0,0,0.12))',
                                  background: active
                                    ? 'color-mix(in srgb, #7c3aed 16%, var(--glb-surface, #ffffff))'
                                    : 'var(--glb-surface, #ffffff)',
                                  color: active ? '#6d28d9' : 'var(--glb-text)',
                                }}
                                title={active ? `Quitar «${attr}» del grupo de fotos` : `Compartir fotos por «${attr}»`}
                              >
                                {active ? <Check size={12} /> : <Plus size={11} />}
                                <span>{attr}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                      <span style={{ fontSize: '0.72rem', color: 'var(--glb-muted)' }}>
                        {selected.length === 0
                          ? 'Automático: se agrupan todos los ejes que no sean tallas o medidas.'
                          : `Las tallas comparten la foto de cada combinación de: ${selected.join(' + ')}.`}
                      </span>
                    </div>
                  )
                })()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Level Action */}
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={handleAddLevel}
          style={{ width: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          <Plus size={18} />
          <span>Agregar Siguiente Nivel a la Jerarquía</span>
        </Button>
      </div>

      {/* Visual Whiteboard / Mindmap Interactive Preview */}
      <div
        style={{
          borderRadius: '12px',
          border: '1px solid var(--shell-border, rgba(255,255,255,0.12))',
          background: 'var(--shell-surface-subtle, rgba(255,255,255,0.02))',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={18} color="var(--shell-primary, #3b82f6)" />
            <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--glb-text)' }}>
              Diagrama Visual de Jerarquía (Vista Pizarra)
            </h5>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <button
              type="button"
              onClick={() => setPreviewMode('board')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                border: previewMode === 'board'
                  ? '1px solid var(--shell-primary, #3b82f6)'
                  : '1px solid var(--shell-border, rgba(255,255,255,0.1))',
                background: previewMode === 'board'
                  ? 'rgba(59, 130, 246, 0.15)'
                  : 'transparent',
                color: previewMode === 'board' ? 'var(--shell-primary, #60a5fa)' : 'var(--glb-muted)',
                cursor: 'pointer',
              }}
            >
              <Workflow size={14} />
              <span>Diagrama de Nodos</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('tree')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                border: previewMode === 'tree'
                  ? '1px solid var(--shell-primary, #3b82f6)'
                  : '1px solid var(--shell-border, rgba(255,255,255,0.1))',
                background: previewMode === 'tree'
                  ? 'rgba(59, 130, 246, 0.15)'
                  : 'transparent',
                color: previewMode === 'tree' ? 'var(--shell-primary, #60a5fa)' : 'var(--glb-muted)',
                cursor: 'pointer',
              }}
            >
              <LayoutGrid size={14} />
              <span>Lista Anidada</span>
            </button>
          </div>
        </div>

        {previewMode === 'board' ? (
          /* Blueprint / Whiteboard Mindmap Canvas */
          <div
            style={{
              borderRadius: '10px',
              border: '1px dashed var(--shell-border, rgba(255,255,255,0.15))',
              background: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            {/* Connected Node Chain */}
            <div
              style={{
                display: 'flex',
                alignItems: 'stretch',
                flexWrap: 'nowrap',
                overflowX: 'auto',
                gap: '0.75rem',
                paddingBottom: '0.5rem',
              }}
            >
              {levels.map((lvl, index) => {
                const isLast = index === levels.length - 1
                const nodeIcon =
                  index === 0 ? (
                    <Layers size={18} color="var(--shell-primary, #3b82f6)" />
                  ) : isLast ? (
                    <Sparkles size={18} color="#10b981" />
                  ) : (
                    <GitFork size={18} color="#a78bfa" />
                  )

                return (
                  <div
                    key={lvl.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      flex: '0 0 auto',
                      minWidth: 200,
                      maxWidth: 240,
                    }}
                  >
                    {/* Node Card */}
                    <div
                      style={{
                        flex: 1,
                        borderRadius: '10px',
                        border: `1px solid ${
                          isLast
                            ? 'rgba(16, 185, 129, 0.5)'
                            : 'var(--shell-border, rgba(255,255,255,0.12))'
                        }`,
                        background: isLast
                          ? 'color-mix(in srgb, #10b981 6%, var(--glb-surface, #1e222d))'
                          : 'var(--glb-surface, #1e222d)',
                        padding: '0.85rem 1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {nodeIcon}
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--glb-muted)' }}>
                            NIVEL {index + 1}
                          </span>
                        </div>
                        {isLast && (
                          <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
                            SKUs / Variantes
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--glb-text)' }}>
                        {lvl.name || `Nivel ${index + 1}`}
                      </div>

                      {/* Capabilities pills */}
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {lvl.hasColor && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              fontSize: '0.68rem',
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                            }}
                          >
                            <Palette size={11} />
                            <span>Color</span>
                          </span>
                        )}
                        {photoScopeOf(lvl) !== 'none' && (
                          <span
                            title="Alcance de captura fotográfica"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              fontSize: '0.68rem',
                              background: 'rgba(139, 92, 246, 0.15)',
                              color: '#a78bfa',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                            }}
                          >
                            <Camera size={11} />
                            <span>{photoScopeLabel(photoScopeOf(lvl))}</span>
                          </span>
                        )}
                      </div>

                      {/* Attributes list */}
                      {lvl.attributes.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                          {lvl.attributes.map((a) => (
                            <span
                              key={a}
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.1rem 0.35rem',
                                borderRadius: '3px',
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: 'var(--shell-primary, #60a5fa)',
                              }}
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Connector Arrow */}
                    {!isLast && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--shell-primary, #3b82f6)',
                          fontSize: '1.2rem',
                          fontWeight: 700,
                          opacity: 0.7,
                        }}
                      >
                        ➔
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Live Catalog Branching Simulation Box (Matching User Whiteboard) */}
            <div
              style={{
                borderRadius: '10px',
                border: '1px solid color-mix(in srgb, var(--shell-primary, #3b82f6) 20%, var(--shell-border, rgba(0,0,0,0.08)))',
                background: 'color-mix(in srgb, var(--shell-primary, #3b82f6) 3%, var(--glb-surface, #ffffff))',
                padding: '1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 600, color: 'var(--glb-muted)' }}>
                <Workflow size={14} color="var(--shell-primary, #3b82f6)" />
                <span>Simulación de Desglose en Catálogo:</span>
              </div>

              <div style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--glb-text)', lineHeight: 1.6 }}>
                {levels.map((lvl, index) => {
                  const isLast = index === levels.length - 1
                  const indent = index * 20
                  const attrs = lvl.attributes

                  return (
                    <div key={lvl.id} style={{ paddingLeft: indent }}>
                      <span style={{ color: isLast ? '#10b981' : '#60a5fa', fontWeight: 600 }}>
                        {isLast ? '└── ' : '├── '}
                        [ {lvl.name || `Nivel ${index + 1}`} ]
                      </span>
                      {attrs.length > 0 && (
                        <span style={{ color: 'var(--glb-muted)' }}>
                          {' '}
                          {attrs.map((a) => `${a} (${attributeRoleLabel(a, index + 1)})`).join(' · ')}
                        </span>
                      )}
                      {isLast && (
                        <div style={{ paddingLeft: '1.5rem', color: '#10b981' }}>
                          └── SKUs por combinación:{' '}
                          {axisFieldNames.length > 0
                            ? axisFieldNames.join(' × ')
                            : 'sin ejes definidos (se usará la dimensión por defecto)'}
                        </div>
                      )}
                    </div>
                  )
                })}
                <div style={{ marginTop: '0.35rem', color: 'var(--glb-muted)' }}>
                  Fotos:{' '}
                  {effectivePhotoScope === 'model'
                    ? 'se capturan una vez en el modelo y todas las variantes las heredan'
                    : effectivePhotoScope === 'group'
                      ? 'se capturan por grupo (color/caña) y las tallas del grupo las heredan'
                      : 'se capturan por cada variante/SKU'}
                </div>
                <div style={{ marginTop: '0.2rem', color: 'var(--glb-muted)' }}>
                  Regla: las variantes/SKU nacen de los <strong>ejes físicos</strong> (tallas, caña, color) y de
                  los colores; los demás niveles son ficha del modelo.
                  {levels.length > 3 && ' Recomendado: 2–3 niveles.'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Nested Tree View */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '0.5rem' }}>
            {levels.map((lvl, index) => {
              const indent = index * 24
              return (
                <div
                  key={lvl.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    paddingLeft: `${indent}px`,
                    position: 'relative',
                  }}
                >
                  {index > 0 && (
                    <div
                      style={{
                        width: '16px',
                        height: '1px',
                        background: 'var(--shell-border, rgba(255,255,255,0.2))',
                      }}
                    />
                  )}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '8px',
                      background: 'var(--glb-surface, #232733)',
                      border: '1px solid var(--shell-border, rgba(255,255,255,0.1))',
                      fontSize: '0.85rem',
                      color: 'var(--glb-text)',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{lvl.name || `Nivel ${index + 1}`}</span>

                    {lvl.hasColor && (
                      <span
                        title="Tiene Colores"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          fontSize: '0.7rem',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                        }}
                      >
                        <Palette size={12} />
                        <span>Color</span>
                      </span>
                    )}

                    {photoScopeOf(lvl) !== 'none' && (
                      <span
                        title="Alcance de captura fotográfica"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          fontSize: '0.7rem',
                          background: 'rgba(139, 92, 246, 0.15)',
                          color: '#a78bfa',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                        }}
                      >
                        <Camera size={12} />
                        <span>{photoScopeLabel(photoScopeOf(lvl))}</span>
                      </span>
                    )}

                    {lvl.attributes.length > 0 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
                        ({lvl.attributes.join(', ')})
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
