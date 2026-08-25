import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, TextBox, useToast, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { Package } from 'lucide-react'
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
        <div className="ecu-companies-page">
          <p className="app-shell__page-lead">Requieres catalog.item.create para crear ítems.</p>
          <Button type="button" variant="outline" onClick={goToList}>
            Volver al listado
          </Button>
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Nuevo ítem" lead="Alta en el maestro de catálogo (sin stock).">
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <p className="app-shell__page-lead">
            Elige servicio para captar clientes sin inventario, o físico si ya manejas SKU.
          </p>
          <EcuPageActions
            items={actionItems}
            variant="outline"
            triggerLabel="Acciones de crear ítem"
            renderIcon={renderSidebarIcon}
            onNavigate={(route: string) => navigate(route)}
          />
        </div>

        {error ? (
          <p className="welcome-onboarding__error" role="alert">
            {error}
          </p>
        ) : null}

        <form className="ecu-companies-form" onSubmit={(e) => void onSubmit(e)} noValidate>
          <section className="app-shell__card ecu-companies-form__card">
            <h2 className="app-shell__section-title">
              <Package size={18} strokeWidth={1.75} aria-hidden /> Ítem
            </h2>
            <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
              <div className="ecu-companies-form__field">
                <Select
                  id="ci-kind"
                  label="Tipo"
                  labelPosition="outlined"
                  variant="outline"
                  options={[
                    { value: String(CatalogItemKind.Service), label: 'Servicio' },
                    { value: String(CatalogItemKind.Physical), label: 'Físico' },
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
                  label="Nombre"
                  labelPosition="outlined"
                  variant="outline"
                  value={name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  required
                  disabled={busy}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <TextBox
                  id="ci-sku"
                  label={kind === String(CatalogItemKind.Physical) ? 'SKU' : 'SKU (opcional)'}
                  labelPosition="outlined"
                  variant="outline"
                  value={sku}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setSku(e.target.value.toUpperCase())
                  }
                  required={kind === String(CatalogItemKind.Physical)}
                  disabled={busy}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <TextBox
                  id="ci-price"
                  label="Precio base"
                  labelPosition="outlined"
                  variant="outline"
                  value={basePrice}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setBasePrice(e.target.value)}
                  disabled={busy}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <TextBox
                  id="ci-desc"
                  label="Descripción"
                  labelPosition="outlined"
                  variant="outline"
                  value={description}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
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
          </section>

          <div className="ecu-companies-form__actions">
            <Button type="submit" variant="primary" loading={busy} disabled={busy}>
              Guardar
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={goToList}>
              Atrás
            </Button>
          </div>
        </form>
      </div>
    </TenantSessionGate>
  )
}
