import { useState, type ChangeEvent } from 'react'
import { Button, Select, TextBox } from 'glubox'
import {
  ArrowDown,
  ArrowUp,
  Camera,
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
  Zap,
} from 'lucide-react'
import type {
  ProductTemplateLevel,
  VariantDimensionTemplateDto,
} from '@/types/catalogApi'

export interface TemplatePreset {
  id: string
  label: string
  badge: string
  icon: string
  description: string
  suggestedName: string
  suggestedDescription: string
  levels: ProductTemplateLevel[]
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: 'preset-calceteria',
    label: 'Calcetería & Medias Deportivas',
    badge: '3 Niveles',
    icon: '🧦',
    description: 'Colección (Deportivo/Lisos) → Modelo (Antideslizante/Tennis) → Tallas con Color y Fotos.',
    suggestedName: 'Calcetería & Medias Deportivas (3 Niveles)',
    suggestedDescription: 'Arquetipo para calcetines y medias con modelos técnicos y variantes de talla/color.',
    levels: [
      {
        id: 'lvl-calc-1',
        name: 'Colección / Familia',
        hasColor: false,
        hasImages: false,
        attributes: ['Material', 'Género'],
      },
      {
        id: 'lvl-calc-2',
        name: 'Modelo / Estilo',
        hasColor: false,
        hasImages: true,
        attributes: ['Tipo de Caña'],
      },
      {
        id: 'lvl-calc-3',
        name: 'Variantes Físicas',
        hasColor: true,
        hasImages: true,
        attributes: ['Medias / Calcetines'],
      },
    ],
  },
  {
    id: 'preset-calzado',
    label: 'Calzado & Zapatillas',
    badge: '3 Niveles',
    icon: '👟',
    description: 'Línea de Calzado → Modelo de Suela/Corte → Tallas numéricas (EUR) con ColorPicker y Fotos.',
    suggestedName: 'Calzado Deportivo & Casual (3 Niveles)',
    suggestedDescription: 'Arquetipo para calzado formal o deportivo con fotos de modelo y variaciones de talla y tono.',
    levels: [
      {
        id: 'lvl-calz-1',
        name: 'Línea / Género',
        hasColor: false,
        hasImages: false,
        attributes: ['Material Exterior', 'Suela'],
      },
      {
        id: 'lvl-calz-2',
        name: 'Modelo / Silueta',
        hasColor: false,
        hasImages: true,
        attributes: ['Corte'],
      },
      {
        id: 'lvl-calz-3',
        name: 'Tallas & Colores',
        hasColor: true,
        hasImages: true,
        attributes: ['Calzado Adulto (Ecuador / EUR)'],
      },
    ],
  },
  {
    id: 'preset-confeccion',
    label: 'Prendas & Confección Textil',
    badge: '3 Niveles',
    icon: '👕',
    description: 'Familia/Temporada → Modelo/Corte con Fotos → Tallas en letras (XS-3XL) con ColorPicker y Fotos.',
    suggestedName: 'Confección Textil & Prendas (3 Niveles)',
    suggestedDescription: 'Arquetipo para camisetas, sacos o pantalones con especificación textil y variaciones.',
    levels: [
      {
        id: 'lvl-conf-1',
        name: 'Familia / Temporada',
        hasColor: false,
        hasImages: false,
        attributes: ['Composición', 'Cuidados'],
      },
      {
        id: 'lvl-conf-2',
        name: 'Diseño / Corte',
        hasColor: false,
        hasImages: true,
        attributes: ['Manga', 'Cuello'],
      },
      {
        id: 'lvl-conf-3',
        name: 'Talla & Color',
        hasColor: true,
        hasImages: true,
        attributes: ['Ropa Adulto (Letras)'],
      },
    ],
  },
  {
    id: 'preset-simple',
    label: 'Producto Simple / E-Commerce',
    badge: '2 Niveles',
    icon: '📦',
    description: 'Producto Base → Variantes directas de Color con ColorPicker y Fotografía por SKU.',
    suggestedName: 'Variantes Simples (2 Niveles)',
    suggestedDescription: 'Arquetipo ágil para productos directos con 1 solo nivel de variantes (tazas, gorras, accesorios).',
    levels: [
      {
        id: 'lvl-simp-1',
        name: 'Producto Base',
        hasColor: false,
        hasImages: false,
        attributes: ['Material'],
      },
      {
        id: 'lvl-simp-2',
        name: 'Variantes de Venta',
        hasColor: true,
        hasImages: true,
        attributes: ['Colores Básicos'],
      },
    ],
  },
]

export interface HierarchyTemplateTreeBuilderProps {
  levels: ProductTemplateLevel[]
  onChange: (levels: ProductTemplateLevel[]) => void
  availableAttributes: VariantDimensionTemplateDto[]
  disabled?: boolean
  onApplyPreset?: (preset: {
    levels: ProductTemplateLevel[]
    suggestedName: string
    suggestedDescription: string
  }) => void
}

export function HierarchyTemplateTreeBuilder({
  levels,
  onChange,
  availableAttributes,
  disabled = false,
  onApplyPreset,
}: HierarchyTemplateTreeBuilderProps) {
  const [selectedAttrByLevel, setSelectedAttrByLevel] = useState<Record<string, string>>({})
  const [customAttrInputByLevel, setCustomAttrInputByLevel] = useState<Record<string, string>>({})
  const [previewMode, setPreviewMode] = useState<'board' | 'tree'>('board')
  const [activePresetId, setActivePresetId] = useState<string | null>(null)

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

  const handleDuplicateLevel = (index: number) => {
    const source = levels[index]
    const cloned: ProductTemplateLevel = {
      id: `lvl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: `${source.name} (Copia)`,
      hasColor: source.hasColor,
      hasImages: source.hasImages,
      attributes: [...source.attributes],
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

  const handleTriggerPreset = (preset: TemplatePreset) => {
    setActivePresetId(preset.id)
    if (onApplyPreset) {
      onApplyPreset({
        levels: preset.levels.map((l) => ({
          ...l,
          id: `lvl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        })),
        suggestedName: preset.suggestedName,
        suggestedDescription: preset.suggestedDescription,
      })
    } else {
      onChange(
        preset.levels.map((l) => ({
          ...l,
          id: `lvl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        }))
      )
    }
  }

  return (
    <div className="cat-hierarchy-builder" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 1-Click Quick Presets Starter Strip */}
      <div
        style={{
          borderRadius: '12px',
          border: '1px solid var(--shell-border, rgba(255,255,255,0.1))',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(139,92,246,0.06) 100%)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.2)',
                color: 'var(--shell-primary, #3b82f6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Zap size={18} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--glb-text)' }}>
                Presets de Inicio Rápido (1 Clic)
              </h4>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--glb-muted)' }}>
                Carga la arquitectura recomendada para tu tipo de catálogo y personalízala según tus necesidades.
              </p>
            </div>
          </div>
        </div>

        {/* Preset Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {TEMPLATE_PRESETS.map((preset) => {
            const isSelected = activePresetId === preset.id
            return (
              <div
                key={preset.id}
                onClick={() => !disabled && handleTriggerPreset(preset)}
                style={{
                  borderRadius: '10px',
                  border: isSelected
                    ? '1.5px solid var(--shell-primary, #3b82f6)'
                    : '1px solid var(--shell-border, rgba(255,255,255,0.08))',
                  background: isSelected
                    ? 'rgba(59, 130, 246, 0.12)'
                    : 'var(--glb-surface, #1e222d)',
                  padding: '0.85rem 1rem',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>{preset.icon}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--glb-text)' }}>
                      {preset.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: 'var(--shell-primary, #60a5fa)',
                    }}
                  >
                    {preset.badge}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--glb-muted)', lineHeight: 1.3 }}>
                  {preset.description}
                </p>
                <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--shell-primary, #60a5fa)', fontWeight: 500 }}>
                  <Zap size={13} />
                  <span>Cargar este preset</span>
                </div>
              </div>
            )
          })}
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

          // Atributos sugeridos rápidos para este nivel (excluyendo los ya asignados)
          const suggestedAttributes = availableAttributes
            .filter((a) => !lvl.attributes.includes(a.name))
            .slice(0, 4)

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
                          background: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          color: 'var(--shell-primary, #60a5fa)',
                          borderRadius: '4px',
                          padding: '0.15rem 0.5rem',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
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
                flexWrap: 'wrap',
                gap: '0.75rem',
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
                      flex: '1 1 200px',
                    }}
                  >
                    {/* Node Card */}
                    <div
                      style={{
                        flex: 1,
                        borderRadius: '10px',
                        border: '1px solid var(--shell-border, rgba(255,255,255,0.12))',
                        background: 'var(--glb-surface, #1e222d)',
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
                        {lvl.hasImages && (
                          <span
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
                            <span>Foto</span>
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
                borderRadius: '8px',
                border: '1px solid var(--shell-border, rgba(255,255,255,0.08))',
                background: 'rgba(0,0,0,0.2)',
                padding: '1rem',
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
                <div>
                  <span style={{ color: '#60a5fa', fontWeight: 600 }}>[ {levels[0]?.name || 'Colección'} ]</span>
                  <span style={{ color: 'var(--glb-muted)' }}> (Ej. Deportivo)</span>
                </div>
                {levels.length > 2 && (
                  <div style={{ paddingLeft: '1.25rem' }}>
                    ├── <span style={{ color: '#a78bfa', fontWeight: 600 }}>[ {levels[1]?.name || 'Modelo'} 1 ]</span>
                    <span style={{ color: 'var(--glb-muted)' }}> (Ej. Antideslizante)</span>
                    <div style={{ paddingLeft: '1.75rem', color: '#10b981' }}>
                      └── 📦 Variantes SKUs: Talla + Color + Imagen por combinación
                    </div>
                    ├── <span style={{ color: '#a78bfa', fontWeight: 600 }}>[ {levels[1]?.name || 'Modelo'} 2 ]</span>
                    <span style={{ color: 'var(--glb-muted)' }}> (Ej. Tennis)</span>
                    <div style={{ paddingLeft: '1.75rem', color: '#10b981' }}>
                      └── 📦 Variantes SKUs: Talla + Color + Imagen por combinación
                    </div>
                  </div>
                )}
                {levels.length === 2 && (
                  <div style={{ paddingLeft: '1.25rem' }}>
                    └── <span style={{ color: '#10b981', fontWeight: 600 }}>[ {levels[1]?.name || 'Variantes'} ]</span>
                    <span style={{ color: 'var(--glb-muted)' }}> (Colores, Fotos y Opciones de venta)</span>
                  </div>
                )}
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
        )}
      </div>
    </div>
  )
}
