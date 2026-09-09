import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Select, TextBox, useToast, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { Package } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import {
  missingRequiredAttributeLabel,
  parseAttributeSchema,
  parseAttributeValues,
  serializeAttributeValues,
} from '@/lib/catalogAttributes'
import { CatalogExtraAttributeFields } from '@/pages/catalog/CatalogExtraAttributeFields'
import { readApiError } from '@/lib/readApiError'
import { getCatalogItem, listCatalogCategories, softDeleteCatalogItem, updateCatalogItem } from '@/services/catalogApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  CatalogItemKind,
  CatalogItemStatus,
  type CatalogAttributeField,
  type CatalogItemDetailDto,
  type CategoryListItemDto,
} from '@/types/catalogApi'

export function EditCatalogItemPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { itemId } = useParams<{ itemId: string }>()
  const tenantId = useAppSelector(selectTenantId)
  const canEdit = useHasPermission('catalog.item.update')
  const canDelete = useHasPermission('catalog.item.delete')

  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [item, setItem] = useState<CatalogItemDetailDto | null>(null)
  const [categories, setCategories] = useState<CategoryListItemDto[]>([])
  const [kind, setKind] = useState(String(CatalogItemKind.Service))
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sku, setSku] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState(String(CatalogItemStatus.Active))
  const [attrValues, setAttrValues] = useState<Record<string, string>>({})

  const schemaFields = useMemo<CatalogAttributeField[]>(() => {
    const category = categories.find((c) => c.id === categoryId)
    return parseAttributeSchema(category?.attributeSchemaJson)
  }, [categories, categoryId])

  useEffect(() => {
    if (!tenantId || !itemId || !canEdit) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const [detail, cats] = await Promise.all([
          getCatalogItem(tenantId, itemId),
          listCatalogCategories(tenantId).catch(() => [] as CategoryListItemDto[]),
        ])
        if (cancelled) return
        setItem(detail)
        setCategories(cats)
        setKind(String(detail.kind))
        setName(detail.name)
        setDescription(detail.description ?? '')
        setSku(detail.sku ?? '')
        setBasePrice(detail.basePrice == null ? '' : String(detail.basePrice))
        setCategoryId(detail.categoryId ?? '')
        setStatus(String(detail.status))
        setAttrValues(parseAttributeValues(detail.customAttributesJson))
        setError(null)
      } catch (err: unknown) {
        if (!cancelled) {
          setError(readApiError(err, 'No se pudo cargar el ítem.'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canEdit, itemId, tenantId])

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
      if (!tenantId || !itemId || !item) return
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

        await updateCatalogItem(tenantId, itemId, {
          kind: kindNum,
          name: name.trim(),
          description: description.trim() || null,
          sku: sku.trim() || null,
          basePrice: price,
          categoryId: categoryId || null,
          customAttributesJson: serializeAttributeValues(schemaFields, attrValues),
          status: Number(status) as typeof CatalogItemStatus.Active,
        })

        toast.show({
          title: 'Ítem actualizado',
          message: `«${name.trim()}» se guardó correctamente.`,
          variant: 'success',
        })
        void navigate('/catalogo/items', { replace: true })
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : readApiError(err, 'No se pudo guardar el ítem.')
        setError(message)
        toast.show({ title: 'No se pudo guardar', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [
      attrValues,
      basePrice,
      categoryId,
      description,
      item,
      itemId,
      kind,
      name,
      navigate,
      schemaFields,
      sku,
      status,
      tenantId,
      toast,
    ]
  )

  const onDelete = useCallback(async () => {
    if (!tenantId || !itemId || !item || !canDelete) return
    const ok = window.confirm(
      `¿Eliminar «${item.name}»? Solo se permite si no tiene stock, movimientos ni documentos.`
    )
    if (!ok) return

    setDeleting(true)
    setError(null)
    try {
      await softDeleteCatalogItem(tenantId, itemId)
      toast.show({
        title: 'Ítem eliminado',
        message: `«${item.name}» quedó dado de baja.`,
        variant: 'success',
      })
      void navigate('/catalogo/items', { replace: true })
    } catch (err: unknown) {
      const message = readApiError(
        err,
        'El ítem tiene registros asociados. Desactívalo (Inactivo) o modifícalo.'
      )
      setError(message)
      toast.show({ title: 'No se pudo eliminar', message, variant: 'error' })
    } finally {
      setDeleting(false)
    }
  }, [canDelete, item, itemId, navigate, tenantId, toast])

  if (!canEdit) {
    return (
      <TenantSessionGate title="Editar ítem" lead="Cambios en el maestro de catálogo.">
        <div className="ecu-companies-page">
          <p className="app-shell__page-lead">Requieres catalog.item.update para editar ítems.</p>
          <Button type="button" variant="outline" onClick={goToList}>
            Volver al listado
          </Button>
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Editar ítem" lead="Cambios en el maestro de catálogo.">
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <p className="app-shell__page-lead">
            {item
              ? item.kind === CatalogItemKind.Service
                ? 'Este ítem es un servicio. Cámbialo a físico e indica SKU para usarlo en inventario.'
                : 'Este ítem es físico. Podés pasarlo a servicio solo si aún no tiene stock ni kárdex.'
              : 'Cargando…'}
          </p>
          <EcuPageActions
            items={actionItems}
            variant="outline"
            triggerLabel="Acciones de editar ítem"
            renderIcon={renderSidebarIcon}
            onNavigate={(route: string) => navigate(route)}
          />
        </div>

        {error ? (
          <p className="welcome-onboarding__error" role="alert">
            {error}
          </p>
        ) : null}

        {loading || !item ? (
          <p className="app-shell__muted">Cargando ítem…</p>
        ) : (
          <form className="ecu-companies-form" onSubmit={(e) => void onSubmit(e)} noValidate>
            <section className="app-shell__card ecu-companies-form__card">
              <h2 className="app-shell__section-title">
                <Package size={18} strokeWidth={1.75} aria-hidden /> Ítem
              </h2>
              <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
                <div className="ecu-companies-form__field">
                  <Select
                    id="ei-kind"
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
                    id="ei-cat"
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
                  <Select
                    id="ei-status"
                    label="Estado"
                    labelPosition="outlined"
                    variant="outline"
                    options={[
                      { value: String(CatalogItemStatus.Active), label: 'Activo' },
                      { value: String(CatalogItemStatus.Inactive), label: 'Inactivo' },
                    ]}
                    value={status}
                    onChange={setStatus}
                    disabled={busy}
                    fullWidth
                  />
                </div>
                <div className="ecu-companies-form__field">
                  <TextBox
                    id="ei-name"
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
                    id="ei-sku"
                    label="SKU"
                    labelPosition="outlined"
                    variant="outline"
                    value={sku}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setSku(e.target.value.toUpperCase())
                    }
                    required={Number(kind) === CatalogItemKind.Physical}
                    disabled={busy}
                    fullWidth
                  />
                </div>
                <div className="ecu-companies-form__field">
                  <TextBox
                    id="ei-price"
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
                    id="ei-desc"
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
                  idPrefix="ei"
                  fields={schemaFields}
                  values={attrValues}
                  disabled={busy}
                  onChange={(key, next) => setAttrValues((prev) => ({ ...prev, [key]: next }))}
                />
              </div>
            </section>

            <div className="ecu-companies-form__actions">
              <Button type="submit" variant="primary" loading={busy} disabled={busy || deleting}>
                Guardar
              </Button>
              {canDelete ? (
                <Button
                  type="button"
                  variant="danger"
                  loading={deleting}
                  disabled={busy || deleting}
                  onClick={() => void onDelete()}
                >
                  Eliminar
                </Button>
              ) : null}
              <Button type="button" variant="outline" disabled={busy || deleting} onClick={goToList}>
                Atrás
              </Button>
            </div>
          </form>
        )}
      </div>
    </TenantSessionGate>
  )
}
