import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, DataGrid, OptionGroup, Popup, Select, TextBox, useToast, type ColumnDef, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { GridIconButton } from '@/components/ui/GridIconButton'
import {
  ArrowLeft,
  Ban,
  Camera,
  ExternalLink,
  Truck,
  Wrench,
  Eye,
} from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useGluComponentSize } from '@/hooks/useGluComponentSize'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  cancelRepairBatch,
  getRepairBatch,
  listBatchEquipments,
  updateEquipmentStatus,
} from '@/services/repairsApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  DamageLevel,
  damageLevelBadgeTone,
  damageLevelLabel,
  RepairBatchStatus,
  RepairEquipmentStatus,
  repairEquipmentStatusBadgeTone,
  repairEquipmentStatusLabel,
  type BatchDetailDto,
  type RepairEquipmentDto,
} from '@/types/repairsApi'
import './ecu-customer-form.css'

type Row = RepairEquipmentDto & Record<string, unknown>

const messages = createSpanishDataGridMessages('equipo', 'equipos')

export function RepairBatchDetailPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { batchId } = useParams<{ batchId: string }>()
  const tenantId = useAppSelector(selectTenantId)

  const canRead = useHasPermission('repairs.batches.read')
  const canCancel = useHasPermission('repairs.batches.cancel')
  const canUpdateStatus = useHasPermission('repairs.equipments.update.status')
  const canDispatch = useHasPermission('repairs.dispatches.create')
  const canReadDispatches = useHasPermission('repairs.dispatches.read')

  // Modal de anulación de lote
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancellingBatch, setCancellingBatch] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const [batch, setBatch] = useState<BatchDetailDto | null>(null)
  const [equipments, setEquipments] = useState<RepairEquipmentDto[]>([])
  const [loading, setLoading] = useState(true)
  const [queue, setQueue] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)
  const size = useGluComponentSize()
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId || !batchId) return
      setLoading(true)
      try {
        const [b, eqs] = await Promise.all([
          getRepairBatch(tenantId, batchId),
          listBatchEquipments(tenantId, batchId),
        ])
        setBatch(b)
        setEquipments(eqs)
        setError(null)
        if (!opts?.silent) {
          toast.show({ title: 'Actualizado', message: 'Datos del lote sincronizados.', variant: 'success' })
        }
      } catch (err: unknown) {
        const msg = readApiError(err, 'No se pudo cargar el detalle del lote.')
        setError(msg)
        toast.show({ title: 'Error', message: msg, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [batchId, tenantId, toast]
  )

  useEffect(() => {
    void load({ silent: true })
  }, [load])

  const canCancelBatch = useMemo(() => {
    if (!canCancel || !batch) return false
    if (batch.status === RepairBatchStatus.Cancelled) return false
    return (
      batch.inRepairCount === 0 &&
      batch.readyCount === 0 &&
      batch.dispatchedCount === 0
    )
  }, [canCancel, batch])

  const handleCancelBatch = async () => {
    if (!tenantId || !batchId) return
    if (!cancelReason.trim()) {
      setCancelError('El motivo de la anulación es obligatorio.')
      return
    }

    setCancellingBatch(true)
    setCancelError(null)

    try {
      await cancelRepairBatch(tenantId, batchId, cancelReason.trim())
      toast.show({
        title: 'Lote Anulado',
        message: 'El lote fue anulado para auditoría y sus equipos fueron deshabilitados.',
        variant: 'success',
      })
      setCancelModalOpen(false)
      setCancelReason('')
      void load({ silent: true })
    } catch (err: unknown) {
      const msg = readApiError(err, 'No se pudo anular el lote.')
      setCancelError(msg)
      toast.show({ title: 'Error al anular', message: msg, variant: 'error' })
    } finally {
      setCancellingBatch(false)
    }
  }

  const actionItems = useMemo<PageActionItem[]>(() => {
    const items: PageActionItem[] = []
    if (canReadDispatches) {
      items.push({
        id: 'dispatches',
        label: 'Actas de despacho',
        icon: 'truck',
        route: '/taller/despachos',
        disabled: false,
      })
    }
    items.push({
      id: 'refresh',
      label: 'Actualizar',
      icon: 'refresh-cw',
      route: null,
      disabled: loading,
    })
    return items
  }, [canReadDispatches, loading])

  const handleActionSelect = useCallback(
    (item: PageActionItem) => {
      if (item.id === 'refresh') {
        void load()
      }
    },
    [load]
  )

  // Modal Estado
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [selectedEquipment, setSelectedEquipment] = useState<RepairEquipmentDto | null>(null)
  const [targetStatus, setTargetStatus] = useState<RepairEquipmentStatus>(RepairEquipmentStatus.InRepair)
  const [statusNotes, setStatusNotes] = useState('')
  const [confirmedDamage, setConfirmedDamage] = useState<DamageLevel>(DamageLevel.Level1)
  const [savingStatus, setSavingStatus] = useState(false)

  // Conteo por colas operativas
  const counts = useMemo(() => {
    let pending = 0
    let inRepair = 0
    let ready = 0
    let dispatched = 0
    for (const e of equipments) {
      if (e.status === RepairEquipmentStatus.Received || e.status === RepairEquipmentStatus.Diagnosing) {
        pending++
      } else if (e.status === RepairEquipmentStatus.InRepair || e.status === RepairEquipmentStatus.QualityCheck) {
        inRepair++
      } else if (e.status === RepairEquipmentStatus.ReadyToDispatch) {
        ready++
      } else if (e.status === RepairEquipmentStatus.Dispatched) {
        dispatched++
      }
    }
    return {
      all: equipments.length,
      pending,
      inRepair,
      ready,
      dispatched,
    }
  }, [equipments])

  // Filtrado de equipos por cola segmentada
  const filteredEquipments = useMemo(() => {
    if (queue === 'pending') {
      return equipments.filter(
        (e) => e.status === RepairEquipmentStatus.Received || e.status === RepairEquipmentStatus.Diagnosing
      )
    }
    if (queue === 'inRepair') {
      return equipments.filter(
        (e) => e.status === RepairEquipmentStatus.InRepair || e.status === RepairEquipmentStatus.QualityCheck
      )
    }
    if (queue === 'ready') {
      return equipments.filter((e) => e.status === RepairEquipmentStatus.ReadyToDispatch)
    }
    if (queue === 'dispatched') {
      return equipments.filter((e) => e.status === RepairEquipmentStatus.Dispatched)
    }
    return equipments
  }, [equipments, queue])

  // Abrir modal de cambio de estado
  const handleOpenStatusModal = (eq: RepairEquipmentDto) => {
    setSelectedEquipment(eq)
    setTargetStatus(
      eq.status === RepairEquipmentStatus.Received
        ? RepairEquipmentStatus.Diagnosing
        : eq.status === RepairEquipmentStatus.Diagnosing
          ? RepairEquipmentStatus.InRepair
          : eq.status === RepairEquipmentStatus.InRepair
            ? RepairEquipmentStatus.QualityCheck
            : eq.status === RepairEquipmentStatus.QualityCheck
              ? RepairEquipmentStatus.ReadyToDispatch
              : eq.status
    )
    setStatusNotes('')
    setConfirmedDamage(eq.damageLevel)
    setStatusModalOpen(true)
  }

  // Guardar cambio de estado
  const handleSaveStatus = async () => {
    if (!tenantId || !selectedEquipment) return
    setSavingStatus(true)
    try {
      await updateEquipmentStatus(tenantId, selectedEquipment.id, {
        targetStatus,
        notes: statusNotes.trim() || undefined,
        confirmedDamageLevel: confirmedDamage,
      })

      toast.show({
        title: 'Estado actualizado',
        message: `Equipo ${selectedEquipment.serialNumber} pasó a ${repairEquipmentStatusLabel(targetStatus)}.`,
        variant: 'success',
      })

      setStatusModalOpen(false)
      void load({ silent: true })
    } catch (err: unknown) {
      toast.show({
        title: 'Error',
        message: readApiError(err, 'No se pudo actualizar el estado del equipo.'),
        variant: 'error',
      })
    } finally {
      setSavingStatus(false)
    }
  }

  const readyEquipmentsCount = useMemo(
    () => equipments.filter((e) => e.status === RepairEquipmentStatus.ReadyToDispatch).length,
    [equipments]
  )

  const columns = useMemo(
    (): ColumnDef<Row>[] => [
      {
        key: 'serialNumber',
        header: 'Nº Serie',
        width: 170,
        sortable: true,
        renderCell: (_v: Row['serialNumber'], row: Row) => (
          <Link
            to={`/taller/lotes/${batchId}/equipos/${row.id}`}
            className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 group"
            title="Ver gestión completa del equipo"
          >
            <span>{row.serialNumber}</span>
            <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ),
      },
      {
        key: 'model',
        header: 'Modelo',
        width: 150,
        sortable: true,
        renderCell: (_v: Row['model'], row: Row) => (
          <span className="font-medium text-slate-700 dark:text-slate-200">{row.model}</span>
        ),
      },
      {
        key: 'brand',
        header: 'Marca',
        width: 110,
        sortable: true,
        renderCell: (_v: Row['brand'], row: Row) => <span>{row.brand}</span>,
      },
      {
        key: 'damageLevel',
        header: 'Nivel Daño',
        width: 150,
        sortable: true,
        renderCell: (_v: Row['damageLevel'], row: Row) => (
          <StatusBadge tone={damageLevelBadgeTone(row.damageLevel)}>
            {damageLevelLabel(row.damageLevel)}
          </StatusBadge>
        ),
      },
      {
        key: 'status',
        header: 'Estado Actual',
        width: 160,
        sortable: true,
        renderCell: (_v: Row['status'], row: Row) => (
          <StatusBadge
            tone={repairEquipmentStatusBadgeTone(row.status)}
            withDot={row.status !== RepairEquipmentStatus.Cancelled}
          >
            {repairEquipmentStatusLabel(row.status)}
          </StatusBadge>
        ),
      },
      {
        key: 'photos',
        header: 'Evidencias',
        width: 120,
        align: 'center',
        renderCell: (_v: unknown, row: Row) => {
          const count = row.photos?.length || 0
          if (count === 0) {
            return (
              <span style={{ fontSize: '0.75rem', color: 'var(--shell-muted)' }}>
                Sin fotos
              </span>
            )
          }
          return (
            <Link
              to={`/taller/lotes/${batchId}/equipos/${row.id}`}
              className="inline-flex items-center gap-1 font-semibold text-xs text-purple-600 dark:text-purple-400 hover:underline"
              title="Ver evidencias fotográficas en la ficha del equipo"
            >
              <Camera size={13} aria-hidden />
              <span>{count} {count === 1 ? 'foto' : 'fotos'}</span>
            </Link>
          )
        },
      },
      {
        key: 'serviceFeeApplied',
        header: 'Tarifa',
        width: 90,
        align: 'right',
        renderCell: (_v: Row['serviceFeeApplied'], row: Row) => (
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {row.serviceFeeApplied ? `$${row.serviceFeeApplied.toFixed(2)}` : '—'}
          </span>
        ),
      },
      {
        key: 'id',
        header: 'Acciones',
        sticky: 'right',
        width: 110,
        align: 'center',
        renderCell: (_v: unknown, row: Row) => {
          if (batch?.status === RepairBatchStatus.Cancelled || row.status === RepairEquipmentStatus.Cancelled) {
            return (
              <span style={{ fontSize: '0.75rem', color: 'var(--shell-muted)', fontStyle: 'italic' }}>
                Inhabilitado
              </span>
            )
          }
          return (
            <div className="flex items-center justify-center gap-1">
              <GridIconButton
                icon={Eye}
                label="Gestionar ficha del equipo"
                onClick={() => navigate(`/taller/lotes/${batchId}/equipos/${row.id}`)}
              />
              {canUpdateStatus && (
                <GridIconButton
                  icon={Wrench}
                  label="Cambiar estado / Fase técnica"
                  onClick={() => handleOpenStatusModal(row)}
                />
              )}
            </div>
          )
        },
      },
    ],
    [canUpdateStatus, batch?.status, batchId, navigate]
  )

  if (!canRead) {
    return (
      <TenantSessionGate
        title="Detalle de Lote"
        lead="Trazabilidad por serie, fases operativas y evidencia fotográfica en Amazon S3."
      >
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres el permiso repairs.batches.read para visualizar el detalle de los lotes de reparación."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title={batch ? `Lote ${batch.batchNumber}` : 'Detalle de Lote'}
      lead="Trazabilidad por serie, fases operativas y evidencia fotográfica en Amazon S3."
    >
      <div className="ecu-dashboard-layout">
        <PageHeader
          title={batch ? `Lote ${batch.batchNumber}` : 'Cargando Lote...'}
          subtitle={
            batch ? (
              <span>
                Cliente: <strong>{batch.customerName}</strong>
                {batch.customerTaxId ? ` (${batch.customerTaxId})` : ''} · Recibido el{' '}
                {formatDate(batch.receivedAt)}
                {batch.contractReference ? ` · Ref: ${batch.contractReference}` : ''}
              </span>
            ) : undefined
          }
          badge={
            batch ? (
              batch.status === RepairBatchStatus.Cancelled ? (
                <StatusBadge tone="danger">Lote Anulado</StatusBadge>
              ) : (
                <StatusBadge tone="primary" withDot>
                  Avance {batch.progressPercentage}%
                </StatusBadge>
              )
            ) : undefined
          }
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/taller/lotes')}
              >
                <ArrowLeft size={16} strokeWidth={2} aria-hidden />
                Lotes
              </Button>
              {canCancelBatch && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStatusModalOpen(false)
                    setCancelError(null)
                    setCancelReason('')
                    setCancelModalOpen(true)
                  }}
                  style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#dc2626' }}
                >
                  <Ban size={16} strokeWidth={2} aria-hidden />
                  Anular Lote
                </Button>
              )}
              {readyEquipmentsCount > 0 && canDispatch && batch?.status !== RepairBatchStatus.Cancelled && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => navigate(`/taller/despachos/nuevo?batchId=${batchId}`)}
                >
                  <Truck size={16} strokeWidth={2} aria-hidden />
                  Despachar Listos ({readyEquipmentsCount})
                </Button>
              )}
              <EcuPageActions
                items={actionItems}
                variant="outline"
                triggerLabel="Acciones del lote"
                renderIcon={renderSidebarIcon}
                onNavigate={(route: string) => navigate(route)}
                onActionSelect={handleActionSelect}
              />
            </>
          }
        />

        {batch?.status === RepairBatchStatus.Cancelled && (
          <div className="ecu-alert-box ecu-alert-box--danger">
            <Ban size={20} strokeWidth={2} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 className="font-semibold text-sm m-0">Lote Anulado para Auditoría</h4>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem' }}>
                Este lote fue anulado administrativamente antes de iniciar procesos de reparación.
                Sus equipos permanecen inhabilitados y el registro se conserva exclusivamente para fines de trazabilidad y auditoría.
              </p>
              {batch.cancelledReason && (
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8125rem' }}>
                  Motivo registrado: <strong>{batch.cancelledReason}</strong>
                </p>
              )}
            </div>
          </div>
        )}

        {batch && (
          <div className="ecu-stat-grid" aria-label="Métricas del lote">
            <StatCard
              label="Total en Lote"
              value={batch.totalCount}
              icon="inventory_2"
              toneColor="#4f46e5"
              footerText="Equipos importados"
            />
            <StatCard
              label="En Proceso / Taller"
              value={batch.inRepairCount + batch.receivedCount}
              icon="build"
              toneColor="#f59e0b"
              footerText="En diagnóstico o reparación"
            />
            <StatCard
              label="Listos para Retiro"
              value={batch.readyCount}
              icon="verified"
              toneColor="#10b981"
              footerText="Control de calidad superado"
            />
            <StatCard
              label="Despachados"
              value={batch.dispatchedCount}
              icon="local_shipping"
              toneColor="#3b82f6"
              footerText="Con acta oficial entregada"
            />
          </div>
        )}

        <SectionCard
          title="Equipos del Lote"
          subtitle="Trazabilidad individual por número de serie, daño y control de avance"
          action={
            <OptionGroup
              id="batch-equipments-queue"
              name="batch-equipments-queue"
              layout="segmented"
              variant="outline"
              size={size}
              value={queue}
              onChange={setQueue}
              options={[
                { value: 'all', label: `Todos (${counts.all})` },
                { value: 'pending', label: `Recibidos (${counts.pending})` },
                { value: 'inRepair', label: `En Taller (${counts.inRepair})` },
                { value: 'ready', label: `Listos (${counts.ready})` },
                { value: 'dispatched', label: `Despachados (${counts.dispatched})` },
              ]}
            />
          }
        >
          {error && (
            <div className="ecu-form-error-banner mb-4" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          )}

          {equipments.length === 0 && !loading ? (
            <EmptyState
              icon="inventory_2"
              title="No hay equipos en este lote"
              description="Vuelve a importar el archivo Excel o revisa los filtros aplicados."
            />
          ) : (
            <DataGrid
              className="ecu-repairs-grid"
              dataSource={filteredEquipments as Row[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={300}
              searchPlaceholder="Buscar por número de serie, modelo..."
              loading={loading}
              paging={paging}
              pageSizeOptions={pageSizeOptions}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              messages={messages}
            />
          )}
        </SectionCard>

        {/* Modal Popup de Actualización de Fase / Estado */}
        <Popup
          open={statusModalOpen}
          title={`Fase Técnica — Serie ${selectedEquipment?.serialNumber ?? ''}`}
          onClose={() => setStatusModalOpen(false)}
          width="min(92vw, 32rem)"
          actions={[
            {
              id: 'cancel',
              label: 'Cancelar',
              variant: 'ghost',
              onClick: () => setStatusModalOpen(false),
              disabled: savingStatus,
            },
            {
              id: 'save',
              label: savingStatus ? 'Guardando...' : 'Confirmar Cambio de Estado',
              variant: 'primary',
              onClick: () => void handleSaveStatus(),
              disabled: savingStatus,
              loading: savingStatus,
            },
          ]}
        >
          <div className="ecu-modal-form">
            <div className="ecu-modal-form__field">
              <Select
                id="modal-target-status"
                label="Siguiente Estado / Fase Operativa *"
                labelPosition="outlined"
                variant="outline"
                options={[
                  { value: String(RepairEquipmentStatus.Diagnosing), label: '1. En Diagnóstico' },
                  { value: String(RepairEquipmentStatus.InRepair), label: '2. En Reparación' },
                  { value: String(RepairEquipmentStatus.QualityCheck), label: '3. En Control de Calidad' },
                  { value: String(RepairEquipmentStatus.ReadyToDispatch), label: '4. Listo para Retiro (Aprobado)' },
                  { value: String(RepairEquipmentStatus.Dispatched), label: '5. Despachado' },
                ]}
                value={String(targetStatus)}
                onChange={(val: string) => setTargetStatus(Number(val) as RepairEquipmentStatus)}
                fullWidth
              />
            </div>

            <div className="ecu-modal-form__field">
              <Select
                id="modal-confirmed-damage"
                label="Nivel de Daño Confirmado *"
                labelPosition="outlined"
                variant="outline"
                options={[
                  { value: String(DamageLevel.Level1), label: 'Nivel 1 (Leve / Estético)' },
                  { value: String(DamageLevel.Level2), label: 'Nivel 2 (Medio / Chapa)' },
                  { value: String(DamageLevel.Level3), label: 'Nivel 3 (Grave / Estructural)' },
                  { value: String(DamageLevel.Irreparable), label: 'Irreparable / Scrap' },
                ]}
                value={String(confirmedDamage)}
                onChange={(val: string) => setConfirmedDamage(Number(val) as DamageLevel)}
                fullWidth
              />
            </div>

            <div className="ecu-modal-form__field">
              <TextBox
                id="modal-status-notes"
                label="Notas Técnicas / Diagnóstico"
                labelPosition="outlined"
                variant="outline"
                value={statusNotes}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setStatusNotes(e.target.value)}
                placeholder="ej. Ajuste de panel frontal, prueba de centrifugado superada..."
                fullWidth
              />
            </div>
          </div>
        </Popup>

        {/* Modal Popup para Confirmar Anulación de Lote (Auditoría) */}
        <Popup
          open={cancelModalOpen}
          title="Anular Lote de Reparación"
          onClose={() => setCancelModalOpen(false)}
          width="min(92vw, 32rem)"
          actions={[
            {
              id: 'back',
              label: 'Volver',
              variant: 'ghost',
              onClick: () => setCancelModalOpen(false),
              disabled: cancellingBatch,
            },
            {
              id: 'confirm',
              label: cancellingBatch ? 'Anulando...' : 'Confirmar Anulación',
              variant: 'primary',
              onClick: () => void handleCancelBatch(),
              disabled: cancellingBatch || !cancelReason.trim(),
              loading: cancellingBatch,
            },
          ]}
        >
          <div className="ecu-modal-form">
            <div className="ecu-alert-box ecu-alert-box--warning" style={{ margin: 0 }}>
              <Ban size={18} strokeWidth={2} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.8125rem' }}>
                <strong>Acción administrativa de control:</strong>
                <p style={{ margin: '0.25rem 0 0 0' }}>
                  El lote no será eliminado físicamente de la base de datos para preservar la trazabilidad de auditoría. Todos los equipos asociados quedarán deshabilitados.
                </p>
              </div>
            </div>

            {cancelError && (
              <div className="ecu-form-error-banner" role="alert">
                <span className="material-symbols-outlined">error</span>
                <span>{cancelError}</span>
              </div>
            )}

            <div className="ecu-modal-form__field">
              <TextBox
                id="cancel-batch-reason"
                label="Motivo de Anulación *"
                labelPosition="outlined"
                variant="outline"
                value={cancelReason}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCancelReason(e.target.value)}
                placeholder="ej. Error en archivo original, lote duplicado o cancelado por cliente"
                required
                fullWidth
              />
            </div>
          </div>
        </Popup>
      </div>
    </TenantSessionGate>
  )
}
