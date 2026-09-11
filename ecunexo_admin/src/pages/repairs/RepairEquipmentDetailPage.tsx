import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Popup, Select, TextBox, useToast } from 'glubox'
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import {
  ArrowLeft,
  Calendar,
  Camera,
  Clock,
  Cpu,
  DollarSign,
  ExternalLink,
  Eye,
  Tag,
  Trash2,
  Wrench,
} from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate, formatDateTime } from '@/lib/formatDate'
import { readApiError } from '@/lib/readApiError'
import {
  deleteRepairEquipmentPhoto,
  getRepairEquipment,
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
  photoStageBadgeTone,
  photoStageLabel,
  PhotoStage,
  RepairEquipmentStatus,
  repairEquipmentStatusBadgeTone,
  repairEquipmentStatusLabel,
  type RepairEquipmentDetailDto,
  type RepairEquipmentPhotoDto,
} from '@/types/repairsApi'

export function RepairEquipmentDetailPage() {
  const { batchId, equipmentId } = useParams<{ batchId: string; equipmentId: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)

  const canRead = useHasPermission('repairs.batches.read') || useHasPermission('repairs.b2b.portal.view')
  const canUpdateStatus = useHasPermission('repairs.equipments.update.status')
  const canUploadPhoto = useHasPermission('repairs.equipments.upload.photo')

  const [loading, setLoading] = useState(true)
  const [equipment, setEquipment] = useState<RepairEquipmentDetailDto | null>(null)
  const [photos, setPhotos] = useState<RepairEquipmentPhotoDto[]>([])
  const [activePhotoTab, setActivePhotoTab] = useState<string>('all')

  // Modals
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [targetStatus, setTargetStatus] = useState<RepairEquipmentStatus>(RepairEquipmentStatus.InRepair)
  const [statusNotes, setStatusNotes] = useState('')
  const [confirmedDamage, setConfirmedDamage] = useState<DamageLevel>(DamageLevel.Level1)
  const [serviceFee, setServiceFee] = useState<string>('')
  const [savingStatus, setSavingStatus] = useState(false)

  // Subida de fotos
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoStage, setPhotoStage] = useState<PhotoStage>(PhotoStage.DamageInitial)
  const [photoCaption, setPhotoCaption] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null)

  // Lightbox
  const [lightboxPhoto, setLightboxPhoto] = useState<RepairEquipmentPhotoDto | null>(null)

  const loadData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!tenantId || !equipmentId) return
      if (!options?.silent) setLoading(true)
      try {
        const data = await getRepairEquipment(tenantId, equipmentId)
        setEquipment(data)
        setPhotos(data.photos || [])
      } catch (err: unknown) {
        toast.show({
          title: 'Error al cargar equipo',
          message: readApiError(err, 'No se pudo obtener el detalle del equipo.'),
          variant: 'error',
        })
      } finally {
        if (!options?.silent) setLoading(false)
      }
    },
    [tenantId, equipmentId, toast]
  )

  useEffect(() => {
    if (canRead && tenantId && equipmentId) {
      void loadData()
    }
  }, [canRead, tenantId, equipmentId, loadData])

  // Custom attributes parsed
  const parsedCustomAttributes = useMemo(() => {
    if (!equipment?.customAttributesJson) return []
    try {
      const parsed = JSON.parse(equipment.customAttributesJson)
      if (typeof parsed === 'object' && parsed !== null) {
        return Object.entries(parsed).filter(
          ([, v]) => v !== null && v !== undefined && String(v).trim() !== ''
        )
      }
    } catch {
      // Ignorar json inválido
    }
    return []
  }, [equipment?.customAttributesJson])

  // Filtrado de fotos por pestaña
  const filteredPhotos = useMemo(() => {
    if (activePhotoTab === 'all') return photos
    const stageNum = Number(activePhotoTab)
    return photos.filter((p) => p.stage === stageNum)
  }, [photos, activePhotoTab])

  // Abrir modal de cambio de estado
  const handleOpenStatusModal = () => {
    if (!equipment) return
    setTargetStatus(
      equipment.status === RepairEquipmentStatus.Received
        ? RepairEquipmentStatus.Diagnosing
        : equipment.status === RepairEquipmentStatus.Diagnosing
          ? RepairEquipmentStatus.InRepair
          : equipment.status === RepairEquipmentStatus.InRepair
            ? RepairEquipmentStatus.QualityCheck
            : equipment.status === RepairEquipmentStatus.QualityCheck
              ? RepairEquipmentStatus.ReadyToDispatch
              : equipment.status
    )
    setStatusNotes('')
    setConfirmedDamage(equipment.damageLevel)
    setServiceFee(equipment.serviceFeeApplied ? String(equipment.serviceFeeApplied) : '')
    setStatusModalOpen(true)
  }

  // Guardar cambio de estado
  const handleSaveStatus = async () => {
    if (!tenantId || !equipment) return
    setSavingStatus(true)
    try {
      const feeNum = serviceFee.trim() ? parseFloat(serviceFee.replace(',', '.')) : undefined
      await updateEquipmentStatus(tenantId, equipment.id, {
        targetStatus,
        notes: statusNotes.trim() || undefined,
        confirmedDamageLevel: confirmedDamage,
        serviceFee: feeNum !== undefined && !isNaN(feeNum) ? feeNum : undefined,
      })

      toast.show({
        title: 'Estado actualizado',
        message: `Equipo pasó a ${repairEquipmentStatusLabel(targetStatus)}.`,
        variant: 'success',
      })

      setStatusModalOpen(false)
      void loadData({ silent: true })
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

  // Manejar selección de archivo para evidencia
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 15 * 1024 * 1024) {
      toast.show({
        title: 'Archivo muy pesado',
        message: 'La imagen no debe superar los 15 MB.',
        variant: 'error',
      })
      e.target.value = ''
      return
    }

    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
  }

  const handleUploadPhoto = async () => {
    if (!tenantId || !equipment || !selectedFile) return
    setUploadingPhoto(true)
    try {
      await uploadRepairEquipmentPhoto(
        tenantId,
        equipment.id,
        selectedFile,
        photoStage,
        photoCaption.trim() || undefined
      )

      toast.show({
        title: 'Evidencia registrada',
        message: 'Fotografía optimizada y almacenada en Backblaze B2 / S3.',
        variant: 'success',
      })

      setUploadModalOpen(false)
      setSelectedFile(null)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }
      setPhotoCaption('')

      // Recargar fotos
      const updatedPhotos = await listEquipmentPhotos(tenantId, equipment.id)
      setPhotos(updatedPhotos)
    } catch (err: unknown) {
      toast.show({
        title: 'Error al subir foto',
        message: readApiError(err, 'No se pudo registrar la evidencia fotográfica.'),
        variant: 'error',
      })
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleDeletePhoto = async (photoId: string) => {
    if (!tenantId || !equipment || deletingPhotoId) return
    if (!window.confirm('¿Desea eliminar permanentemente esta evidencia fotográfica?')) return

    setDeletingPhotoId(photoId)
    try {
      await deleteRepairEquipmentPhoto(tenantId, equipment.id, photoId)
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
      toast.show({
        title: 'Foto eliminada',
        message: 'La fotografía fue eliminada de los registros.',
        variant: 'info',
      })
      if (lightboxPhoto?.id === photoId) {
        setLightboxPhoto(null)
      }
    } catch (err: unknown) {
      toast.show({
        title: 'Error al eliminar',
        message: readApiError(err, 'No se pudo eliminar la fotografía.'),
        variant: 'error',
      })
    } finally {
      setDeletingPhotoId(null)
    }
  }

  if (!canRead) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <EmptyState
          title="Acceso restringido"
          description="No dispones de permisos suficientes para consultar la ficha de este equipo."
          action={
            <Button variant="secondary" onClick={() => navigate(-1)}>
              <ArrowLeft size={16} className="mr-1.5" />
              Regresar
            </Button>
          }
        />
      </div>
    )
  }

  if (loading && !equipment) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto animate-pulse">
        <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
    )
  }

  if (!equipment) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <EmptyState
          title="Equipo no encontrado"
          description="El electrodoméstico o equipo solicitado no existe o fue removido."
          action={
            <Button
              variant="secondary"
              onClick={() => navigate(batchId ? `/taller/lotes/${batchId}` : '/taller/lotes')}
            >
              <ArrowLeft size={16} className="mr-1.5" />
              Volver al lote
            </Button>
          }
        />
      </div>
    )
  }

  const isCancelled = equipment.status === RepairEquipmentStatus.Cancelled

  return (
    <TenantSessionGate
      title="Ficha del Equipo"
      lead="Gestión operativa, trazabilidad y evidencias fotográficas."
    >
      <div className="ecu-dashboard-layout">
        {/* Header Principal */}
        <PageHeader
          title={`Equipo: ${equipment.serialNumber}`}
          subtitle={`${equipment.brand} · ${equipment.model} ${
            equipment.productLine ? `· Línea ${equipment.productLine}` : ''
          }`}
          badge={
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                tone={repairEquipmentStatusBadgeTone(equipment.status)}
                withDot={!isCancelled}
              >
                {repairEquipmentStatusLabel(equipment.status)}
              </StatusBadge>
              <StatusBadge tone={damageLevelBadgeTone(equipment.damageLevel)}>
                {damageLevelLabel(equipment.damageLevel)}
              </StatusBadge>
              {equipment.passedQualityCheck !== null && (
                <StatusBadge tone={equipment.passedQualityCheck ? 'success' : 'danger'}>
                  {equipment.passedQualityCheck ? 'QC Aprobado' : 'QC Rechazado'}
                </StatusBadge>
              )}
            </div>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => navigate(`/taller/lotes/${equipment.batchId}`)}
                title="Regresar a la lista de equipos del lote"
              >
                <ArrowLeft size={16} className="mr-1.5" />
                Volver al Lote
              </Button>

              {canUpdateStatus && !isCancelled && (
                <Button
                  variant="primary"
                  onClick={handleOpenStatusModal}
                  title="Cambiar fase operativa o registrar notas técnicas"
                >
                  <Wrench size={16} className="mr-1.5" />
                  Actualizar Estado
                </Button>
              )}

              {canUploadPhoto && !isCancelled && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelectedFile(null)
                    setPreviewUrl(null)
                    setPhotoCaption('')
                    setUploadModalOpen(true)
                  }}
                  title="Cargar foto de evidencia S3"
                >
                  <Camera size={16} className="mr-1.5" />
                  Subir Evidencia
                </Button>
              )}
            </div>
          }
        />

        {/* KPI StatCards */}
        <div className="ecu-stat-grid">
          <StatCard
            label="Identificación"
            value={equipment.serialNumber}
            footerText={`${equipment.brand} - ${equipment.model}`}
            icon={<Cpu size={22} className="text-blue-500" />}
          />
          <StatCard
            label="Fase Operativa"
            value={repairEquipmentStatusLabel(equipment.status)}
            footerText={equipment.updatedAt ? `Act.: ${formatDate(equipment.updatedAt)}` : 'Sin cambios'}
            icon={<Wrench size={22} className="text-amber-500" />}
          />
          <StatCard
            label="Nivel & Tarifa"
            value={damageLevelLabel(equipment.damageLevel)}
            footerText={
              equipment.serviceFeeApplied
                ? `Tarifa: $${equipment.serviceFeeApplied.toFixed(2)}`
                : 'Tarifa pendiente'
            }
            icon={<DollarSign size={22} className="text-emerald-500" />}
          />
          <StatCard
            label="Evidencias S3"
            value={`${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'}`}
            footerText="Cloud Storage B2"
            icon={<Camera size={22} className="text-purple-500" />}
          />
        </div>

        {/* Grid de 2 Columnas: Ficha Técnica & Auditoría */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda (2 cols): Datos Técnicos y Fases */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ficha Técnica */}
            <SectionCard
              title="Especificaciones & Datos de Entrada"
              subtitle="Información de origen proporcionada en el manifiesto o plantilla Excel del lote."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="p-3.5 rounded-lg bg-[var(--glb-surface-muted)] border border-[var(--shell-border)]">
                  <span className="text-xs font-medium text-[var(--glb-muted)] block mb-1">
                    Número de Serie
                  </span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-100 select-all">
                    {equipment.serialNumber}
                  </span>
                </div>

                <div className="p-3.5 rounded-lg bg-[var(--glb-surface-muted)] border border-[var(--shell-border)]">
                  <span className="text-xs font-medium text-[var(--glb-muted)] block mb-1">Marca</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {equipment.brand}
                  </span>
                </div>

                <div className="p-3.5 rounded-lg bg-[var(--glb-surface-muted)] border border-[var(--shell-border)]">
                  <span className="text-xs font-medium text-[var(--glb-muted)] block mb-1">Modelo</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {equipment.model}
                  </span>
                </div>

                <div className="p-3.5 rounded-lg bg-[var(--glb-surface-muted)] border border-[var(--shell-border)]">
                  <span className="text-xs font-medium text-[var(--glb-muted)] block mb-1">
                    Línea de Producto
                  </span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {equipment.productLine || 'General / No especificada'}
                  </span>
                </div>

                <div className="p-3.5 rounded-lg bg-[var(--glb-surface-muted)] border border-[var(--shell-border)]">
                  <span className="text-xs font-medium text-[var(--glb-muted)] block mb-1">Lote Padre</span>
                  <Link
                    to={`/taller/lotes/${equipment.batchId}`}
                    className="font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>{equipment.batchNumber ? `#${equipment.batchNumber}` : 'Ver Lote'}</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>

                <div className="p-3.5 rounded-lg bg-[var(--glb-surface-muted)] border border-[var(--shell-border)]">
                  <span className="text-xs font-medium text-[var(--glb-muted)] block mb-1">Cliente B2B</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                    {equipment.customerName || 'No asignado'}
                  </span>
                </div>
              </div>

              {/* Atributos Personalizados si existen */}
              {parsedCustomAttributes.length > 0 && (
                <div className="mt-5 pt-4 border-t border-[var(--shell-border)]">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--glb-muted)] mb-3 flex items-center gap-1.5">
                    <Tag size={13} />
                    Atributos Adicionales de la Plantilla
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {parsedCustomAttributes.map(([key, value]) => (
                      <div
                        key={key}
                        className="px-3 py-2 rounded-md bg-[var(--glb-surface)] border border-[var(--shell-border)] text-xs"
                      >
                        <span className="text-[var(--glb-muted)] block font-medium capitalize">
                          {key.replace(/_/g, ' ')}:
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Fases Operativas y Notas de Taller */}
            <SectionCard
              title="Diagnóstico, Reparación & Control de Calidad"
              subtitle="Notas técnicas registradas por el personal operativo a lo largo del flujo de trabajo."
            >
              <div className="space-y-4">
                {/* Diagnóstico */}
                <div className="p-4 rounded-xl border border-[var(--shell-border)] bg-[var(--glb-surface-muted)]/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                        Diagnóstico Técnico
                      </h4>
                    </div>
                    <span className="text-xs text-[var(--glb-muted)]">
                      {equipment.diagnosedAt ? formatDateTime(equipment.diagnosedAt) : 'No diagnosticado aún'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line bg-[var(--glb-surface)] p-3 rounded-lg border border-[var(--shell-border)]">
                    {equipment.diagnosticNotes || 'Sin notas de diagnóstico registradas.'}
                  </p>
                </div>

                {/* Reparación */}
                <div className="p-4 rounded-xl border border-[var(--shell-border)] bg-[var(--glb-surface-muted)]/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                        Trabajo de Reparación
                      </h4>
                    </div>
                    <span className="text-xs text-[var(--glb-muted)]">
                      {equipment.repairedAt ? formatDateTime(equipment.repairedAt) : 'Reparación pendiente'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line bg-[var(--glb-surface)] p-3 rounded-lg border border-[var(--shell-border)]">
                    {equipment.repairNotes || 'Sin notas de reparación registradas.'}
                  </p>
                </div>

                {/* Control de Calidad */}
                <div className="p-4 rounded-xl border border-[var(--shell-border)] bg-[var(--glb-surface-muted)]/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          equipment.passedQualityCheck === true
                            ? 'bg-emerald-500'
                            : equipment.passedQualityCheck === false
                              ? 'bg-rose-500'
                              : 'bg-slate-400'
                        }`}
                      />
                      <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                        Control de Calidad (QC)
                      </h4>
                      {equipment.passedQualityCheck !== null && (
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                            equipment.passedQualityCheck
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {equipment.passedQualityCheck ? 'Aprobado' : 'Rechazado'}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--glb-muted)]">
                      {equipment.qualityCheckedAt
                        ? formatDateTime(equipment.qualityCheckedAt)
                        : 'QC pendiente'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line bg-[var(--glb-surface)] p-3 rounded-lg border border-[var(--shell-border)]">
                    {equipment.qualityCheckNotes || 'Sin notas de control de calidad registradas.'}
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Columna Derecha (1 col): Historial de Auditoría / Timeline */}
          <div className="space-y-6">
            <SectionCard
              title="Trazabilidad & Eventos"
              subtitle="Historial inmutable de cambios de estado y acciones técnicas."
            >
              {equipment.events && equipment.events.length > 0 ? (
                <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--shell-border)]">
                  {equipment.events.map((ev) => (
                    <div key={ev.id} className="relative group">
                      <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 border-[var(--glb-surface)] bg-blue-500 shadow-sm" />
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {ev.fromStatus !== null && ev.fromStatus !== undefined ? (
                            <>
                              <StatusBadge tone={repairEquipmentStatusBadgeTone(ev.fromStatus)}>
                                {repairEquipmentStatusLabel(ev.fromStatus)}
                              </StatusBadge>
                              <span className="text-xs text-[var(--glb-muted)]">➔</span>
                            </>
                          ) : null}
                          {ev.toStatus !== null && ev.toStatus !== undefined ? (
                            <StatusBadge tone={repairEquipmentStatusBadgeTone(ev.toStatus)}>
                              {repairEquipmentStatusLabel(ev.toStatus)}
                            </StatusBadge>
                          ) : null}
                        </div>

                        <div className="text-xs text-[var(--glb-muted)] flex items-center gap-1">
                          <Clock size={11} />
                          <span>{formatDateTime(ev.occurredAt || ev.createdAt)}</span>
                        </div>

                        {(ev.note || ev.notes) && (
                          <p className="text-xs text-slate-700 dark:text-slate-300 bg-[var(--glb-surface-muted)] p-2 rounded border border-[var(--shell-border)] mt-1">
                            {ev.note || ev.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--glb-muted)] italic text-center py-4">
                  No hay transiciones de estado registradas aún.
                </p>
              )}
            </SectionCard>
          </div>
        </div>

        {/* Galería Multimedia de Evidencias */}
        <SectionCard
          title="Galería Multimedia de Evidencias"
          subtitle="Fotografías optimizadas (WebP) almacenadas de forma segura en la nube para auditoría B2B."
          action={
            canUploadPhoto && !isCancelled ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setSelectedFile(null)
                  setPreviewUrl(null)
                  setPhotoCaption('')
                  setUploadModalOpen(true)
                }}
              >
                <Camera size={14} className="mr-1.5" />
                Nueva Fotografía
              </Button>
            ) : undefined
          }
        >
          {/* Pestañas de filtrado por etapa */}
          <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-[var(--shell-border)] pb-3">
            <button
              type="button"
              onClick={() => setActivePhotoTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activePhotoTab === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-[var(--glb-surface-muted)] text-[var(--glb-text)] hover:bg-[var(--shell-border)]'
              }`}
            >
              Todas ({photos.length})
            </button>
            <button
              type="button"
              onClick={() => setActivePhotoTab(String(PhotoStage.DamageInitial))}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activePhotoTab === String(PhotoStage.DamageInitial)
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-[var(--glb-surface-muted)] text-[var(--glb-text)] hover:bg-[var(--shell-border)]'
              }`}
            >
              Recepción Inicial (
              {photos.filter((p) => p.stage === PhotoStage.DamageInitial).length})
            </button>
            <button
              type="button"
              onClick={() => setActivePhotoTab(String(PhotoStage.InRepair))}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activePhotoTab === String(PhotoStage.InRepair)
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-[var(--glb-surface-muted)] text-[var(--glb-text)] hover:bg-[var(--shell-border)]'
              }`}
            >
              En Reparación ({photos.filter((p) => p.stage === PhotoStage.InRepair).length})
            </button>
            <button
              type="button"
              onClick={() => setActivePhotoTab(String(PhotoStage.QualityFinal))}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activePhotoTab === String(PhotoStage.QualityFinal)
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-[var(--glb-surface-muted)] text-[var(--glb-text)] hover:bg-[var(--shell-border)]'
              }`}
            >
              Control Final ({photos.filter((p) => p.stage === PhotoStage.QualityFinal).length})
            </button>
          </div>

          {/* Rejilla de fotos */}
          {filteredPhotos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative rounded-xl overflow-hidden border border-[var(--shell-border)] bg-[var(--glb-surface)] shadow-xs transition-all hover:shadow-md flex flex-col"
                >
                  {/* Imagen */}
                  <div
                    className="relative aspect-video bg-slate-100 dark:bg-slate-900 cursor-pointer overflow-hidden"
                    onClick={() => setLightboxPhoto(photo)}
                  >
                    <img
                      src={photo.downloadUrl}
                      alt={photo.caption || photo.fileName}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {/* Badge de etapa sobre la imagen */}
                    <div className="absolute top-2 left-2">
                      <StatusBadge tone={photoStageBadgeTone(photo.stage)}>
                        {photoStageLabel(photo.stage)}
                      </StatusBadge>
                    </div>
                    {/* Hover overlay para ver zoom */}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-white bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-xs">
                        <Eye size={13} />
                        Ver imagen
                      </span>
                    </div>
                  </div>

                  {/* Info y Acciones al pie */}
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-100 line-clamp-2">
                        {photo.caption || (
                          <span className="italic text-[var(--glb-muted)] font-normal">
                            Sin descripción
                          </span>
                        )}
                      </p>
                      <div className="text-[11px] text-[var(--glb-muted)] mt-1.5 flex items-center gap-1">
                        <Calendar size={11} />
                        <span>{formatDate(photo.capturedAt)}</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-[var(--shell-border)] flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setLightboxPhoto(photo)}
                        className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye size={12} />
                        Ampliar
                      </button>

                      {canUploadPhoto && !isCancelled && (
                        <button
                          type="button"
                          onClick={() => void handleDeletePhoto(photo.id)}
                          disabled={deletingPhotoId === photo.id}
                          className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Eliminar evidencia"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No hay fotografías en esta categoría"
              description="Las fotografías de evidencia tomadas en el taller aparecerán organizadas aquí."
              action={
                canUploadPhoto && !isCancelled ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null)
                      setPreviewUrl(null)
                      setPhotoCaption('')
                      setUploadModalOpen(true)
                    }}
                  >
                    <Camera size={14} className="mr-1.5" />
                    Subir primera foto
                  </Button>
                ) : undefined
              }
            />
          )}
        </SectionCard>

        {/* Modal: Cambio de Estado / Fase Técnica */}
        <Popup
          open={statusModalOpen}
          onClose={() => setStatusModalOpen(false)}
          title={`Actualizar Fase: ${equipment.serialNumber}`}
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
              label: savingStatus ? 'Guardando...' : 'Guardar Cambio',
              variant: 'primary',
              onClick: () => void handleSaveStatus(),
              disabled: savingStatus,
              loading: savingStatus,
            },
          ]}
        >
          <div className="space-y-4 p-2">
            <div>
              <Select
                id="target-status-select"
                label="Nueva Fase Técnica / Estado *"
                labelPosition="outlined"
                variant="outline"
                value={String(targetStatus)}
                onChange={(val: string) => setTargetStatus(Number(val) as RepairEquipmentStatus)}
                options={[
                  { value: String(RepairEquipmentStatus.Received), label: '0 - Recibido en Taller' },
                  { value: String(RepairEquipmentStatus.Diagnosing), label: '1 - En Diagnóstico' },
                  { value: String(RepairEquipmentStatus.InRepair), label: '2 - En Reparación' },
                  { value: String(RepairEquipmentStatus.QualityCheck), label: '3 - Control de Calidad (QC)' },
                  { value: String(RepairEquipmentStatus.ReadyToDispatch), label: '4 - Listo para Despacho' },
                  { value: String(RepairEquipmentStatus.Dispatched), label: '5 - Despachado' },
                  { value: String(RepairEquipmentStatus.Cancelled), label: '9 - Cancelado / Descartado' },
                ]}
                fullWidth
              />
            </div>

            <div>
              <Select
                id="confirmed-damage-select"
                label="Confirmar o Rectificar Nivel de Daño *"
                labelPosition="outlined"
                variant="outline"
                value={String(confirmedDamage)}
                onChange={(val: string) => setConfirmedDamage(Number(val) as DamageLevel)}
                options={[
                  { value: String(DamageLevel.Level1), label: 'Nivel 1 - Leve / Estético' },
                  { value: String(DamageLevel.Level2), label: 'Nivel 2 - Medio / Mecánico' },
                  { value: String(DamageLevel.Level3), label: 'Nivel 3 - Grave / Estructural' },
                ]}
                fullWidth
              />
            </div>

            <div>
              <TextBox
                id="service-fee-input"
                label="Tarifa de Facturación Aplicada ($ USD)"
                labelPosition="outlined"
                variant="outline"
                type="text"
                value={serviceFee}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setServiceFee(e.target.value)}
                placeholder="Ej. 45.00 (opcional o según contrato)"
                fullWidth
              />
              <span className="text-[11px] text-[var(--glb-muted)] mt-1 block">
                Requerida para poder incluir este equipo en un acta de despacho exitosa.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Observaciones / Notas Técnicas
              </label>
              <textarea
                className="w-full text-xs p-2.5 rounded-lg border border-[var(--shell-border)] bg-[var(--glb-surface)] text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500 min-h-[90px]"
                placeholder="Describa el trabajo realizado, piezas reemplazadas o dictamen del QC..."
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
              />
            </div>
          </div>
        </Popup>

        {/* Modal: Subida de Evidencia Fotográfica */}
        <Popup
          open={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          title="Subir Fotografía de Evidencia S3"
          width="min(92vw, 30rem)"
          actions={[
            {
              id: 'cancel-upload',
              label: 'Cancelar',
              variant: 'ghost',
              onClick: () => setUploadModalOpen(false),
              disabled: uploadingPhoto,
            },
            {
              id: 'confirm-upload',
              label: uploadingPhoto ? 'Subiendo...' : 'Subir Imagen',
              variant: 'primary',
              onClick: () => void handleUploadPhoto(),
              disabled: uploadingPhoto || !selectedFile,
              loading: uploadingPhoto,
            },
          ]}
        >
          <div className="space-y-4 p-2">
            <div>
              <Select
                id="upload-stage-select"
                label="Etapa de la Fotografía *"
                labelPosition="outlined"
                variant="outline"
                value={String(photoStage)}
                onChange={(val: string) => setPhotoStage(Number(val) as PhotoStage)}
                options={[
                  { value: String(PhotoStage.DamageInitial), label: '1 - Recepción Inicial (Daño Visible)' },
                  { value: String(PhotoStage.InRepair), label: '2 - Durante Reparación / Componentes' },
                  { value: String(PhotoStage.QualityFinal), label: '3 - Control Final / Pruebas Terminadas' },
                ]}
                fullWidth
              />
            </div>

            <div>
              <TextBox
                id="upload-caption-input"
                label="Descripción o Pie de Foto (Opcional)"
                labelPosition="outlined"
                variant="outline"
                value={photoCaption}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPhotoCaption(e.target.value)}
                placeholder="Ej. Evidencia de abolladura lateral antes del enderezado"
                fullWidth
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Seleccionar Archivo de Imagen (JPG, PNG, WebP)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="block w-full text-xs text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-950 dark:file:text-blue-300 cursor-pointer border border-[var(--shell-border)] rounded-lg p-1.5"
              />
            </div>

            {previewUrl && (
              <div className="rounded-lg overflow-hidden border border-[var(--shell-border)] max-h-48 bg-slate-900 flex items-center justify-center">
                <img src={previewUrl} alt="Vista previa" className="max-h-48 object-contain" />
              </div>
            )}
          </div>
        </Popup>

        {/* Lightbox Modal: Visualizador de Imagen Completa */}
        {lightboxPhoto && (
          <Popup
            open={true}
            onClose={() => setLightboxPhoto(null)}
            title={`Evidencia: ${photoStageLabel(lightboxPhoto.stage)}`}
            width="min(95vw, 48rem)"
            actions={[
              {
                id: 'close',
                label: 'Cerrar',
                variant: 'secondary',
                onClick: () => setLightboxPhoto(null),
              },
            ]}
          >
            <div className="p-2 space-y-3">
              <div className="rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center max-h-[70vh]">
                <img
                  src={lightboxPhoto.downloadUrl}
                  alt={lightboxPhoto.caption || 'Evidencia'}
                  className="max-h-[70vh] w-auto max-w-full object-contain"
                />
              </div>

              <div className="px-2 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    {lightboxPhoto.caption || 'Sin descripción'}
                  </p>
                  <p className="text-[var(--glb-muted)] mt-0.5">
                    Registrada el {formatDateTime(lightboxPhoto.capturedAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={lightboxPhoto.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg border border-[var(--shell-border)] hover:bg-[var(--glb-surface-muted)] text-xs font-medium inline-flex items-center gap-1 text-blue-600 dark:text-blue-400"
                  >
                    <ExternalLink size={13} />
                    Abrir original
                  </a>
                </div>
              </div>
            </div>
          </Popup>
        )}
      </div>
    </TenantSessionGate>
  )
}
