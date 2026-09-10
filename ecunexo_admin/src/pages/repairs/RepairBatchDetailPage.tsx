import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
  Camera,
  Image as ImageIcon,
  Truck,
  Upload,
  Wrench,
} from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate, formatDateTime } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  confirmPhotoUpload,
  getPhotoUploadUrl,
  getRepairBatch,
  listBatchEquipments,
  listEquipmentPhotos,
  updateEquipmentStatus,
} from '@/services/repairsApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  DamageLevel,
  damageLevelBadgeTone,
  damageLevelLabel,
  PhotoStage,
  photoStageLabel,
  RepairEquipmentStatus,
  repairEquipmentStatusBadgeTone,
  repairEquipmentStatusLabel,
  type BatchDetailDto,
  type RepairEquipmentDto,
  type RepairEquipmentPhotoDto,
} from '@/types/repairsApi'

type Row = RepairEquipmentDto & Record<string, unknown>

const messages = createSpanishDataGridMessages('equipo', 'equipos')

export function RepairBatchDetailPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { batchId } = useParams<{ batchId: string }>()
  const tenantId = useAppSelector(selectTenantId)

  const canRead = useHasPermission('repairs.batches.read')
  const canUpdateStatus = useHasPermission('repairs.equipments.update.status')
  const canUploadPhoto = useHasPermission('repairs.equipments.upload.photo')
  const canDispatch = useHasPermission('repairs.dispatches.create')
  const canReadDispatches = useHasPermission('repairs.dispatches.read')

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

  // Subida de foto a S3 (Presigned PUT directo, Cero-Blob)
  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !tenantId || !photoEquipment) return

    setUploadingPhoto(true)
    try {
      // 1. Obtener URL prefirmada
      const presigned = await getPhotoUploadUrl(
        tenantId,
        photoEquipment.id,
        photoStage.toString(),
        file.name,
        file.type || 'image/jpeg'
      )

      // 2. Subir directamente a Amazon S3
      const uploadRes = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'image/jpeg',
        },
        body: file,
      })

      if (!uploadRes.ok) {
        throw new Error('Error al subir el archivo directamente a Amazon S3.')
      }

      // 3. Confirmar registro en backend (metadata ligera)
      await confirmPhotoUpload(tenantId, photoEquipment.id, {
        stage: photoStage,
        s3Bucket: presigned.s3Bucket,
        s3Key: presigned.s3Key,
        fileName: file.name,
        fileSizeBytes: file.size,
        contentType: file.type || 'image/jpeg',
        caption: photoCaption.trim() || undefined,
      })

      toast.show({
        title: 'Foto archivada en S3',
        message: 'Evidencia registrada bajo principio Cero-Blob.',
        variant: 'success',
      })

      // Recargar fotos
      const updated = await listEquipmentPhotos(tenantId, photoEquipment.id)
      setPhotos(updated)
      setPhotoCaption('')
    } catch (err: unknown) {
      toast.show({
        title: 'Error de subida',
        message: readApiError(err, 'No se pudo guardar la fotografía en el bucket.'),
        variant: 'error',
      })
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
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
          <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
            {row.serialNumber}
          </span>
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
          <StatusBadge tone={repairEquipmentStatusBadgeTone(row.status)} withDot>
            {repairEquipmentStatusLabel(row.status)}
          </StatusBadge>
        ),
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
        width: 130,
        align: 'center',
        renderCell: (_v: unknown, row: Row) => (
          <div className="flex items-center justify-center gap-1">
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
        ),
      },
    ],
    [canUpdateStatus, canUploadPhoto]
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
              <StatusBadge tone="primary" withDot>
                Avance {batch.progressPercentage}%
              </StatusBadge>
            ) : undefined
          }
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/taller/lotes')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Lotes
              </Button>
              {readyEquipmentsCount > 0 && canDispatch && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => navigate(`/taller/despachos?batchId=${batchId}`)}
                >
                  <Truck className="w-4 h-4 mr-2" />
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
                label="Filtrar por fase"
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
          <div className="space-y-4" style={{ paddingTop: '0.5rem' }}>
            <div>
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

            <div>
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

            <div>
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

        {/* Modal Popup Fotos S3 (Cero-Blob) */}
        <Popup
          open={photosModalOpen}
          title={`Evidencia Fotográfica en S3 — Serie ${photoEquipment?.serialNumber ?? ''}`}
          onClose={() => setPhotosModalOpen(false)}
          width="min(96vw, 44rem)"
          actions={[
            {
              id: 'close',
              label: 'Cerrar',
              variant: 'outline',
              onClick: () => setPhotosModalOpen(false),
            },
          ]}
        >
          <div className="space-y-6" style={{ paddingTop: '0.5rem' }}>
            {/* Formulario de carga rápida a S3 */}
            {canUploadPhoto && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-indigo-500" />
                  Subir Nueva Fotografía
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <Select
                      id="photo-stage-select"
                      label="Etapa / Momento *"
                      labelPosition="outlined"
                      variant="outline"
                      options={[
                        { value: String(PhotoStage.DamageInitial), label: 'Daño Inicial / Recepción' },
                        { value: String(PhotoStage.InRepair), label: 'En Proceso de Reparación' },
                        { value: String(PhotoStage.QualityFinal), label: 'Control de Calidad Final' },
                      ]}
                      value={String(photoStage)}
                      onChange={(val: string) => setPhotoStage(Number(val) as PhotoStage)}
                      fullWidth
                    />
                  </div>
                  <div>
                    <TextBox
                      id="photo-caption-input"
                      label="Descripción / Nota de la foto"
                      labelPosition="outlined"
                      variant="outline"
                      value={photoCaption}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setPhotoCaption(e.target.value)}
                      placeholder="ej. Abolladura lateral derecha..."
                      fullWidth
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <input
                    type="file"
                    accept="image/*"
                    id="photo-upload-input"
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                  />
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => document.getElementById('photo-upload-input')?.click()}
                    disabled={uploadingPhoto}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {uploadingPhoto ? 'Subiendo a S3...' : 'Seleccionar Foto'}
                  </Button>
                  {uploadingPhoto && (
                    <span className="text-xs text-indigo-600 animate-pulse font-medium">
                      Transmitiendo al bucket Amazon S3...
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Galería de fotos */}
            <div>
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                Fotos Registradas ({photos.length})
              </h3>
              {loadingPhotos ? (
                <p className="text-xs text-slate-500 py-4 text-center">Cargando fotos de S3...</p>
              ) : photos.length === 0 ? (
                <div className="p-8 text-center bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                  <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">
                    Aún no hay fotos registradas para este equipo.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {photos.map((p) => (
                    <div
                      key={p.id}
                      className="group relative rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-950 flex flex-col"
                    >
                      <img
                        src={p.downloadUrl}
                        alt={p.caption ?? p.fileName}
                        className="w-full h-32 object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="p-2 bg-white dark:bg-slate-800 text-xs flex-1 flex flex-col justify-between">
                        <div>
                          <StatusBadge tone="info">{photoStageLabel(p.stage)}</StatusBadge>
                          {p.caption && (
                            <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-1 font-medium">
                              {p.caption}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {formatDateTime(p.capturedAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Popup>
      </div>
    </TenantSessionGate>
  )
}
