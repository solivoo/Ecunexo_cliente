import { useState, type ChangeEvent } from 'react'
import { Button, Select, TextBox } from 'glubox'
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Layers,
  Palette,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import type {
  ProductTemplateLevel,
  VariantDimensionTemplateDto,
} from '@/types/catalogApi'

export interface HierarchyTemplateTreeBuilderProps {
  levels: ProductTemplateLevel[]
  onChange: (levels: ProductTemplateLevel[]) => void
  availableAttributes: VariantDimensionTemplateDto[]
  disabled?: boolean
}

export function HierarchyTemplateTreeBuilder({
  levels,
  onChange,
  availableAttributes,
  disabled = false,
}: HierarchyTemplateTreeBuilderProps) {
  const [selectedAttrByLevel, setSelectedAttrByLevel] = useState<Record<string, string>>({})
  const [customAttrInputByLevel, setCustomAttrInputByLevel] = useState<Record<string, string>>({})

  const handleAddLevel = () => {
    const nextIdx = levels.length + 1
    let defaultName = `Nivel ${nextIdx}`
    let hasColor = false
    let hasImages = false

    if (nextIdx === 1) {
      defaultName = 'Colección / Familia'
    } else if (nextIdx === 2) {
      defaultName = 'Modelo / Estilo'
      hasImages = true
    } else if (nextIdx === 3) {
      defaultName = 'Variantes Físicas'
      hasColor = true
      hasImages = true
    }

    const newLevel: ProductTemplateLevel = {
      id: `lvl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: defaultName,
      hasColor,
      hasImages,
      attributes: [],
    }

    onChange([...levels, newLevel])
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
      {/* Visual Header / Guidance */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderRadius: '12px',
          background: 'var(--shell-surface-subtle, rgba(255,255,255,0.03))',
          border: '1px solid var(--shell-border, rgba(255,255,255,0.08))',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            background: 'rgba(59, 130, 246, 0.15)',
            color: 'var(--shell-primary, #3b82f6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Layers size={22} />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--glb-text)' }}>
            Estructura de Niveles y Arquetipos
          </h4>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--glb-muted)' }}>
            Configura la profundidad de niveles para tu catálogo (ej. Colección → Modelo → Tallas con Color y Foto).
            Los niveles son modulares y se adaptan a productos simples (2 niveles) o colecciones complejas.
          </p>
        </div>
      </div>

      {/* Levels list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {levels.map((lvl, index) => {
          const isFirst = index === 0
          const isLast = index === levels.length - 1
          const levelLabel =
            index === 0
              ? 'Nivel 1 (Base / Colección)'
              : index === 1
              ? 'Nivel 2 (Submodelo / Estilo)'
              : `Nivel ${index + 1} (Terminal / Variantes)`

          return (
            <div
              key={lvl.id}
              style={{
                borderRadius: '12px',
                border: '1px solid var(--shell-border, rgba(255,255,255,0.1))',
                background: 'var(--glb-surface, #1e222d)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
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
                    placeholder="Ej. Colección, Estilo, Tallas..."
                    disabled={disabled}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleUpdateLevel(index, { name: e.target.value })
                    }
                    fullWidth
                  />
                </div>

                {/* Toggles Color & Photo */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', paddingTop: '1.25rem' }}>
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
                        : 'var(--shell-surface-subtle, rgba(255,255,255,0.03))',
                      border: `1px solid ${
                        lvl.hasColor ? 'rgba(16, 185, 129, 0.3)' : 'var(--shell-border, rgba(255,255,255,0.08))'
                      }`,
                      color: lvl.hasColor ? '#10b981' : 'var(--glb-text)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={lvl.hasColor}
                      disabled={disabled}
                      onChange={(e) => handleUpdateLevel(index, { hasColor: e.target.checked })}
                      style={{ cursor: 'pointer' }}
                    />
                    <Palette size={16} />
                    <span>Lleva Colores (Paleta / Picker)</span>
                  </label>

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
                      background: lvl.hasImages
                        ? 'rgba(139, 92, 246, 0.12)'
                        : 'var(--shell-surface-subtle, rgba(255,255,255,0.03))',
                      border: `1px solid ${
                        lvl.hasImages ? 'rgba(139, 92, 246, 0.3)' : 'var(--shell-border, rgba(255,255,255,0.08))'
                      }`,
                      color: lvl.hasImages ? '#a78bfa' : 'var(--glb-text)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={lvl.hasImages}
                      disabled={disabled}
                      onChange={(e) => handleUpdateLevel(index, { hasImages: e.target.checked })}
                      style={{ cursor: 'pointer' }}
                    />
                    <Camera size={16} />
                    <span>Fotografías por elemento</span>
                  </label>
                </div>
              </div>

              {/* Attributes Section */}
              <div
                style={{
                  background: 'var(--shell-surface-subtle, rgba(0,0,0,0.15))',
                  borderRadius: '8px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--glb-text)' }}>
                    <Tag size={16} color="var(--shell-primary, #3b82f6)" />
                    <span>Atributos vinculados a este nivel</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
                    Elige atributos del diccionario para evitar nombres duplicados
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
                        placeholder="Seleccionar atributo corporativo..."
                        value={selectedAttrByLevel[lvl.id] ?? ''}
                        disabled={disabled}
                        onChange={(val: string) =>
                          setSelectedAttrByLevel((prev) => ({ ...prev, [lvl.id]: val }))
                        }
                        options={[
                          { value: '', label: 'Seleccionar atributo...' },
                          ...availableAttributes
                            .filter((a) => !lvl.attributes.includes(a.name))
                            .map((a) => ({
                              value: a.name,
                              label: `${a.name} (${a.dimensionType || 'general'})`,
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
                        variant="outline"
                        value={customAttrInputByLevel[lvl.id] ?? ''}
                        placeholder="Ej. Tipo de Caña, Corte..."
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

                {/* Attribute chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                  {lvl.attributes.length === 0 ? (
                    <span style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--glb-muted)' }}>
                      Sin atributos asignados en este nivel (opcional).
                    </span>
                  ) : (
                    lvl.attributes.map((attr) => (
                      <span
                        key={attr}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          background: 'rgba(59, 130, 246, 0.15)',
                          color: 'var(--shell-primary, #60a5fa)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 500,
                        }}
                      >
                        <Tag size={13} />
                        <span>{attr}</span>
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

      {/* Interactive Visual Hierarchy Tree Preview */}
      <div
        style={{
          borderRadius: '12px',
          border: '1px dashed var(--shell-border, rgba(255,255,255,0.15))',
          background: 'var(--shell-surface-subtle, rgba(255,255,255,0.02))',
          padding: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Sparkles size={18} color="var(--shell-primary, #3b82f6)" />
          <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--glb-text)' }}>
            Vista Previa de la Jerarquía Resultante
          </h5>
        </div>

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

                  {lvl.hasImages && (
                    <span
                      title="Tiene Fotografías"
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
                      <span>Foto</span>
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
      </div>
    </div>
  )
}
