import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DataGrid, Popup, useToast, type ColumnDef } from 'glubox'
import { Pencil, Trash2 } from 'lucide-react'
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
import { formatDate } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { promotionTypeLabel, promotionValueLabel } from '@/pages/catalog/pricing/pricingFormat'
import { deletePromotion, listPromotions } from '@/services/pricingApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { PromotionDto } from '@/types/pricingApi'

type PromotionRow = PromotionDto & Record<string, unknown>

const gridMessages = createSpanishDataGridMessages('promoción', 'promociones')

export function PromotionsListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canRead = useHasPermission('catalog.pricing.read')
  const canManage = useHasPermission('catalog.promotions.manage')
  const [rows, setRows] = useState<PromotionDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<PromotionDto | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      setRows(await listPromotions(tenantId, false))
      setError(null)
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudieron cargar las promociones.')
      setError(message)
      setRows([])
      toast.show({ title: 'Error', message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [tenantId, toast])

  useEffect(() => {
    if (!canRead) return
    void load()
  }, [canRead, load])

  const activeCount = useMemo(() => rows.filter((r) => r.isActive).length, [rows])
  const stackableCount = useMemo(
    () => rows.filter((r) => r.isStackable && r.isActive).length,
    [rows]
  )

  const handleDelete = useCallback(async () => {
    if (!tenantId || !confirm) return
    setDeleting(true)
    try {
      await deletePromotion(tenantId, confirm.id)
      toast.show({ title: 'Promoción desactivada', message: `«${confirm.name}» quedó inactiva.`, variant: 'success' })
      setConfirm(null)
      await load()
    } catch (err: unknown) {
      toast.show({
        title: 'No se pudo desactivar',
        message: readApiError(err, 'Intenta nuevamente.'),
        variant: 'error',
      })
    } finally {
      setDeleting(false)
    }
  }, [confirm, load, tenantId, toast])

  const columns = useMemo((): ColumnDef<PromotionRow>[] => {
    const cols: ColumnDef<PromotionRow>[] = [
      {
        key: 'code',
        header: 'Código',
        width: 140,
        sortable: true,
        renderCell: (_value, row) => <code className="ecu-code">{row.code}</code>,
      },
      {
        key: 'name',
        header: 'Nombre',
        width: 220,
        sortable: true,
      },
      {
        key: 'type',
        header: 'Tipo',
        width: 130,
        sortable: true,
        renderCell: (_value, row) => promotionTypeLabel(row.type),
      },
      {
        key: 'value',
        header: 'Valor',
        width: 120,
        align: 'right',
        sortable: true,
        renderCell: (_value, row) => promotionValueLabel(row.type, row.value),
      },
      {
        key: 'startsAt',
        header: 'Vigencia',
        width: 200,
        sortable: true,
        renderCell: (_value, row) =>
          `${formatDate(row.startsAt)} – ${row.endsAt ? formatDate(row.endsAt) : 'indefinida'}`,
      },
      {
        key: 'priority',
        header: 'Prioridad',
        width: 90,
        align: 'center',
        sortable: true,
      },
      {
        key: 'isStackable',
        header: 'Acumulable',
        width: 110,
        align: 'center',
        sortable: true,
        renderCell: (_value, row) => (row.isStackable ? 'Sí' : 'No'),
      },
      {
        key: 'isActive',
        header: 'Estado',
        width: 110,
        sortable: true,
        renderCell: (_value, row) => (
          <span className={`ecu-status ${row.isActive ? 'ecu-status--active' : 'ecu-status--inactive'}`}>
            <span className="ecu-status__dot" aria-hidden />
            {row.isActive ? 'Activa' : 'Inactiva'}
          </span>
        ),
      },
    ]

    if (canManage) {
      cols.push({
        key: 'id',
        header: 'Acciones',
        sticky: 'right',
        width: 112,
        align: 'center',
        sortable: false,
        renderCell: (_value, row) => (
          <div className="ecu-companies-grid__actions">
            <GridIconButton
              label="Editar"
              icon={Pencil}
              onClick={() => navigate(`/catalogo/precios/promociones/${row.id}`)}
            />
            <GridIconButton
              label="Desactivar"
              icon={Trash2}
              danger
              disabled={!row.isActive || deleting}
              onClick={() => setConfirm(row)}
            />
          </div>
        ),
      })
    }

    return cols
  }, [canManage, deleting, navigate])

  if (!canRead) {
    return (
      <TenantSessionGate title="Promociones" lead="Reglas comerciales temporales.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres el permiso catalog.pricing.read para ver las promociones."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Promociones" lead="Reglas comerciales temporales.">
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Promociones"
          subtitle="Descuentos y precios promocionales con vigencia, prioridad y acumulabilidad. Nunca modifican el precio de lista."
        />

        <div className="ecu-stat-grid" aria-label="Resumen de promociones">
          <StatCard label="Promociones" value={rows.length} />
          <StatCard label="Activas" value={activeCount} />
          <StatCard label="Acumulables" value={stackableCount} />
        </div>

        <SectionCard title="Listado de promociones">
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {!loading && rows.length === 0 && !error ? (
            <EmptyState
              icon="percent"
              title="Aún no hay promociones"
              description="Crea una promoción porcentual o de valor fijo para tus productos."
              action={
                canManage ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => navigate('/catalogo/precios/promociones/nueva')}
                  >
                    + Nueva Promoción
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataGrid
              className="ecu-companies-grid"
              dataSource={rows as PromotionRow[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={260}
              searchPlaceholder="Buscar código o nombre…"
              searchKeys={['code', 'name', 'description']}
              toolbarRight={
                <div className="ecu-grid-toolbar-actions">
                  <GridToolbarRefresh loading={loading} onRefresh={() => void load()} />
                  {canManage ? (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => navigate('/catalogo/precios/promociones/nueva')}
                    >
                      + Nueva Promoción
                    </Button>
                  ) : null}
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

      <Popup
        open={confirm !== null}
        title="Desactivar promoción"
        onClose={() => setConfirm(null)}
        width="min(92vw, 28rem)"
        actions={[
          {
            id: 'cancel',
            label: 'Cancelar',
            variant: 'ghost',
            onClick: () => setConfirm(null),
            disabled: deleting,
          },
          {
            id: 'confirm',
            label: 'Sí, desactivar',
            variant: 'primary',
            onClick: () => void handleDelete(),
            disabled: deleting,
          },
        ]}
      >
        {confirm ? (
          <p className="app-shell__muted">
            ¿Desactivar <strong>{confirm.name}</strong>? Dejará de aplicarse en nuevas ventas.
          </p>
        ) : null}
      </Popup>
    </TenantSessionGate>
  )
}
