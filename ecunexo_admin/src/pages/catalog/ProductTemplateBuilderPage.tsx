import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, TextBox, useToast } from 'glubox'
import { ArrowLeft, Save, Sparkles } from 'lucide-react'
import { PageHeader, SectionCard } from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import {
  createProductTemplate,
  getProductTemplateById,
  listVariantDimensionTemplates,
  updateProductTemplate,
} from '@/services/catalogApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type {
  ProductTemplateLevel,
  VariantDimensionTemplateDto,
} from '@/types/catalogApi'
import { HierarchyTemplateTreeBuilder } from './HierarchyTemplateTreeBuilder'

const DEFAULT_LEVELS: ProductTemplateLevel[] = [
  {
    id: 'lvl-1',
    name: 'Colección / Familia',
    hasColor: false,
    hasImages: false,
    attributes: [],
  },
  {
    id: 'lvl-2',
    name: 'Modelo / Estilo',
    hasColor: false,
    hasImages: true,
    attributes: [],
  },
  {
    id: 'lvl-3',
    name: 'Variantes Físicas',
    hasColor: true,
    hasImages: true,
    attributes: [],
  },
]

export function ProductTemplateBuilderPage() {
  const { templateId } = useParams<{ templateId?: string }>()
  const isEdit = Boolean(templateId)
  const navigate = useNavigate()
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)

  const canManage = useHasPermission('catalog.item.create') || useHasPermission('catalog.scale.manage')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [levels, setLevels] = useState<ProductTemplateLevel[]>(DEFAULT_LEVELS)

  const [availableAttributes, setAvailableAttributes] = useState<VariantDimensionTemplateDto[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const applySocksPreset = (type: 'deportiva' | 'diseno' | 'packs') => {
    if (type === 'deportiva') {
      setName('Calcetines Deportivos por Caña & Actividad')
      setDescription('Arquetipo para calcetines deportivos (Nike NIK-001, Adidas ADI-001) con atributos base (Marca, Material, Tipo, Talla, Color) y variantes físicas por Caña (Corta, Mediana, Larga), Actividad, Foto y Tags.')
      setLevels([
        {
          id: 'lvl-socks-dep-1',
          name: 'Modelo Matriz (Comercial)',
          hasColor: true,
          hasImages: false,
          attributes: ['Marca', 'Material', 'Tipo', 'Talla'],
        },
        {
          id: 'lvl-socks-dep-2',
          name: 'Variantes Físicas (Caña & Actividad)',
          hasColor: false,
          hasImages: true,
          attributes: ['Caña', 'Actividad'],
        },
      ])
      toast.show({
        title: 'Preset cargado',
        message: 'Estructura exacta del diagrama de Calcetines Deportivos aplicada.',
        variant: 'success',
      })
    } else if (type === 'diseno') {
      setName('Calcetines de Colección & Diseño Urbano')
      setDescription('Arquetipo para calcetines temáticos, estampados y líneas urbanas (Guayaca) con variantes de diseño y talla.')
      setLevels([
        {
          id: 'lvl-socks-dis-1',
          name: 'Colección Temática',
          hasColor: false,
          hasImages: false,
          attributes: ['Colección', 'Composición', 'Género'],
        },
        {
          id: 'lvl-socks-dis-2',
          name: 'Diseño & Gráfico',
          hasColor: false,
          hasImages: true,
          attributes: ['Modelo', 'Estilo'],
        },
        {
          id: 'lvl-socks-dis-3',
          name: 'Variantes Físicas',
          hasColor: true,
          hasImages: true,
          attributes: ['Talla'],
        },
      ])
      toast.show({
        title: 'Preset cargado',
        message: 'Estructura de Calcetines de Diseño aplicada con éxito.',
        variant: 'success',
      })
    } else if (type === 'packs') {
      setName('Packs & Boxes de Calcetines')
      setDescription('Arquetipo para cajas de regalo, packs de 3/6 pares (BOX001) y surtidos multipack.')
      setLevels([
        {
          id: 'lvl-socks-pck-1',
          name: 'Presentación & Formato',
          hasColor: false,
          hasImages: true,
          attributes: ['Cantidad de Pares', 'Tipo de Empaque', 'Surtido'],
        },
        {
          id: 'lvl-socks-pck-2',
          name: 'Variantes Físicas',
          hasColor: true,
          hasImages: true,
          attributes: ['Talla'],
        },
      ])
      toast.show({
        title: 'Preset cargado',
        message: 'Estructura de Packs & Boxes aplicada con éxito.',
        variant: 'success',
      })
    }
  }

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const attrs = await listVariantDimensionTemplates(tenantId)
      setAvailableAttributes(attrs)

      if (isEdit && templateId) {
        const tpl = await getProductTemplateById(tenantId, templateId)
        setName(tpl.name)
        setDescription(tpl.description ?? '')
        setIsActive(tpl.isActive)

        try {
          const parsed = JSON.parse(tpl.hierarchyTreeJson)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setLevels(parsed)
          }
        } catch {
          // Keep defaults if parse error
        }
      }
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudo cargar la información de la plantilla.')
      toast.show({ title: 'Error', message, variant: 'error' })
      if (isEdit) {
        navigate('/catalogo/plantillas')
      }
    } finally {
      setLoading(false)
    }
  }, [tenantId, isEdit, templateId, toast, navigate])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!tenantId) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.show({
        title: 'Validación',
        message: 'El nombre de la plantilla es obligatorio.',
        variant: 'warning',
      })
      return
    }

    if (levels.length === 0) {
      toast.show({
        title: 'Validación',
        message: 'Debes definir al menos un nivel en la jerarquía.',
        variant: 'warning',
      })
      return
    }

    for (let i = 0; i < levels.length; i++) {
      if (!levels[i].name.trim()) {
        toast.show({
          title: 'Validación',
          message: `El nivel #${i + 1} no tiene un nombre asignado.`,
          variant: 'warning',
        })
        return
      }
    }

    setSaving(true)
    try {
      const hierarchyTreeJson = JSON.stringify(levels)

      if (isEdit && templateId) {
        await updateProductTemplate(tenantId, templateId, {
          name: trimmedName,
          description: description.trim() || null,
          hierarchyTreeJson,
          isActive,
        })
        toast.show({
          title: 'Plantilla Guardada',
          message: `La plantilla «${trimmedName}» se ha actualizado correctamente.`,
          variant: 'success',
        })
      } else {
        await createProductTemplate(tenantId, {
          name: trimmedName,
          description: description.trim() || null,
          hierarchyTreeJson,
          isActive,
        })
        toast.show({
          title: 'Plantilla Creada',
          message: `La plantilla «${trimmedName}» se ha creado con éxito.`,
          variant: 'success',
        })
      }
      navigate('/catalogo/plantillas')
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudo guardar la plantilla.')
      toast.show({ title: 'Error al Guardar', message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <TenantSessionGate
      title="Plantilla de Producto"
      lead="Configuración de arquetipos y niveles."
    >
      <div className="ecu-dashboard-layout ecu-dashboard-layout--fluid">
        <PageHeader
          title={isEdit ? 'Editar Plantilla de Producto' : 'Nueva Plantilla de Producto'}
          subtitle="Configura los niveles de agrupación (familias, submodelos y variantes físicas con colores y fotos) para reutilizar en tus productos."
          actions={
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/catalogo/plantillas')}
                disabled={saving}
              >
                <ArrowLeft size={16} />
                <span>Volver</span>
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={(e) => void handleSubmit(e)}
                disabled={saving || loading || !canManage}
              >
                <Save size={16} />
                <span>{saving ? 'Guardando...' : 'Guardar Plantilla'}</span>
              </Button>
            </div>
          }
        />

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
          {!isEdit && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap',
                padding: '0.85rem 1.25rem',
                borderRadius: '0.75rem',
                border: '1px solid color-mix(in srgb, var(--shell-primary, #4f46e5) 25%, var(--shell-border, rgba(255, 255, 255, 0.1)))',
                backgroundColor: 'color-mix(in srgb, var(--shell-primary, #4f46e5) 4%, var(--glb-surface, transparent))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Sparkles size={18} style={{ color: 'var(--shell-primary, #4f46e5)' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                  Presets Especializados para Calcetines:
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applySocksPreset('deportiva')}
                  disabled={saving || loading}
                >
                  Deportiva & Técnica (3N)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applySocksPreset('diseno')}
                  disabled={saving || loading}
                >
                  Diseño & Urbana / Guayaca (3N)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applySocksPreset('packs')}
                  disabled={saving || loading}
                >
                  Packs & Boxes (2N)
                </Button>
              </div>
            </div>
          )}

          {/* General Information Section */}
          <SectionCard title="Datos Principales de la Plantilla">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.25rem',
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    marginBottom: '0.4rem',
                    color: 'var(--glb-text)',
                  }}
                >
                  Nombre de la Plantilla *
                </label>
                <TextBox
                  variant="outline"
                  value={name}
                  placeholder="Ej. Arquetipo Calcetines & Deportivo, Camisetas..."
                  disabled={saving || loading || !canManage}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  fullWidth
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    marginBottom: '0.4rem',
                    color: 'var(--glb-text)',
                  }}
                >
                  Descripción / Propósito del Arquetipo
                </label>
                <TextBox
                  variant="outline"
                  value={description}
                  placeholder="Explica qué líneas de producto o tipos de catálogo usan esta plantilla..."
                  disabled={saving || loading || !canManage}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                  fullWidth
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', paddingTop: '1.5rem' }}>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    cursor: saving || loading || !canManage ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    color: 'var(--glb-text)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    disabled={saving || loading || !canManage}
                    onChange={(e) => setIsActive(e.target.checked)}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                  <span>Plantilla activa y disponible para nuevos productos</span>
                </label>
              </div>
            </div>
          </SectionCard>

          {/* Hierarchical Builder Section */}
          <SectionCard title="Configuración de Niveles Jerárquicos">
            <HierarchyTemplateTreeBuilder
              levels={levels}
              onChange={setLevels}
              availableAttributes={availableAttributes}
              disabled={saving || loading || !canManage}
            />
          </SectionCard>
        </form>
      </div>
    </TenantSessionGate>
  )
}
