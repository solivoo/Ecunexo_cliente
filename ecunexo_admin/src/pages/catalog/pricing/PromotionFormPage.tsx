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
  const [targets, setTargets] = useState<TargetDraft[]>([])
  const [targetItemId, setTargetItemId] = useState('')

  const itemById = useMemo(() => {
    const map = new Map<string, CatalogItemListItemDto>()
    items.forEach((item) => map.set(item.id, item))
    return map
  }, [items])

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
      const item = itemById.get(target.targetReference)
      if (!item) return target.targetReference
      return item.sku ? `${item.name} · ${item.sku}` : item.name
    },
    [itemById]
  )

  const addTarget = useCallback(() => {
    if (!targetItemId) return
    setTargets((current) => {
      if (current.some((t) => t.targetReference === targetItemId)) return current
      return [
        ...current,
        { targetType: PromotionTargetType.Product, targetReference: targetItemId },
      ]
    })
    setTargetItemId('')
  }, [targetItemId])

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
          throw new Error('Agrega al menos un producto al alcance de la promoción.')
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
          await updatePromotion(tenantId, promotionId, body)
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
              <div className="ecu-companies-form__field ecu-companies-form__field--span-3">
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

          <SectionCard title="Alcance" subtitle="Productos físicos a los que aplica la promoción.">
            <CatalogItemPicker
              items={items}
              value={targetItemId}
              onChange={setTargetItemId}
              disabled={busy || loading}
              searchId="pr-target-search"
              selectId="pr-target-select"
              selectLabel="Producto a agregar"
            />
            <div style={{ marginTop: '0.75rem' }}>
              <Button
                type="button"
                variant="outline"
                disabled={busy || loading || !targetItemId}
                onClick={addTarget}
              >
                + Agregar al alcance
              </Button>
            </div>

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
