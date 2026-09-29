import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Button, DataGrid, NumberBox, Popup, Select, TextBox, useToast, type ColumnDef } from 'glubox'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  EmptyState,
  GridIconButton,
  GridToolbarRefresh,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import {
  volumeSchemeTypeLabel,
} from '@/pages/catalog/pricing/pricingFormat'
import {
  createVolumeDiscountScheme,
  deleteVolumeDiscountScheme,
  listVolumeDiscountSchemes,
  updateVolumeDiscountScheme,
} from '@/services/pricingApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  VolumeDiscountSchemeType,
  type VolumeDiscountSchemeDto,
  type VolumeDiscountTierBody,
} from '@/types/pricingApi'

type SchemeRow = VolumeDiscountSchemeDto & Record<string, unknown>

interface TierDraft {
  id: string
  quantityFrom: number
  quantityTo: number | null
  value: number
}

const gridMessages = createSpanishDataGridMessages('escala', 'escalas')

export function VolumeDiscountSchemesListPage() {
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)
  const canRead = useHasPermission('catalog.pricing.read')
  const canCreate = useHasPermission('catalog.pricing.create')
  const canEdit = useHasPermission('catalog.pricing.update')
  const canDelete = useHasPermission('catalog.pricing.delete')

  const [rows, setRows] = useState<VolumeDiscountSchemeDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active'>('active')

  // Modal Crear / Editar
  const [modalOpen, setModalOpen] = useState(false)
  const [editingScheme, setEditingScheme] = useState<VolumeDiscountSchemeDto | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formType, setFormType] = useState<VolumeDiscountSchemeType>(VolumeDiscountSchemeType.Percentage)
  const [formTiers, setFormTiers] = useState<TierDraft[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Confirmar desactivación
  const [confirmDeactivate, setConfirmDeactivate] = useState<VolumeDiscountSchemeDto | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const data = await listVolumeDiscountSchemes(tenantId, statusFilter === 'active')
      setRows(data)
      setError(null)
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudieron cargar los esquemas de volumen.')
      setError(message)
      setRows([])
      toast.show({ title: 'Error', message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, tenantId, toast])

  useEffect(() => {
    if (!canRead) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [canRead, load])

  const totalCount = rows.length
  const activeCount = useMemo(() => rows.filter((r) => r.isActive).length, [rows])
  const percentCount = useMemo(
    () => rows.filter((r) => r.type === VolumeDiscountSchemeType.Percentage).length,
    [rows]
  )
  const fixedCount = useMemo(
    () => rows.filter((r) => r.type === VolumeDiscountSchemeType.FixedAmount).length,
    [rows]
  )

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    )
  }, [rows, search])

  const openCreateModal = () => {
    setEditingScheme(null)
    setFormName('')
    setFormDescription('')
    setFormType(VolumeDiscountSchemeType.Percentage)
    setFormTiers([
      { id: '1', quantityFrom: 3, quantityTo: 5, value: 5 },
      { id: '2', quantityFrom: 6, quantityTo: 11, value: 10 },
      { id: '3', quantityFrom: 12, quantityTo: null, value: 15 },
    ])
    setFormError(null)
    setModalOpen(true)
  }

  const openEditModal = (scheme: VolumeDiscountSchemeDto) => {
    setEditingScheme(scheme)
    setFormName(scheme.name)
    setFormDescription(scheme.description ?? '')
    setFormType(scheme.type)
    setFormTiers(
      scheme.tiers.map((t, idx) => ({
        id: t.id || String(idx),
        quantityFrom: t.quantityFrom,
        quantityTo: t.quantityTo,
        value: t.value,
      }))
    )
    setFormError(null)
    setModalOpen(true)
  }

  const handleAddTier = () => {
    setFormTiers((prev) => {
      const lastTier = prev[prev.length - 1]
      const nextFrom = lastTier ? (lastTier.quantityTo ? lastTier.quantityTo + 1 : lastTier.quantityFrom + 5) : 3
      return [
        ...prev,
        {
          id: String(Date.now()),
          quantityFrom: nextFrom,
          quantityTo: null,
          value: lastTier ? lastTier.value + 5 : 5,
        },
      ]
    })
  }

  const handleRemoveTier = (index: number) => {
    setFormTiers((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleTierChange = (index: number, field: keyof TierDraft, val: number | null) => {
    setFormTiers((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: val }
      return next
    })
  }

  const validateTiers = (): string | null => {
    if (formTiers.length === 0) {
      return 'Debes definir al menos un tramo de cantidad con su descuento.'
    }

    const sorted = [...formTiers]
      .map((t) => ({ ...t, quantityTo: t.quantityTo && t.quantityTo > 0 ? t.quantityTo : null }))
      .sort((a, b) => a.quantityFrom - b.quantityFrom)
    for (let i = 0; i < sorted.length; i++) {
      const tier = sorted[i]
      if (tier.quantityFrom < 1) {
        return `La cantidad desde debe ser al menos 1 (tramo ${i + 1}).`
      }
      if (tier.quantityTo !== null && tier.quantityTo < tier.quantityFrom) {
        return `La cantidad hasta (${tier.quantityTo}) no puede ser menor a la cantidad desde (${tier.quantityFrom}).`
      }
      if (tier.value <= 0) {
        return `El valor de descuento debe ser mayor a 0 (tramo ${i + 1}).`
      }
      if (formType === VolumeDiscountSchemeType.Percentage && tier.value > 100) {
        return `El descuento porcentual no puede exceder el 100% (tramo ${i + 1}).`
      }
      if (i > 0) {
        const prevTier = sorted[i - 1]
        if (prevTier.quantityTo === null) {
          return `El tramo anterior parte desde ${prevTier.quantityFrom} sin límite superior. No puede haber tramos posteriores.`
        }
        if (tier.quantityFrom <= prevTier.quantityTo) {
          return `Solapamiento de tramos: el tramo ${i + 1} empieza en ${tier.quantityFrom}, pero el anterior llega hasta ${prevTier.quantityTo}.`
        }
      }
    }
    return null
  }

  const handleSaveScheme = async () => {
    if (!tenantId) return
    const name = formName.trim()
    if (!name) {
      setFormError('El nombre del esquema es obligatorio.')
      return
    }

    const tierErr = validateTiers()
    if (tierErr) {
      setFormError(tierErr)
      return
    }

    setSaving(true)
    setFormError(null)

    const tiersPayload: VolumeDiscountTierBody[] = formTiers.map((t) => ({
      quantityFrom: t.quantityFrom,
      quantityTo: t.quantityTo && t.quantityTo > 0 ? t.quantityTo : null,
      value: t.value,
      isActive: true,
    }))

    try {
      if (editingScheme) {
        await updateVolumeDiscountScheme(tenantId, editingScheme.id, {
          name,
          description: formDescription.trim() || null,
          type: formType,
          isActive: editingScheme.isActive,
          tiers: tiersPayload,
        })
        toast.show({
          title: 'Escala actualizada',
          message: `El esquema «${name}» se guardó correctamente.`,
          variant: 'success',
        })
      } else {
        await createVolumeDiscountScheme(tenantId, {
          name,
          description: formDescription.trim() || null,
          type: formType,
          tiers: tiersPayload,
        })
        toast.show({
          title: 'Escala creada',
          message: `El esquema «${name}» se creó correctamente.`,
          variant: 'success',
        })
      }
      setModalOpen(false)
      await load()
    } catch (err: unknown) {
      const msg = readApiError(err, 'No se pudo guardar el esquema.')
      setFormError(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    if (!tenantId || !confirmDeactivate) return
    setDeactivating(true)
    try {
      await deleteVolumeDiscountScheme(tenantId, confirmDeactivate.id)
      toast.show({
        title: 'Escala desactivada',
        message: `El esquema «${confirmDeactivate.name}» fue desactivado.`,
        variant: 'success',
      })
      setConfirmDeactivate(null)
      await load()
    } catch (err: unknown) {
      toast.show({
        title: 'Error al desactivar',
        message: readApiError(err, 'Intenta nuevamente.'),
        variant: 'error',
      })
    } finally {
      setDeactivating(false)
    }
  }

  const columns = useMemo((): ColumnDef<SchemeRow>[] => {
    const cols: ColumnDef<SchemeRow>[] = [
      {
        key: 'name',
        header: 'Esquema de Volumen',
        width: 250,
        sortable: true,
        renderCell: (_value, row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <strong style={{ fontSize: '0.9375rem' }}>{row.name}</strong>
            {row.description ? (
              <span className="app-shell__muted" style={{ fontSize: '0.8125rem' }}>
                {row.description}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'type',
        header: 'Tipo de Descuento',
        width: 170,
        sortable: true,
        renderCell: (_value, row) => (
          <span className="ecu-chip">{volumeSchemeTypeLabel(row.type)}</span>
        ),
      },
      {
        key: 'tiers',
        header: 'Tramos Configurados',
        minWidth: 280,
        sortable: false,
        renderCell: (_value, row) => (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {row.tiers.length === 0 ? (
              <span className="app-shell__muted">Sin tramos</span>
            ) : (
              row.tiers
                .sort((a, b) => a.quantityFrom - b.quantityFrom)
                .map((t, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'var(--color-surface-subtle, rgba(0,0,0,0.04))',
                      border: '1px solid var(--color-border-subtle, rgba(0,0,0,0.08))',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '0.8125rem',
                      fontFamily: 'monospace',
                    }}
                  >
                    <span>
                      {t.quantityTo ? `${t.quantityFrom}–${t.quantityTo} un.` : `≥${t.quantityFrom} un.`}
                    </span>
                    <strong style={{ color: 'var(--color-primary-dark, #0f766e)' }}>
                      -{row.type === VolumeDiscountSchemeType.Percentage ? `${t.value}%` : `$${t.value}`}
                    </strong>
                  </span>
                ))
            )}
          </div>
        ),
      },
      {
        key: 'isActive',
        header: 'Estado',
        width: 120,
        sortable: true,
        renderCell: (_value, row) => (
          <span className={`ecu-status ${row.isActive ? 'ecu-status--active' : 'ecu-status--inactive'}`}>
            <span className="ecu-status__dot" aria-hidden />
            {row.isActive ? 'Activo' : 'Inactivo'}
          </span>
        ),
      },
    ]

    if (canEdit || canDelete) {
      cols.push({
        key: 'id',
        header: 'Acciones',
        sticky: 'right',
        width: 100,
        align: 'center',
        sortable: false,
        renderCell: (_value, row) => (
          <div className="ecu-companies-grid__actions">
            {canEdit ? (
              <GridIconButton
                label="Editar escala"
                icon={Pencil}
                onClick={() => openEditModal(row)}
              />
            ) : null}
            {canDelete && row.isActive ? (
              <GridIconButton
                label="Desactivar escala"
                icon={Trash2}
                danger
                onClick={() => setConfirmDeactivate(row)}
              />
            ) : null}
          </div>
        ),
      })
    }

    return cols
  }, [canDelete, canEdit])

  if (!canRead) {
    return (
      <TenantSessionGate title="Escalas por cantidad" lead="Descuentos por volumen escalonados.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres el permiso catalog.pricing.read para ver las escalas por cantidad."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Escalas por cantidad" lead="Descuentos por volumen escalonados.">
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Escalas de Descuento por Cantidad"
          subtitle="Define reglas reutilizables por volumen (ej: calcetines 3–5 pares: 10%, 6+: 15%). Asígnalas en lote a productos sin crear mínimos y máximos repetitivos."
          badge={<StatusBadge tone="neutral">Volumen Enterprise</StatusBadge>}
          actions={
            canCreate ? (
              <Button
                type="button"
                variant="primary"
                iconLeft={<Plus size={16} />}
                onClick={openCreateModal}
              >
                + Nueva Escala
              </Button>
            ) : undefined
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de escalas">
          <StatCard label="Total Escalas" value={totalCount} />
          <StatCard label="Escalas Activas" value={activeCount} />
          <StatCard label="En Porcentaje" value={percentCount} />
          <StatCard label="En Descuento Fijo" value={fixedCount} />
        </div>

        <SectionCard title="Catálogo de Escalas de Volumen">
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {!loading && filteredRows.length === 0 && !error ? (
            <EmptyState
              icon="layers"
              title="No hay escalas de descuento creadas"
              description="Crea una escala de volumen para incentivar compras al por mayor y ventas de packs."
              action={
                canCreate ? (
                  <Button type="button" variant="primary" onClick={openCreateModal}>
                    + Crear Primera Escala
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataGrid
              className="ecu-companies-grid"
              dataSource={filteredRows as SchemeRow[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch={false}
              toolbarRight={
                <div className="ecu-grid-toolbar-actions">
                  <div style={{ minWidth: 240 }}>
                    <TextBox
                      id="scheme-search"
                      label="Buscar escala"
                      labelPosition="outlined"
                      variant="outline"
                      value={search}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                      placeholder="Nombre o descripción..."
                      fullWidth
                    />
                  </div>
                  <div style={{ minWidth: 140 }}>
                    <Select
                      id="scheme-status-filter"
                      aria-label="Filtrar por estado"
                      variant="outline"
                      options={[
                        { value: 'active', label: 'Solo activas' },
                        { value: 'all', label: 'Todas' },
                      ]}
                      value={statusFilter}
                      onChange={(value) => setStatusFilter(value as 'all' | 'active')}
                    />
                  </div>
                  <GridToolbarRefresh loading={loading} onRefresh={() => void load()} />
                </div>
              }
              paging={paging}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              paginationMode="client"
              pageSizeOptions={pageSizeOptions}
              layout="auto"
              loading={loading}
              messages={gridMessages}
            />
          )}
        </SectionCard>
      </div>

      {/* Modal Crear / Editar Escala */}
      <Popup
        open={modalOpen}
        title={editingScheme ? `Editar Escala: ${editingScheme.name}` : 'Nueva Escala por Cantidad'}
        onClose={() => !saving && setModalOpen(false)}
        width="min(94vw, 42rem)"
        actions={[
          {
            id: 'cancel',
            label: 'Cancelar',
            variant: 'ghost',
            onClick: () => setModalOpen(false),
            disabled: saving,
          },
          {
            id: 'save',
            label: saving ? 'Guardando...' : editingScheme ? 'Guardar Cambios' : 'Crear Escala',
            variant: 'primary',
            onClick: () => void handleSaveScheme(),
            disabled: saving,
          },
        ]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingTop: '0.5rem' }}>
          {formError ? (
            <div className="ecu-form-error-banner" role="alert" style={{ marginBottom: 0 }}>
              <span className="material-symbols-outlined">error</span>
              <span>{formError}</span>
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <TextBox
              id="scheme-name"
              label="Nombre del esquema"
              labelPosition="outlined"
              variant="outline"
              value={formName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormName(e.target.value)}
              placeholder="Ej: Docena Calcetines, Pack 3+ Camisetas..."
              required
              fullWidth
            />

            <Select
              id="scheme-type"
              label="Tipo de beneficio"
              labelPosition="outlined"
              variant="outline"
              options={[
                { value: String(VolumeDiscountSchemeType.Percentage), label: 'Descuento porcentual (%)' },
                { value: String(VolumeDiscountSchemeType.FixedAmount), label: 'Descuento fijo por unidad ($)' },
                { value: String(VolumeDiscountSchemeType.FixedPrice), label: 'Precio unitario fijo ($)' },
              ]}
              value={String(formType)}
              onChange={(val) => setFormType(Number(val) as VolumeDiscountSchemeType)}
              fullWidth
            />
          </div>

          <TextBox
            id="scheme-desc"
            label="Descripción o notas internas (opcional)"
            labelPosition="outlined"
            variant="outline"
            value={formDescription}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFormDescription(e.target.value)}
            placeholder="Ej: Aplicable a prendas de rotación rápida para venta en caja y storefront."
            fullWidth
          />

          <div
            style={{
              border: '1px solid var(--shell-border, rgba(125, 125, 125, 0.2))',
              borderRadius: '8px',
              padding: '1rem',
              backgroundColor: 'var(--shell-surface-subtle, rgba(125, 125, 125, 0.08))',
              color: 'var(--glb-text, var(--shell-text, inherit))',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <div>
                <strong style={{ fontSize: '0.9375rem', color: 'var(--glb-text, var(--shell-text, inherit))' }}>
                  Tramos de Cantidad
                </strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: 'var(--glb-muted, var(--shell-muted, #94a3b8))' }}>
                  Define rangos no solapados. El último tramo puede dejar el límite «Hasta» en blanco para aplicar a partir de esa cantidad en adelante.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                iconLeft={<Plus size={14} />}
                onClick={handleAddTier}
              >
                Agregar Tramo
              </Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1.2fr 44px',
                  gap: '0.5rem',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  color: 'var(--glb-muted, var(--shell-muted, #94a3b8))',
                  paddingBottom: '4px',
                }}
              >
                <span>Desde (un.)</span>
                <span>Hasta (un.)</span>
                <span>
                  {formType === VolumeDiscountSchemeType.Percentage
                    ? 'Descuento (%)'
                    : 'Descuento ($/un.)'}
                </span>
                <span />
              </div>

              {formTiers.map((tier, idx) => (
                <div
                  key={tier.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1.2fr 44px',
                    gap: '0.5rem',
                    alignItems: 'center',
                  }}
                >
                  <NumberBox
                    value={tier.quantityFrom}
                    min={1}
                    step={1}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleTierChange(idx, 'quantityFrom', Number(e.target.value) || 1)
                    }
                    variant="outline"
                    placeholder="Desde"
                  />
                  <NumberBox
                    value={tier.quantityTo && tier.quantityTo > 0 ? tier.quantityTo : ''}
                    min={tier.quantityFrom}
                    step={1}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const raw = e.target.value.trim()
                      const num = Number(raw)
                      handleTierChange(idx, 'quantityTo', !raw || isNaN(num) || num <= 0 ? null : num)
                    }}
                    variant="outline"
                    placeholder="En adelante"
                  />
                  <NumberBox
                    value={tier.value}
                    min={0.01}
                    max={formType === VolumeDiscountSchemeType.Percentage ? 100 : undefined}
                    step={formType === VolumeDiscountSchemeType.Percentage ? 1 : 0.05}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleTierChange(idx, 'value', Number(e.target.value) || 0)
                    }
                    variant="outline"
                    placeholder="Valor"
                  />
                  <GridIconButton
                    label="Eliminar tramo"
                    icon={Trash2}
                    danger
                    disabled={formTiers.length <= 1}
                    onClick={() => handleRemoveTier(idx)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Popup>

      {/* Modal Desactivar Escala */}
      <Popup
        open={confirmDeactivate !== null}
        title="Desactivar escala de volumen"
        onClose={() => setConfirmDeactivate(null)}
        width="min(92vw, 28rem)"
        actions={[
          {
            id: 'cancel',
            label: 'Cancelar',
            variant: 'ghost',
            onClick: () => setConfirmDeactivate(null),
            disabled: deactivating,
          },
          {
            id: 'confirm',
            label: deactivating ? 'Desactivando...' : 'Sí, desactivar',
            variant: 'primary',
            onClick: () => void handleDeactivate(),
            disabled: deactivating,
          },
        ]}
      >
        {confirmDeactivate ? (
          <p className="app-shell__muted">
            ¿Desactivar la escala <strong>{confirmDeactivate.name}</strong>? Los productos que la tengan
            asignada ya no aplicarán estos tramos de descuento en nuevas ventas hasta que se reactive o reasigne.
          </p>
        ) : null}
      </Popup>
    </TenantSessionGate>
  )
}
