import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, TextBox, useToast, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import {
  missingRequiredAttributeLabel,
  parseAttributeSchema,
  serializeAttributeValues,
} from '@/lib/catalogAttributes'
import { CatalogExtraAttributeFields } from '@/pages/catalog/CatalogExtraAttributeFields'
import { readApiError } from '@/lib/readApiError'
import { createCatalogItem, listCatalogCategories } from '@/services/catalogApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import { CatalogItemKind, type CatalogAttributeField, type CategoryListItemDto } from '@/types/catalogApi'

export function CreateCatalogItemPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canCreate = useHasPermission('catalog.item.create')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<CategoryListItemDto[]>([])
  const [kind, setKind] = useState(String(CatalogItemKind.Service))
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sku, setSku] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [attrValues, setAttrValues] = useState<Record<string, string>>({})

  const schemaFields = useMemo<CatalogAttributeField[]>(() => {
    const category = categories.find((c) => c.id === categoryId)
    return parseAttributeSchema(category?.attributeSchemaJson)
  }, [categories, categoryId])

  useEffect(() => {
    if (!tenantId || !canCreate) return
    let cancelled = false
    void (async () => {
      try {
        const list = await listCatalogCategories(tenantId)
        if (!cancelled) setCategories(list)
      } catch {
        if (!cancelled) setCategories([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canCreate, tenantId])

  useEffect(() => {
    setAttrValues({})
  }, [categoryId])

  const goToList = useCallback(() => {
    void navigate('/catalogo/items')
  }, [navigate])

  const actionItems = useMemo<PageActionItem[]>(
    () => [
      {
        id: 'list',
        label: 'Listado de ítems',
        icon: 'package',
        route: '/catalogo/items',
        disabled: false,
      },
      {
        id: 'categories',
        label: 'Categorías',
        icon: 'folder-tree',
        route: '/catalogo/categorias',
        disabled: false,
      },
    ],
    []
  )

  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'Sin categoría' },
      ...categories.map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories]
  )

  const onSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      if (!tenantId) return
      setError(null)
      setBusy(true)
      try {
        if (!name.trim()) throw new Error('El nombre del ítem es obligatorio.')
        const kindNum = Number(kind) as CatalogItemKind
        if (kindNum === CatalogItemKind.Physical && !sku.trim()) {
          throw new Error('El SKU es obligatorio para ítems físicos.')
        }
        const missingAttr = missingRequiredAttributeLabel(schemaFields, attrValues)
        if (missingAttr) {
          throw new Error(`Completa el campo obligatorio «${missingAttr}».`)
        }
        let price: number | null = null
        if (basePrice.trim()) {
          const parsed = Number(basePrice.replace(',', '.'))
          if (Number.isNaN(parsed) || parsed < 0) {
            throw new Error('El precio base no es válido.')
          }
          price = parsed
        }

        await createCatalogItem(tenantId, {
          kind: kindNum,
          name: name.trim(),
          description: description.trim() || null,
          sku: sku.trim() || null,
          basePrice: price,
          categoryId: categoryId || null,
          customAttributesJson: serializeAttributeValues(schemaFields, attrValues),
        })

        toast.show({
          title: 'Ítem creado',
          message: `«${name.trim()}» ya está en el catálogo.`,
          variant: 'success',
        })
        void navigate('/catalogo/items', { replace: true })
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : readApiError(err, 'No se pudo crear el ítem.')
        setError(message)
        toast.show({ title: 'No se pudo crear', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [
      attrValues,
      basePrice,
      categoryId,
      description,
      kind,
      name,
      navigate,
      schemaFields,
      sku,
      tenantId,
      toast,
    ]
  )

  if (!canCreate) {
    return (
      <TenantSessionGate title="Nuevo ítem" lead="Alta en el maestro de catálogo.">
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres catalog.item.create para dar de alta nuevos productos o servicios."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
          <SectionCard title="Permisos insuficientes">
            <p className="app-shell__muted" style={{ marginBottom: '1rem' }}>
              No posees las credenciales requeridas para registrar ítems en el catálogo de esta empresa.
            </p>
            <Button type="button" variant="outline" onClick={goToList}>
              Volver al listado
            </Button>
          </SectionCard>
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Nuevo ítem" lead="Alta en el maestro de catálogo (sin stock).">
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Nuevo Ítem"
          subtitle="Registra un producto físico o servicio intangible. Los productos físicos requieren código SKU para su control en inventario."
          badge={
            <StatusBadge tone="primary" withDot>
              Alta de Ítem
            </StatusBadge>
          }
          actions={
            <EcuPageActions
              items={actionItems}
              variant="outline"
              triggerLabel="Acciones de nuevo ítem"
              renderIcon={renderSidebarIcon}
              onNavigate={(route: string) => navigate(route)}
            />
          }
        />

        <form onSubmit={(e) => void onSubmit(e)} noValidate>
          <SectionCard
            title="Información Comercial del Ítem"
            subtitle="Configura la clasificación comercial, identificación técnica y atributos de molde de categoría"
          >
            {error ? (
              <div className="ecu-form-error-banner" role="alert">
                <span className="material-symbols-outlined">error</span>
                <span>{error}</span>
              </div>
            ) : null}

            <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
              <div className="ecu-companies-form__field">
                <Select
                  id="ci-kind"
                  label="Tipo de ítem"
                  labelPosition="outlined"
                  variant="outline"
                  options={[
                    { value: String(CatalogItemKind.Service), label: 'Servicio (intangible)' },
                    { value: String(CatalogItemKind.Physical), label: 'Físico (con inventario)' },
                  ]}
                  value={kind}
                  onChange={setKind}
                  disabled={busy}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <Select
                  id="ci-cat"
                  label="Categoría"
                  labelPosition="outlined"
                  variant="outline"
                  options={categoryOptions}
                  value={categoryId}
                  onChange={setCategoryId}
                  disabled={busy}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <TextBox
                  id="ci-name"
                  label="Nombre del producto o servicio"
                  labelPosition="outlined"
                  variant="outline"
                  value={name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  placeholder="Ej. Soporte Técnico Mensual"
                  required
                  disabled={busy}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <TextBox
                  id="ci-sku"
                  label={kind === String(CatalogItemKind.Physical) ? 'Código SKU (obligatorio)' : 'Código SKU (opcional)'}
                  labelPosition="outlined"
                  variant="outline"
                  value={sku}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setSku(e.target.value.toUpperCase())
                  }
                  placeholder="PROD-001"
                  required={kind === String(CatalogItemKind.Physical)}
                  disabled={busy}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <TextBox
                  id="ci-price"
                  label="Precio base de venta"
                  labelPosition="outlined"
                  variant="outline"
                  value={basePrice}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setBasePrice(e.target.value)}
                  placeholder="0.00"
                  disabled={busy}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field ecu-companies-form__field--span-3">
                <TextBox
                  id="ci-desc"
                  label="Descripción comercial o especificaciones"
                  labelPosition="outlined"
                  variant="outline"
                  value={description}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                  placeholder="Detalles y características para facturación y reportes…"
                  disabled={busy}
                  fullWidth
                />
              </div>
              <CatalogExtraAttributeFields
                idPrefix="ci"
                fields={schemaFields}
                values={attrValues}
                disabled={busy}
                onChange={(key, next) => setAttrValues((prev) => ({ ...prev, [key]: next }))}
              />
            </div>

            <div
              className="ecu-companies-form__actions"
              style={{
                marginTop: '1.5rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--glb-surface-border, rgba(0, 0, 0, 0.08))',
              }}
            >
              <Button type="submit" variant="primary" loading={busy} disabled={busy}>
                Guardar Ítem
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={goToList}>
                Cancelar
              </Button>
            </div>
          </SectionCard>
        </form>
      </div>
    </TenantSessionGate>
  )
}
