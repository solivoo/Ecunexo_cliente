import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  CheckButton,
  DateBox,
  NumberBox,
  Select,
  TextBox,
  useToast,
} from 'glubox'
import { X } from 'lucide-react'
import { PageHeader, SectionCard, StatusBadge } from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { CatalogItemPicker } from '@/pages/catalog/pricing/CatalogItemPicker'
import {
  endOfDayIso,
  promotionTargetTypeLabel,
  startOfDayIso,
  todayIso,
} from '@/pages/catalog/pricing/pricingFormat'
import { listCatalogItems } from '@/services/catalogApi'
import { createPromotion, listPromotions, updatePromotion } from '@/services/pricingApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import { CatalogItemKind, type CatalogItemListItemDto } from '@/types/catalogApi'
import {
  PromotionTargetType,
  PromotionType,
  type PromotionTargetDto,
} from '@/types/pricingApi'

type TargetDraft = PromotionTargetDto

const TYPE_OPTIONS = [
  { value: String(PromotionType.Percentage), label: 'Porcentaje' },
  { value: String(PromotionType.FixedAmount), label: 'Valor fijo por unidad' },
  { value: String(PromotionType.FixedPrice), label: 'Precio fijo promocional' },
]

const ALL_ITEMS_REFERENCE = '*'

function parseCatalogAttributes(json: string | null | undefined): Record<string, string> {
  if (!json) return {}
  try {
    const parsed: unknown = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const attributes: Record<string, string> = {}
    Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
      if (typeof value === 'string' && value.trim()) {
        attributes[key] = value.trim()
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        attributes[key] = String(value)
      }
    })
    return attributes
  } catch {
    return {}
  }
}

export function PromotionFormPage() {
  const { promotionId } = useParams<{ promotionId: string }>()
  const isEdit = Boolean(promotionId)
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canManage = useHasPermission('catalog.promotions.manage')

  const [items, setItems] = useState<CatalogItemListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<string>(String(PromotionType.Percentage))
  const [value, setValue] = useState('0')
  const [startsAt, setStartsAt] = useState(todayIso())
  const [endsAt, setEndsAt] = useState('')
  const [priority, setPriority] = useState(0)
  const [isStackable, setIsStackable] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [targets, setTargets] = useState<TargetDraft[]>([])
  const [targetItemId, setTargetItemId] = useState('')
  const [familyFilter, setFamilyFilter] = useState('')
  const [attributeKey, setAttributeKey] = useState('')
  const [attributeValue, setAttributeValue] = useState('')

  const itemById = useMemo(() => {
    const map = new Map<string, CatalogItemListItemDto>()
    items.forEach((item) => map.set(item.id, item))
    return map
  }, [items])

  const attributesByItem = useMemo(() => {
    const map = new Map<string, Record<string, string>>()
    items.forEach((item) => map.set(item.id, parseCatalogAttributes(item.customAttributesJson)))
    return map
  }, [items])

  const familyOptions = useMemo(() => {
    const names = new Set<string>()
    items.forEach((item) => {
      if (item.familyName) names.add(item.familyName)
    })
    return [...names]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name }))
  }, [items])

  const attributeKeyOptions = useMemo(() => {
    const keys = new Set<string>()
    attributesByItem.forEach((attributes) => {
      Object.keys(attributes).forEach((key) => keys.add(key))
    })
    return [...keys]
      .sort((a, b) => a.localeCompare(b))
      .map((key) => ({ value: key, label: key }))
  }, [attributesByItem])

  const attributeValueOptions = useMemo(() => {
    if (!attributeKey) return []
    const values = new Set<string>()
    attributesByItem.forEach((attributes) => {
      const value = attributes[attributeKey]
      if (value) values.add(value)
    })
    return [...values]
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: value }))
  }, [attributeKey, attributesByItem])

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (familyFilter && item.familyName !== familyFilter) return false
        const attributes = attributesByItem.get(item.id) ?? {}
        if (attributeKey && !attributes[attributeKey]) return false
        if (
          attributeKey &&
          attributeValue &&
          (attributes[attributeKey] ?? '').toLowerCase() !== attributeValue.toLowerCase()
        ) {
          return false
        }
        return true
      }),
    [attributeKey, attributeValue, attributesByItem, familyFilter, items]
  )

  const appliesToAll = useMemo(
    () => targets.some((target) => target.targetType === PromotionTargetType.AllItems),
    [targets]
  )

  const pendingFilteredCount = useMemo(() => {
    const existing = new Set(targets.map((target) => target.targetReference))
    return filteredItems.filter((item) => !existing.has(item.id)).length
  }, [filteredItems, targets])

  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    setLoading(true)
    const tasks: Promise<unknown>[] = [
      listCatalogItems(tenantId, { kind: CatalogItemKind.Physical }).then((data) => {
        if (!cancelled) setItems(data)
      }),
    ]

    if (isEdit && promotionId) {
      tasks.push(
        listPromotions(tenantId, false).then((promotions) => {
          if (cancelled) return
          const promotion = promotions.find((p) => p.id === promotionId)
          if (!promotion) {
            setError('La promoción no existe.')
            return
          }
          setCode(promotion.code)
          setName(promotion.name)
          setDescription(promotion.description ?? '')
          setType(String(promotion.type))
          setValue(String(promotion.value))
          setStartsAt(promotion.startsAt.slice(0, 10))
          setEndsAt(promotion.endsAt ? promotion.endsAt.slice(0, 10) : '')
          setPriority(promotion.priority)
          setIsStackable(promotion.isStackable)
          setIsActive(promotion.isActive)
          setTargets(
            promotion.targets.map((target) => ({
              targetType: target.targetType,
              targetReference: target.targetReference,
            }))
          )
        })
      )
    }

    void Promise.all(tasks)
      .catch((err: unknown) => {
        if (!cancelled) setError(readApiError(err, 'No se pudo cargar la promoción.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isEdit, promotionId, tenantId])

  const targetLabel = useCallback(
    (target: TargetDraft): string => {
      if (target.targetType === PromotionTargetType.AllItems) return 'Toda la tienda'
      const item = itemById.get(target.targetReference)
      if (!item) return target.targetReference
      return item.sku ? `${item.name} · ${item.sku}` : item.name
    },
    [itemById]
  )

  const addTarget = useCallback(() => {
    if (!targetItemId) return
    const item = itemById.get(targetItemId)
    setTargets((current) => {
      if (current.some((t) => t.targetReference === targetItemId)) return current
      return [
        ...current,
        {
          targetType: item?.parentId ? PromotionTargetType.Variant : PromotionTargetType.Product,
          targetReference: targetItemId,
        },
      ]
    })
    setTargetItemId('')
  }, [itemById, targetItemId])

  const addFilteredTargets = useCallback(() => {
    setTargets((current) => {
      const existing = new Set(current.map((target) => target.targetReference))
      const additions = filteredItems
        .filter((item) => !existing.has(item.id))
        .map((item) => ({
          targetType: item.parentId ? PromotionTargetType.Variant : PromotionTargetType.Product,
          targetReference: item.id,
        }))
      return additions.length === 0 ? current : [...current, ...additions]
    })
  }, [filteredItems])

  const toggleAllItems = useCallback((checked: boolean) => {
    setTargets(
      checked
        ? [{ targetType: PromotionTargetType.AllItems, targetReference: ALL_ITEMS_REFERENCE }]
        : []
    )
  }, [])

  const onSubmit = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault()
      if (!tenantId) return
      setError(null)
      setBusy(true)
      try {
        if (!name.trim()) throw new Error('El nombre de la promoción es obligatorio.')
        if (!isEdit && !code.trim()) throw new Error('El código de la promoción es obligatorio.')
        const numericValue = Number(value)
        if (!Number.isFinite(numericValue) || numericValue < 0) {
          throw new Error('El valor de la promoción debe ser un número mayor o igual a cero.')
        }
        if (targets.length === 0) {
          throw new Error(
            'Agrega al menos un producto o marca «Toda la tienda» en el alcance de la promoción.'
          )
        }

        const body = {
          name: name.trim(),
          description: description.trim() || null,
          type: Number(type) as PromotionType,
          value: numericValue,
          startsAt: startOfDayIso(startsAt),
          endsAt: endsAt ? endOfDayIso(endsAt) : null,
          priority,
          isStackable,
          targets: targets.map((target) => ({
            targetType: target.targetType,
            targetReference: target.targetReference,
          })),
        }

        if (isEdit && promotionId) {
          await updatePromotion(tenantId, promotionId, { ...body, isActive })
          toast.show({ title: 'Promoción actualizada', message: `«${body.name}» guardada.`, variant: 'success' })
        } else {
          await createPromotion(tenantId, { code: code.trim(), ...body })
          toast.show({ title: 'Promoción creada', message: `«${body.name}» ya está disponible.`, variant: 'success' })
        }

        void navigate('/catalogo/precios/promociones', { replace: true })
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : readApiError(err, 'No se pudo guardar la promoción.')
        setError(message)
        toast.show({ title: 'No se pudo guardar', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [
      code,
      description,
      endsAt,
      isActive,
      isEdit,
      isStackable,
      name,
      navigate,
      priority,
      promotionId,
      startsAt,
      targets,
      tenantId,
      toast,
      type,
      value,
    ]
  )

  if (!canManage) {
    return (
      <TenantSessionGate title="Promoción" lead="Regla comercial temporal.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres el permiso catalog.promotions.manage para gestionar promociones."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Promoción" lead="Regla comercial temporal.">
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title={isEdit ? 'Editar Promoción' : 'Nueva Promoción'}
          subtitle="El motor aplica la promoción según fecha, alcance, prioridad y acumulabilidad."
          badge={<StatusBadge tone="primary">{isEdit ? 'Edición' : 'Nueva'}</StatusBadge>}
        />

        <form onSubmit={(e) => void onSubmit(e)} noValidate>
          <SectionCard title="Datos de la promoción">
            {error ? (
              <div className="ecu-form-error-banner" role="alert">
                <span className="material-symbols-outlined">error</span>
                <span>{error}</span>
              </div>
            ) : null}

            <div className="ecu-companies-form__grid ecu-companies-form__grid--3">
              <div className="ecu-companies-form__field">
                <TextBox
                  id="pr-code"
                  label="Código"
                  labelPosition="outlined"
                  variant="outline"
                  value={code}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value.toUpperCase())}
                  placeholder="SEPTIEMBRE"
                  disabled={busy || loading || isEdit}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                <TextBox
                  id="pr-name"
                  label="Nombre"
                  labelPosition="outlined"
                  variant="outline"
                  value={name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  placeholder="Promo septiembre"
                  disabled={busy || loading}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <Select
                  id="pr-type"
                  aria-label="Tipo de promoción"
                  label="Tipo de promoción"
                  labelPosition="outlined"
                  variant="outline"
                  options={TYPE_OPTIONS}
                  value={type}
                  onChange={(selected) => setType(String(selected))}
                  disabled={busy || loading}
                />
              </div>
              <div className="ecu-companies-form__field">
                <NumberBox
                  id="pr-value"
                  label={Number(type) === PromotionType.Percentage ? 'Porcentaje' : 'Valor'}
                  labelPosition="outlined"
                  variant="outline"
                  value={Number(value) || 0}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
                  min={0}
                  max={Number(type) === PromotionType.Percentage ? 100 : undefined}
                  step={0.01}
                  showSpinButtons
                  disabled={busy || loading}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <NumberBox
                  id="pr-priority"
                  label="Prioridad"
                  labelPosition="outlined"
                  variant="outline"
                  value={priority}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPriority(Number(e.target.value) || 0)}
                  step={1}
                  showSpinButtons
                  disabled={busy || loading}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <DateBox
                  id="pr-start"
                  label="Inicia"
                  labelPosition="outlined"
                  variant="outline"
                  value={startsAt}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setStartsAt(e.target.value)}
                  disabled={busy || loading}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <DateBox
                  id="pr-end"
                  label="Termina"
                  labelPosition="outlined"
                  variant="outline"
                  value={endsAt}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEndsAt(e.target.value)}
                  disabled={busy || loading}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field sri-config-field--check-align">
                <CheckButton
                  variant="ghost"
                  checked={isStackable}
                  onChange={setIsStackable}
                  disabled={busy || loading}
                >
                  Acumulable con otras promociones
                </CheckButton>
              </div>
              {isEdit ? (
                <div className="ecu-companies-form__field sri-config-field--check-align">
                  <CheckButton
                    variant="ghost"
                    checked={isActive}
                    onChange={setIsActive}
                    disabled={busy || loading}
                  >
                    Promoción activa
                  </CheckButton>
                </div>
              ) : null}
              <div
                className={`ecu-companies-form__field ${
                  isEdit ? 'ecu-companies-form__field--span-2' : 'ecu-companies-form__field--span-3'
                }`}
              >
                <TextBox
                  id="pr-description"
                  label="Descripción"
                  labelPosition="outlined"
                  variant="outline"
                  value={description}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                  placeholder="Escriba aquí…"
                  disabled={busy || loading}
                  fullWidth
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Alcance"
            subtitle="Productos, variantes o toda la tienda a la que aplica la promoción."
          >
            <CheckButton
              variant="ghost"
              checked={appliesToAll}
              disabled={busy || loading}
              onChange={toggleAllItems}
            >
              Toda la tienda (incluye los productos nuevos)
            </CheckButton>

            {appliesToAll ? (
              <p className="app-shell__muted" style={{ marginTop: '0.75rem' }}>
                La promoción aplicará a todo el catálogo vigente y a los productos que se creen
                después.
              </p>
            ) : (
              <>
                <div
                  className="ecu-companies-form__grid ecu-companies-form__grid--3"
                  style={{ gap: '0.75rem', marginTop: '0.9rem', marginBottom: '0.9rem' }}
                >
                  <div className="ecu-companies-form__field">
                    <Select
                      id="pr-target-family"
                      aria-label="Filtrar por familia"
                      variant="outline"
                      options={familyOptions}
                      value={familyFilter}
                      onChange={(val) => setFamilyFilter(String(val))}
                      disabled={busy || loading || familyOptions.length === 0}
                      placeholder={
                        familyOptions.length === 0 ? 'Sin familias' : 'Familia (opcional)…'
                      }
                    />
                  </div>
                  <div className="ecu-companies-form__field">
                    <Select
                      id="pr-target-attribute"
                      aria-label="Filtrar por atributo"
                      variant="outline"
                      options={attributeKeyOptions}
                      value={attributeKey}
                      onChange={(val) => {
                        setAttributeKey(String(val))
                        setAttributeValue('')
                      }}
                      disabled={busy || loading || attributeKeyOptions.length === 0}
                      placeholder={
                        attributeKeyOptions.length === 0
                          ? 'Sin atributos'
                          : 'Atributo (opcional)…'
                      }
                    />
                  </div>
                  <div className="ecu-companies-form__field">
                    <Select
                      id="pr-target-attribute-value"
                      aria-label="Filtrar por valor de atributo"
                      variant="outline"
                      options={attributeValueOptions}
                      value={attributeValue}
                      onChange={(val) => setAttributeValue(String(val))}
                      disabled={busy || loading || !attributeKey || attributeValueOptions.length === 0}
                      placeholder={
                        !attributeKey
                          ? 'Elige un atributo…'
                          : attributeValueOptions.length === 0
                            ? 'Sin valores'
                            : 'Valor (opcional)…'
                      }
                    />
                  </div>
                </div>

                <CatalogItemPicker
                  items={filteredItems}
                  value={targetItemId}
                  onChange={setTargetItemId}
                  disabled={busy || loading}
                  searchId="pr-target-search"
                  selectId="pr-target-select"
                  selectLabel="Producto a agregar"
                />
                <div
                  style={{
                    marginTop: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || loading || !targetItemId}
                    onClick={addTarget}
                  >
                    + Agregar al alcance
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || loading || pendingFilteredCount === 0}
                    onClick={addFilteredTargets}
                  >
                    + Agregar los {pendingFilteredCount} filtrados
                  </Button>
                  <span className="app-shell__muted">
                    {filteredItems.length} de {items.length} coinciden con los filtros.
                  </span>
                </div>
              </>
            )}

            {targets.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginTop: '1rem',
                }}
              >
                {targets.map((target) => (
                  <span
                    key={`${target.targetType}-${target.targetReference}`}
                    className="ecu-chip"
                    title={promotionTargetTypeLabel(target.targetType)}
                  >
                    {targetLabel(target)}
                    <button
                      type="button"
                      aria-label={`Quitar ${targetLabel(target)}`}
                      disabled={busy || loading}
                      onClick={() =>
                        setTargets((current) =>
                          current.filter((t) => t.targetReference !== target.targetReference)
                        )
                      }
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: 0,
                      }}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="app-shell__muted" style={{ marginTop: '0.75rem' }}>
                Sin alcance: una promoción no aplica hasta asignarle productos.
              </p>
            )}
          </SectionCard>

          <SectionCard>
            <div className="ecu-companies-form__actions">
              <Button type="submit" variant="primary" loading={busy} disabled={busy || loading}>
                {isEdit ? 'Guardar cambios' : 'Crear promoción'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || loading}
                onClick={() => void navigate('/catalogo/precios/promociones')}
              >
                Cancelar
              </Button>
            </div>
          </SectionCard>
        </form>
      </div>
    </TenantSessionGate>
  )
}
