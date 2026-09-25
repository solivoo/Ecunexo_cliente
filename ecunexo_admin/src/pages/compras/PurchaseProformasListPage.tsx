import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  DataGrid,
  useToast,
  type ColumnDef,
} from 'glubox'
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  GridToolbarRefresh,
} from '@/components/ui'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { Check, ExternalLink, Plus, X } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  approvePurchaseProforma,
  listPurchaseProformas,
  rejectPurchaseProforma,
} from '@/services/purchasesApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type {
  PurchaseProformaDto,
  PurchaseProformaStatus,
} from '@/types/purchasesApi'
import '@/pages/repairs/ecu-customer-form.css'

type ProformaRow = PurchaseProformaDto & Record<string, unknown>

function formatStatus(status: PurchaseProformaStatus): {
  label: string
  variant: 'active' | 'warning' | 'inactive' | 'danger'
} {
  switch (status) {
    case 1:
      return { label: 'Borrador', variant: 'warning' }
    case 2:
      return { label: 'Aprobada', variant: 'active' }
    case 3:
      return { label: 'Convertida en Compra', variant: 'active' }
    case 4:
      return { label: 'Rechazada', variant: 'danger' }
    case 5:
      return { label: 'Expirada', variant: 'inactive' }
    default:
      return { label: 'Borrador', variant: 'warning' }
  }
}

export function PurchaseProformasListPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)

  const canRead = useHasPermission('purchases.proformas.read') || useHasPermission('purchases.proformas.manage')
  const canManage = useHasPermission('purchases.proformas.manage')
  const canApprove = useHasPermission('purchases.proformas.approve')

  const [loading, setLoading] = useState(true)
  const [proformas, setProformas] = useState<PurchaseProformaDto[]>([])

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const proformasData = await listPurchaseProformas(tenantId)
      setProformas(proformasData)
    } catch (err) {
      toast.show({
        title: 'Error de carga',
        message: readApiError(err, 'No se pudieron cargar las proformas de compra.'),
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, toast])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const openCreate = useCallback(() => {
    navigate('/compras/proformas/nueva')
  }, [navigate])

  const handleApprove = useCallback(
    async (row: PurchaseProformaDto) => {
      if (!tenantId) return
      const confirmed = window.confirm(`¿Aprobar la proforma "${row.proformaNumber}" por un total de $${row.totalAmount.toFixed(2)}?`)
      if (!confirmed) return

      try {
        await approvePurchaseProforma(tenantId, row.id)
        toast.show({
          title: 'Proforma aprobada',
          message: `La proforma "${row.proformaNumber}" ha sido aprobada.`,
          variant: 'success',
        })
        await loadData()
      } catch (err) {
        toast.show({
          title: 'Error al aprobar',
          message: readApiError(err, 'No se pudo aprobar la proforma.'),
          variant: 'error',
        })
      }
    },
    [tenantId, loadData, toast]
  )

  const handleReject = useCallback(
    async (row: PurchaseProformaDto) => {
      if (!tenantId) return
      const reason = window.prompt(`Ingresa el motivo del rechazo para la proforma "${row.proformaNumber}":`, 'Precios superiores al presupuesto')
      if (reason === null) return

      try {
        await rejectPurchaseProforma(tenantId, row.id, reason)
        toast.show({
          title: 'Proforma rechazada',
          message: `La proforma "${row.proformaNumber}" fue rechazada.`,
          variant: 'warning',
        })
        await loadData()
      } catch (err) {
        toast.show({
          title: 'Error al rechazar',
          message: readApiError(err, 'No se pudo rechazar la proforma.'),
          variant: 'error',
        })
      }
    },
    [tenantId, loadData, toast]
  )

  // KPIs
  const stats = useMemo(() => {
    const total = proformas.length
    const borrador = proformas.filter((p) => p.status === 1).length
    const aprobadas = proformas.filter((p) => p.status === 2).length
    const finalizadas = proformas.filter((p) => p.status === 3 || p.status === 4).length
    return { total, borrador, aprobadas, finalizadas }
  }, [proformas])

  // DataGrid Columns
  const columns = useMemo((): ColumnDef<ProformaRow>[] => {
    return [
      {
        key: 'proformaNumber',
        header: 'N° Proforma / Cotización',
        width: 190,
        sortable: true,
        renderCell: (_value, row: ProformaRow) => (
          <div>
            <code className="ecu-code">{row.proformaNumber}</code>
            {row.attachmentUrl ? (
              <a
                href={row.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.72rem',
                  color: 'var(--shell-primary, #4f46e5)',
                  textDecoration: 'none',
                }}
              >
                <ExternalLink size={11} /> Ver cotización adjunta
              </a>
            ) : null}
          </div>
        ),
      },
      {
        key: 'supplierBusinessName',
        header: 'Proveedor',
        width: 250,
        sortable: true,
        renderCell: (_value, row: ProformaRow) => (
          <span className="ecu-clip ecu-clip--wide" style={{ fontWeight: 500 }}>
            {row.supplierBusinessName ?? 'Proveedor no disponible'}
          </span>
        ),
      },
      {
        key: 'issueDate',
        header: 'Emisión',
        width: 110,
        sortable: true,
        renderCell: (_value, row: ProformaRow) => formatDate(row.issueDate),
      },
      {
        key: 'expirationDate',
        header: 'Vigencia',
        width: 110,
        sortable: true,
        renderCell: (_value, row: ProformaRow) => formatDate(row.expirationDate),
      },
      {
        key: 'subtotal',
        header: 'Subtotal',
        width: 110,
        sortable: true,
        renderCell: (_value, row: ProformaRow) => (
          <span style={{ textAlign: 'right', display: 'block' }}>${row.subtotal.toFixed(2)}</span>
        ),
      },
      {
        key: 'taxAmount',
        header: 'IVA',
        width: 90,
        sortable: true,
        renderCell: (_value, row: ProformaRow) => (
          <span style={{ textAlign: 'right', display: 'block' }}>${row.taxAmount.toFixed(2)}</span>
        ),
      },
      {
        key: 'totalAmount',
        header: 'Total Cotizado',
        width: 130,
        sortable: true,
        renderCell: (_value, row: ProformaRow) => (
          <span style={{ fontWeight: 700, color: 'var(--glb-text, #111827)', textAlign: 'right', display: 'block' }}>
            ${row.totalAmount.toFixed(2)}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Estado',
        width: 130,
        sortable: true,
        renderCell: (_value, row: ProformaRow) => {
          const { label, variant } = formatStatus(row.status)
          return (
            <span className={`ecu-status ecu-status--${variant}`}>
              <span className="ecu-status__dot" aria-hidden />
              {label}
            </span>
          )
        },
      },
      {
        key: 'id',
        header: 'Acciones',
        width: 110,
        sortable: false,
        renderCell: (_value: unknown, row: ProformaRow) => {
          if (!canManage) return null
          return (
            <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'center' }}>
              {row.status === 1 ? (
                <>
                  {canApprove && (
                    <GridIconButton
                      label="Aprobar proforma"
                      icon={Check}
                      onClick={() => void handleApprove(row)}
                    />
                  )}
                  <GridIconButton
                    label="Rechazar proforma"
                    icon={X}
                    danger
                    onClick={() => void handleReject(row)}
                  />
                </>
              ) : null}
            </div>
          )
        },
      },
    ]
  }, [canManage, canApprove, handleApprove, handleReject])

  const {
    paging,
    pageSizeOptions,
    onPageChange,
    onPageSizeChange,
  } = useGluDataGridPaging(proformas.length)

  const messages = useMemo(() => createSpanishDataGridMessages('proforma', 'proformas'), [])

  if (!canRead) {
    return (
      <TenantSessionGate title="Proformas" lead="Gestión de cotizaciones y proformas de compra.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres permisos de compras para ver las proformas de compra."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Proformas de Compra"
      lead="Control y cotizaciones de proveedores antes de formalizar la compra o ingreso de mercadería a bodegas."
    >
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Proformas y Cotizaciones de Compra"
          subtitle="Cotizaciones de proveedores previas a la compra o al ingreso de stock."
        />

        <div className="ecu-stat-grid" aria-label="Resumen de proformas">
          <StatCard label="Total Cotizaciones" value={stats.total} />
          <StatCard label="En Borrador" value={stats.borrador} />
          <StatCard label="Aprobadas" value={stats.aprobadas} />
          <StatCard label="Finalizadas" value={stats.finalizadas} />
        </div>

        <SectionCard title="Listado de Proformas">
          {!loading && proformas.length === 0 ? (
            <EmptyState
              icon="request_quote"
              title="No hay proformas registradas"
              description="Registra la cotización o proforma enviada por tu proveedor para comparar precios y autorizar la compra."
              action={
                canManage ? (
                  <Button variant="primary" onClick={openCreate}>
                    <Plus size={16} />
                    Registrar Primera Proforma
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataGrid
              dataSource={proformas as ProformaRow[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={300}
              searchPlaceholder="Buscar por n° proforma, proveedor..."
              toolbarRight={
                <div className="ecu-grid-toolbar-actions">
                  <GridToolbarRefresh loading={loading} onRefresh={() => void loadData()} />
                  {canManage && (
                    <Button variant="primary" onClick={openCreate}>
                      <Plus size={16} />
                      Nueva Cotización
                    </Button>
                  )}
                </div>
              }
              loading={loading}
              paging={paging}
              pageSizeOptions={pageSizeOptions}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              messages={messages}
            />
          )}
        </SectionCard>
      </div>
    </TenantSessionGate>
  )
}

export default PurchaseProformasListPage
