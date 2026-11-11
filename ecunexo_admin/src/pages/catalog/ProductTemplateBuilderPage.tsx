import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Popup, Select, TextArea, TextBox, useToast } from 'glubox'
import { ArrowLeft, Plus, Save, X } from 'lucide-react'
import { PageHeader, SectionCard } from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { useCatalogLimits } from '@/hooks/useCatalogLimits'
import { readApiError } from '@/lib/readApiError'
import {
  createProductTemplate,
  createVariantDimensionTemplate,
  getProductTemplateById,
  listProductTemplates,
  listVariantDimensionTemplates,
  updateProductTemplate,
} from '@/services/catalogApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type {
  ProductTemplateLevel,
  VariantDimensionTemplateDto,
} from '@/types/catalogApi'
import { buildDimensionValuesMap, normalizeTemplateLevels } from '@/lib/catalogArchetype'
import {
  ensureSystemBaseAttributesLoaded,
  findConflictingSystemBaseItemAttribute,
  getTemplateDictionaryAttributes,
  isSystemBaseItemFieldKey,
} from '@/lib/catalogBaseAttributes'
import {
  ATTRIBUTE_KINDS,
  type AttributeKind,
} from '@/pages/catalog/CatalogAttributesListPage'
import {
  HierarchyTemplateTreeBuilder,
  type CreateAttributeTarget,
} from './HierarchyTemplateTreeBuilder'

const EMPTY_LEVEL: ProductTemplateLevel = {
  id: 'lvl-1',
  name: '',
  hasColor: false,
  hasImages: false,
  attributes: [],
  axes: [],
  photoScope: 'none',
}

export function ProductTemplateBuilderPage() {
  const { templateId } = useParams<{ templateId?: string }>()
  const isEdit = Boolean(templateId)
  const navigate = useNavigate()
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)

  const canCreateItems = useHasPermission('catalog.item.create')
  const canManageScales = useHasPermission('catalog.scale.manage')
  const canManageTemplates = useHasPermission('catalog.template.manage')
  const canManage = canCreateItems || canManageScales || canManageTemplates
  const { maxProductTemplates } = useCatalogLimits()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [levels, setLevels] = useState<ProductTemplateLevel[]>([EMPTY_LEVEL])

  const [availableAttributes, setAvailableAttributes] = useState<VariantDimensionTemplateDto[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [attrModalOpen, setAttrModalOpen] = useState(false)
  const [attrTarget, setAttrTarget] = useState<CreateAttributeTarget | null>(null)
  const [attrSaving, setAttrSaving] = useState(false)
  const [attrName, setAttrName] = useState('')
  const [attrKind, setAttrKind] = useState<AttributeKind>('text')
  const [attrUnit, setAttrUnit] = useState('')
  const [attrValues, setAttrValues] = useState<string[]>([])
  const [attrNewValue, setAttrNewValue] = useState('')

  const selectedAttrKind = useMemo(
    () => ATTRIBUTE_KINDS.find((k) => k.value === attrKind) ?? ATTRIBUTE_KINDS[0],
    [attrKind]
  )

  const openCreateAttributeModal = useCallback((target: CreateAttributeTarget) => {
    setAttrTarget(target)
    setAttrName('')
    setAttrKind(target.list === 'axes' ? 'options' : 'text')
    setAttrUnit('')
    setAttrValues([])
    setAttrNewValue('')
    setAttrModalOpen(true)
  }, [])

  const addAttrOption = useCallback(() => {
    const value = attrNewValue.trim()
    if (!value) return
    if (attrValues.some((v) => v.toLowerCase() === value.toLowerCase())) {
      setAttrNewValue('')
      return
    }
    setAttrValues((prev) => [...prev, value])
    setAttrNewValue('')
  }, [attrNewValue, attrValues])

  const handleCreateAttribute = useCallback(async () => {
    if (!tenantId || !attrTarget) return
    const name = attrName.trim()
    if (!name) {
      toast.show({ title: 'Nombre requerido', message: 'Ingresa un nombre para el atributo.', variant: 'warning' })
      return
    }
    const baseConflict = findConflictingSystemBaseItemAttribute(name)
    if (baseConflict) {
      toast.show({
        title: 'Atributo base existente',
        message: `«${baseConflict.name}» ya existe como atributo base del sistema.`,
        variant: 'warning',
      })
      return
    }
    if (selectedAttrKind.requiresPredefinedValues && attrValues.length === 0) {
      toast.show({
        title: 'Opciones requeridas',
        message: `Para «${selectedAttrKind.label}» debes añadir al menos una opción.`,
        variant: 'warning',
      })
      return
    }

    setAttrSaving(true)
    try {
      await createVariantDimensionTemplate(tenantId, {
        name,
        dimensionType: selectedAttrKind.dimensionType,
        predefinedValuesJson: JSON.stringify(attrValues),
        dataType: selectedAttrKind.dataType,
        isVariantAxis: attrTarget.list === 'axes',
        unit: selectedAttrKind.hasUnit && attrUnit.trim() ? attrUnit.trim() : null,
      })
      await ensureSystemBaseAttributesLoaded(tenantId)
      const rawAttrs = await listVariantDimensionTemplates(tenantId)
      const attrs = getTemplateDictionaryAttributes(rawAttrs, tenantId)
      setAvailableAttributes(attrs)

      setLevels((prev) =>
        prev.map((lvl, i) => {
          if (i !== attrTarget.levelIndex) return lvl
          const list = attrTarget.list === 'axes' ? (lvl.axes ?? []) : lvl.attributes
          if (list.some((item) => item.trim().toLowerCase() === name.toLowerCase())) return lvl
          return {
            ...lvl,
            [attrTarget.list]: [...list, name],
          }
        })
      )

      setAttrModalOpen(false)
      setAttrTarget(null)
      toast.show({
        title: 'Atributo creado',
        message: `«${name}» se agregó al diccionario y a este nivel.`,
        variant: 'success',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'Error',
        message: readApiError(err, 'No se pudo crear el atributo.'),
        variant: 'error',
      })
    } finally {
      setAttrSaving(false)
    }
  }, [
    attrName,
    attrTarget,
    attrUnit,
    attrValues,
    selectedAttrKind,
    tenantId,
    toast,
  ])

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      await ensureSystemBaseAttributesLoaded(tenantId)
      const rawAttrs = await listVariantDimensionTemplates(tenantId)
      const attrs = getTemplateDictionaryAttributes(rawAttrs, tenantId)
      setAvailableAttributes(attrs)

      if (isEdit && templateId) {
        const tpl = await getProductTemplateById(tenantId, templateId)
        setName(tpl.name)
        setDescription(tpl.description ?? '')
        setIsActive(tpl.isActive)

        try {
          const parsed = JSON.parse(tpl.hierarchyTreeJson)
          if (Array.isArray(parsed) && parsed.length > 0) {
            const normalized = normalizeTemplateLevels(parsed, buildDimensionValuesMap(attrs)).map(
              (lvl) => ({
                ...lvl,
                attributes: (lvl.attributes ?? []).filter(
                  (attr) => !isSystemBaseItemFieldKey(attr)
                ),
              })
            )
            setLevels(normalized)
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

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault()
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

    if (!isEdit && maxProductTemplates != null) {
      try {
        const existing = await listProductTemplates(tenantId)
        if (existing.length >= maxProductTemplates) {
          toast.show({
            title: 'Límite del plan alcanzado',
            message: `Tu plan permite hasta ${maxProductTemplates} plantillas de producto. Elimina alguna o actualiza tu plan para crear más.`,
            variant: 'warning',
          })
          void navigate('/catalogo/plantillas')
          return
        }
      } catch {
        // Ante error de consulta, el backend validará el límite al guardar
      }
    }

    setSaving(true)
    try {
      const cleanedLevels = levels.map((level) => ({
        ...level,
        attributes: level.attributes.filter((current) => !isSystemBaseItemFieldKey(current)),
      }))
      const hierarchyTreeJson = JSON.stringify(cleanedLevels)
      const payload = {
        name: trimmedName,
        description: description.trim() || null,
        hierarchyTreeJson,
        isActive,
      }

      if (isEdit && templateId) {
        await updateProductTemplate(tenantId, templateId, payload)
        toast.show({
          title: 'Plantilla Guardada',
          message: `La plantilla «${trimmedName}» se ha actualizado correctamente.`,
          variant: 'success',
        })
      } else {
        await createProductTemplate(tenantId, payload)
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
      title="Plantilla de producto"
      lead="Niveles, datos y variaciones de un tipo de producto."
    >
      <div className="ecu-dashboard-layout ecu-section-page ecu-dashboard-layout--fluid">
        <PageHeader
          title={isEdit ? 'Editar plantilla' : 'Nueva plantilla'}
          info="Arma los niveles, los datos y las variaciones de este tipo de producto."
        />

        <form className="ecu-companies-form" onSubmit={handleSubmit} style={{ marginTop: '0.75rem' }}>
          {/* General Information Section */}
          <SectionCard title="Nombre de la plantilla" info="Así la vas a reconocer al crear un producto.">
            <div className="ecu-companies-form__grid ecu-companies-form__grid--dynamic">
              <div className="ecu-companies-form__field">
                <TextBox
                  id="pt-name"
                  label="Nombre"
                  labelPosition="outlined"
                  variant="outline"
                  value={name}
                  placeholder="Ej. Calzado & Textil, Electrónica…"
                  disabled={saving || loading || !canManage}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field ecu-companies-form__field--wide">
                <TextArea
                  id="pt-description"
                  label="Descripción"
                  labelPosition="outlined"
                  variant="outline"
                  value={description}
                  placeholder="Ej. Calcetines, camisas, aceites…"
                  disabled={saving || loading || !canManage}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field ecu-companies-form__field--wide ecu-companies-form__field--check-align">
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
          <SectionCard
            title="Jerarquía del producto"
            info="Agrega los peldaños que necesite este tipo de producto. En cada uno, separa los datos de los ejes."
          >
            <HierarchyTemplateTreeBuilder
              levels={levels}
              onChange={setLevels}
              availableAttributes={availableAttributes}
              disabled={saving || loading || !canManage}
              onRequestCreateAttribute={openCreateAttributeModal}
            />
          </SectionCard>

          <div className="ecu-companies-form__actions" style={{ gap: '0.5rem' }}>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/catalogo/plantillas')}
              disabled={saving}
              iconLeft={<ArrowLeft size={16} />}
              style={{ minWidth: 'auto', width: 'auto' }}
            >
              Volver
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={saving || loading || !canManage}
              iconLeft={<Save size={16} />}
              style={{ minWidth: 'auto', width: 'auto' }}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>

        <Popup
          open={attrModalOpen}
          onClose={() => {
            if (!attrSaving) {
              setAttrModalOpen(false)
              setAttrTarget(null)
            }
          }}
          title="Nuevo atributo"
          width={520}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.25rem 0' }}>
            <TextBox
              id="pt-attr-name"
              label="Nombre"
              labelPosition="outlined"
              variant="outline"
              placeholder="Escriba aquí..."
              value={attrName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAttrName(e.target.value)}
              disabled={attrSaving}
              fullWidth
            />
            <Select
              id="pt-attr-kind"
              label="Tipo de atributo"
              labelPosition="outlined"
              variant="outline"
              options={ATTRIBUTE_KINDS.map((k) => ({ value: k.value, label: k.label }))}
              value={attrKind}
              onChange={(v: string) => setAttrKind(v as AttributeKind)}
              disabled={attrSaving}
              fullWidth
            />
            <span style={{ marginTop: '-0.35rem', fontSize: '0.75rem', color: 'var(--glb-muted, #64748b)' }}>
              {selectedAttrKind.description}
            </span>
            {selectedAttrKind.hasUnit ? (
              <TextBox
                id="pt-attr-unit"
                label="Unidad"
                labelPosition="outlined"
                variant="outline"
                placeholder="Ej. cm, kg…"
                value={attrUnit}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setAttrUnit(e.target.value)}
                disabled={attrSaving}
                fullWidth
              />
            ) : null}
            {selectedAttrKind.allowsPredefinedValues ? (
              <div>
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  <TextBox
                    id="pt-attr-new-value"
                    label="Opciones"
                    labelPosition="outlined"
                    variant="outline"
                    placeholder="Escriba aquí..."
                    value={attrNewValue}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setAttrNewValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addAttrOption()
                      }
                    }}
                    disabled={attrSaving}
                    fullWidth
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addAttrOption}
                    disabled={attrSaving || !attrNewValue.trim()}
                    style={{
                      width: 36,
                      height: 36,
                      minWidth: 36,
                      padding: 0,
                      borderRadius: '999px',
                      flexShrink: 0,
                      marginTop: '0.35rem',
                    }}
                    aria-label="Añadir opción"
                  >
                    <Plus size={16} strokeWidth={2} aria-hidden />
                  </Button>
                </div>
                {attrValues.length === 0 ? (
                  <span style={{ fontSize: '0.78rem', color: 'var(--glb-muted, #64748b)' }}>
                    Sin opciones agregadas
                  </span>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {attrValues.map((val) => (
                      <span
                        key={val}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.78rem',
                          fontWeight: 500,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '12px',
                          background: 'var(--glb-surface, #fff)',
                          border: '1px solid var(--shell-border, rgba(0, 0, 0, 0.15))',
                        }}
                      >
                        {val}
                        <button
                          type="button"
                          disabled={attrSaving}
                          onClick={() => setAttrValues((prev) => prev.filter((v) => v !== val))}
                          aria-label={`Quitar ${val}`}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex' }}
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            <div className="ecu-companies-form__actions" style={{ gap: '0.5rem' }}>
              <Button
                type="button"
                variant="outline"
                disabled={attrSaving}
                onClick={() => {
                  setAttrModalOpen(false)
                  setAttrTarget(null)
                }}
                style={{ minWidth: 'auto', width: 'auto' }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={attrSaving}
                onClick={() => void handleCreateAttribute()}
                style={{ minWidth: 'auto', width: 'auto' }}
              >
                {attrSaving ? 'Guardando…' : 'Crear atributo'}
              </Button>
            </div>
          </div>
        </Popup>
      </div>
    </TenantSessionGate>
  )
}
