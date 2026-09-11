import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, DataGrid, Popup, Select, TextBox, useToast, type ColumnDef, type PageActionItem } from 'glubox'
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
  Image as ImageIcon,
  Truck,
  Upload,
  Wrench,
  Trash2,
  Eye,
} from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate, formatDateTime } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  cancelRepairBatch,
  deleteRepairEquipmentPhoto,
  getRepairBatch,
  listBatchEquipments,
  listEquipmentPhotos,
  updateEquipmentStatus,
  uploadRepairEquipmentPhoto,
} from '@/services/repairsApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  DamageLevel,
  damageLevelBadgeTone,
  damageLevelLabel,
  PhotoStage,
  photoStageLabel,
  RepairBatchStatus,
  RepairEquipmentStatus,
  repairEquipmentStatusBadgeTone,
  repairEquipmentStatusLabel,
  type BatchDetailDto,
  type RepairEquipmentDto,
  type RepairEquipmentPhotoDto,
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
  const canUploadPhoto = useHasPermission('repairs.equipments.upload.photo') || canUpdateStatus
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
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)
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

  // Modal Fotos S3
  const [photosModalOpen, setPhotosModalOpen] = useState(false)
  const [photoEquipment, setPhotoEquipment] = useState<RepairEquipmentDto | null>(null)
  const [photos, setPhotos] = useState<RepairEquipmentPhotoDto[]>([])
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoStage, setPhotoStage] = useState<PhotoStage>(PhotoStage.DamageInitial)
  const [photoCaption, setPhotoCaption] = useState('')
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null)
  const [previewPhoto, setPreviewPhoto] = useState<RepairEquipmentPhotoDto | null>(null)

  // Filtrado de equipos
  const filteredEquipments = useMemo(() => {
    if (statusFilter === 'all') return equipments
    const statusNum = Number(statusFilter)
    return equipments.filter((e) => e.status === statusNum)
  }, [equipments, statusFilter])

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

  // Abrir modal de fotos S3
  const handleOpenPhotosModal = async (eq: RepairEquipmentDto) => {
    if (!tenantId) return
    setPhotoEquipment(eq)
    setPhotosModalOpen(true)
    setLoadingPhotos(true)
    setPhotoCaption('')
    try {
      const list = await listEquipmentPhotos(tenantId, eq.id)
      setPhotos(list)
    } catch {
      setPhotos([])
    } finally {
      setLoadingPhotos(false)
    }
  }

  // Subida de foto con optimización WebP en Backblaze B2
  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !tenantId || !photoEquipment) return

    if (file.size > 15 * 1024 * 1024) {
      toast.show({
        title: 'Archivo muy grande',
        message: 'La fotografía no debe superar el límite de 15 MB.',
        variant: 'error',
      })
      e.target.value = ''
      return
    }

    setUploadingPhoto(true)
    try {
      await uploadRepairEquipmentPhoto(
        tenantId,
        photoEquipment.id,
        file,
        photoStage,
        photoCaption.trim() || undefined
      )

      toast.show({
        title: 'Evidencia procesada',
        message: 'Fotografía optimizada en WebP y guardada en Backblaze B2.',
        variant: 'success',
      })

      // Recargar fotos del modal y refrescar equipos para actualizar miniatura de tabla
      const updated = await listEquipmentPhotos(tenantId, photoEquipment.id)
      setPhotos(updated)
      setPhotoCaption('')
      void load({ silent: true })
    } catch (err: unknown) {
      toast.show({
        title: 'Error de subida',
        message: readApiError(err, 'No se pudo guardar la fotografía en el bucket de almacenamiento.'),
        variant: 'error',
      })
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
    }
  }

  const handleDeletePhoto = async (photoId: string) => {
    if (!tenantId || !photoEquipment || deletingPhotoId) return

    setDeletingPhotoId(photoId)
    try {
      await deleteRepairEquipmentPhoto(tenantId, photoEquipment.id, photoId)
      toast.show({
        title: 'Foto eliminada',
        message: 'La evidencia fotográfica fue eliminada del almacenamiento.',
        variant: 'success',
      })

      const updated = await listEquipmentPhotos(tenantId, photoEquipment.id)
      setPhotos(updated)
      if (previewPhoto?.id === photoId) {
        setPreviewPhoto(null)
      }
      void load({ silent: true })
    } catch (err: unknown) {
      toast.show({
        title: 'Error al eliminar',
        message: readApiError(err, 'No fue posible eliminar la fotografía.'),
        variant: 'error',
      })
    } finally {
      setDeletingPhotoId(null)
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
        header: 'Fotos',
        width: 90,
        sortable: false,
        align: 'center',
        renderCell: (_v: unknown, row: Row) => {
          const photoCount = row.photos?.length ?? 0
          return (
            <button
              type="button"
              onClick={() => void handleOpenPhotosModal(row)}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-colors hover:bg-[var(--glb-surface-muted)] border border-[var(--shell-border)] cursor-pointer"
              title={photoCount > 0 ? `${photoCount} foto(s) de evidencia` : 'Gestionar fotos'}
            >
              <Camera size={13} className={photoCount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-[var(--glb-muted)]'} />
              <span className={photoCount > 0 ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-[var(--glb-muted)]'}>
                {photoCount}
              </span>
            </button>
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
        width: 150,
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
              {canUploadPhoto && (
                <GridIconButton
                  icon={Camera}
                  label="Fotos de evidencia S3"
                  onClick={() => void handleOpenPhotosModal(row)}
                />
              )}
            </div>
          )
        },
      },
    ],
    [canUpdateStatus, canUploadPhoto, batch?.status, batchId, navigate]
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
                    setPhotosModalOpen(false)
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
            <div className="flex items-center gap-2">
              <Select
                id="filter-equipment-status"
                label="Filtrar por estado / fase"
                width="240px"
                labelPosition="outlined"
                variant="outline"
                options={[
                  { value: 'all', label: 'Todos los equipos' },
                  { value: String(RepairEquipmentStatus.Received), label: 'Recibido' },
                  { value: String(RepairEquipmentStatus.Diagnosing), label: 'En Diagnóstico' },
                  { value: String(RepairEquipmentStatus.InRepair), label: 'En Reparación' },
                  { value: String(RepairEquipmentStatus.QualityCheck), label: 'Control de Calidad' },
                  { value: String(RepairEquipmentStatus.ReadyToDispatch), label: 'Listo para Retiro' },
                  { value: String(RepairEquipmentStatus.Dispatched), label: 'Despachado' },
                  { value: String(RepairEquipmentStatus.Irreparable), label: 'Irreparable / Scrap' },
                  { value: String(RepairEquipmentStatus.Cancelled), label: 'Sin Procesar (Lote Anulado)' },
                ]}
                value={statusFilter}
                onChange={(val: string) => setStatusFilter(val)}
              />
            </div>
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

        {/* Modal Popup Fotos (Evidencia B2 / WebP) */}
        <Popup
          open={photosModalOpen}
          title={`Evidencia Fotográfica — Serie ${photoEquipment?.serialNumber ?? ''}`}
          onClose={() => {
            setPhotosModalOpen(false)
            setPreviewPhoto(null)
          }}
          width="min(96vw, 48rem)"
          actions={[
            {
              id: 'close',
              label: 'Cerrar',
              variant: 'outline',
              onClick: () => {
                setPhotosModalOpen(false)
                setPreviewPhoto(null)
              },
            },
          ]}
        >
          <div className="ecu-modal-form">
            {/* Formulario de carga con optimización WebP */}
            {canUploadPhoto && (
              <div className="ecu-modal-panel">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="ecu-modal-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                    <Upload size={14} strokeWidth={2} style={{ color: 'var(--shell-primary)' }} aria-hidden />
                    Subir nueva fotografía de evidencia
                  </h3>
                  <span className="text-[11px] text-[var(--glb-muted)]">
                    Optimización WebP Full HD en Backblaze B2
                  </span>
                </div>

                <div className="ecu-modal-form__grid">
                  <div className="ecu-modal-form__field">
                    <Select
                      id="photo-stage-select"
                      label="Etapa / Momento *"
                      labelPosition="outlined"
                      variant="outline"
                      options={[
                        { value: String(PhotoStage.DamageInitial), label: '1. Daño Inicial / Recepción (Reclamo Aseguradora)' },
                        { value: String(PhotoStage.InRepair), label: '2. En Proceso de Reparación / Despiece' },
                        { value: String(PhotoStage.QualityFinal), label: '3. Control de Calidad Final / Aprobado' },
                      ]}
                      value={String(photoStage)}
                      onChange={(val: string) => setPhotoStage(Number(val) as PhotoStage)}
                      fullWidth
                    />
                  </div>
                  <div className="ecu-modal-form__field">
                    <TextBox
                      id="photo-caption-input"
                      label="Descripción / Nota de la evidencia"
                      labelPosition="outlined"
                      variant="outline"
                      value={photoCaption}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setPhotoCaption(e.target.value)}
                      placeholder="ej. Abolladura en lateral derecho, tina fisurada..."
                      fullWidth
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    {/* Input estándar de archivo */}
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      id="photo-upload-input"
                      style={{ display: 'none' }}
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => document.getElementById('photo-upload-input')?.click()}
                      disabled={uploadingPhoto}
                    >
                      <Upload size={15} strokeWidth={2} aria-hidden />
                      {uploadingPhoto ? 'Procesando WebP...' : 'Seleccionar Archivo'}
                    </Button>

                    {/* Input directo de cámara para tablets o teléfonos móviles */}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      id="photo-camera-input"
                      style={{ display: 'none' }}
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('photo-camera-input')?.click()}
                      disabled={uploadingPhoto}
                    >
                      <Camera size={15} strokeWidth={2} aria-hidden />
                      Tomar Foto
                    </Button>
                  </div>

                  {uploadingPhoto && (
                    <span className="text-xs font-medium text-[var(--shell-primary)] flex items-center gap-1.5 animate-pulse">
                      Optimizando y transmitiendo a Backblaze B2...
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Galería de fotos */}
            <div className="ecu-modal-panel">
              <h3 className="ecu-modal-section-title">
                Fotografías registradas ({photos.length} de 15 máx.)
              </h3>
              {loadingPhotos ? (
                <p className="ecu-modal-section-lead" style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                  Cargando fotos de almacenamiento...
                </p>
              ) : photos.length === 0 ? (
                <EmptyState
                  className="ecu-empty-state--compact ecu-empty-state--in-panel"
                  icon={<ImageIcon size={22} strokeWidth={1.75} aria-hidden />}
                  title="Sin evidencia fotográfica"
                  description="Aún no hay fotos registradas para este equipo. Sube fotos del daño o proceso técnico."
                />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(11rem, 1fr))', gap: '0.85rem' }}>
                  {photos.map((p) => {
                    const isDeleting = deletingPhotoId === p.id
                    return (
                      <div
                        key={p.id}
                        className="group relative flex flex-col rounded-xl overflow-hidden border border-[var(--shell-border)] bg-[var(--glb-surface)] shadow-sm hover:shadow transition-all"
                      >
                        {/* Contenedor imagen */}
                        <div className="relative aspect-video w-full bg-[var(--glb-surface-muted)] overflow-hidden">
                          <img
                            src={p.downloadUrl}
                            alt={p.caption ?? p.fileName}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                          {/* Overlay de acciones */}
                          <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              type="button"
                              title="Ver en tamaño completo"
                              onClick={() => setPreviewPhoto(p)}
                              className="p-1.5 rounded-full bg-white/90 text-slate-800 hover:bg-white transition-colors cursor-pointer shadow"
                            >
                              <Eye size={15} />
                            </button>
                            {canUploadPhoto && (
                              <button
                                type="button"
                                title="Eliminar fotografía"
                                disabled={isDeleting}
                                onClick={() => void handleDeletePhoto(p.id)}
                                className="p-1.5 rounded-full bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer shadow disabled:opacity-50"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Metadatos inferiores */}
                        <div className="p-2.5 flex flex-col gap-1 text-xs flex-1">
                          <StatusBadge tone="info">{photoStageLabel(p.stage)}</StatusBadge>
                          {p.caption && (
                            <p className="font-medium text-[var(--shell-text)] line-clamp-2" title={p.caption}>
                              {p.caption}
                            </p>
                          )}
                          <div className="mt-auto pt-1 flex items-center justify-between text-[10px] text-[var(--glb-muted)]">
                            <span>{formatDateTime(p.capturedAt)}</span>
                            {p.fileSizeBytes ? <span>{Math.round(p.fileSizeBytes / 1024)} KB</span> : null}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </Popup>

        {/* Modal Lightbox de Previsualización en Alta Resolución */}
        {previewPhoto && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
            onClick={() => setPreviewPhoto(null)}
          >
            <div
              className="bg-[var(--glb-surface)] rounded-2xl max-w-3xl w-full p-4 border border-[var(--shell-border)] shadow-2xl space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusBadge tone="info">{photoStageLabel(previewPhoto.stage)}</StatusBadge>
                  <span className="text-sm font-semibold text-[var(--glb-text)]">
                    {previewPhoto.caption || previewPhoto.fileName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={previewPhoto.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--shell-primary)] hover:underline flex items-center gap-1 font-medium"
                  >
                    Abrir WebP
                  </a>
                  <button
                    type="button"
                    className="text-xs font-semibold px-2 py-1 rounded bg-[var(--glb-surface-muted)] text-[var(--glb-muted)] hover:text-[var(--glb-text)]"
                    onClick={() => setPreviewPhoto(null)}
                  >
                    ✕ Cerrar
                  </button>
                </div>
              </div>
              <div className="max-h-[70vh] flex items-center justify-center overflow-hidden rounded-lg bg-black/20">
                <img
                  src={previewPhoto.downloadUrl}
                  alt={previewPhoto.caption ?? previewPhoto.fileName}
                  className="max-h-[70vh] max-w-full object-contain rounded"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--glb-muted)] pt-1">
                <span>Capturada: {formatDateTime(previewPhoto.capturedAt)}</span>
                <span>{previewPhoto.fileName}</span>
              </div>
            </div>
          </div>
        )}

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
