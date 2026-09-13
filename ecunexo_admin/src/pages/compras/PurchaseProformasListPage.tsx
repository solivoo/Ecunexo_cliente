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
} from '@/components/ui'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { Check, ExternalLink, Plus, RefreshCw, X } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
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

function formatStatus(status: PurchaseProformaStatus): { label: string; tone: 'primary' | 'success' | 'warning' | 'neutral' | 'danger' | 'info' } {
  switch (status) {
    case 1:
      return { label: 'Borrador', tone: 'neutral' }
    case 2:
      return { label: 'Aprobada', tone: 'success' }
    case 3:
      return { label: 'Convertida en Compra', tone: 'primary' }
    case 4:
      return { label: 'Rechazada', tone: 'danger' }
    case 5:
      return { label: 'Expirada', tone: 'warning' }
    default:
      return { label: 'Borrador', tone: 'neutral' }
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
            <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{row.proformaNumber}</div>
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
          <div style={{ fontWeight: 500 }}>
            {row.supplierBusinessName ?? 'Proveedor no disponible'}
          </div>
        ),
      },
      {
        key: 'issueDate',
        header: 'Emisión / Vigencia',
        width: 160,
        sortable: true,
        renderCell: (_value, row: ProformaRow) => (
          <div style={{ fontSize: '0.8rem' }}>
            <div>Emisión: {row.issueDate}</div>
            {row.expirationDate ? (
              <div style={{ color: 'var(--glb-muted, #6b7280)' }}>Vence: {row.expirationDate}</div>
            ) : null}
          </div>
        ),
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
          const { label, tone } = formatStatus(row.status)
          return <StatusBadge tone={tone}>{label}</StatusBadge>
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
        <div className="ecu-dashboard-layout">
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
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Proformas y Cotizaciones de Compra"
          subtitle="Registra y autoriza las cotizaciones recibidas de proveedores antes de generar la compra o recepcionar stock."
          badge={
            <StatusBadge tone="primary" withDot>
              Módulo Compras
            </StatusBadge>
          }
          actions={
            canManage ? (
              <Button variant="primary" onClick={openCreate}>
                <Plus size={16} />
                Nueva Cotización
              </Button>
            ) : undefined
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de proformas">
          <StatCard
            label="Total Cotizaciones"
            value={String(stats.total)}
            icon="request_quote"
            toneColor="#4f46e5"
            footerText="Proformas registradas"
          />
          <StatCard
            label="En Borrador"
            value={String(stats.borrador)}
            icon="edit_note"
            toneColor="#eab308"
            footerText="Pendientes de aprobación"
          />
          <StatCard
            label="Aprobadas"
            value={String(stats.aprobadas)}
            icon="verified"
            toneColor="#10b981"
            footerText="Listas para facturación"
          />
          <StatCard
            label="Convertidas / Rechazadas"
            value={String(stats.finalizadas)}
            icon="receipt_long"
            toneColor="#6b7280"
            footerText="Ciclo completado"
          />
        </div>

        <SectionCard
          title="Listado de Proformas"
          subtitle="Historial de cotizaciones recibidas y su estado de aprobación"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'ecu-spin' : ''} />
              Actualizar
            </Button>
          }
        >
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
