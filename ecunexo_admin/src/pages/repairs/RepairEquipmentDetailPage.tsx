import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, OptionGroup, Popup, Select, TextBox, useToast } from 'glubox'
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  DollarSign,
  ExternalLink,
  Eye,
  Tag,
  Trash2,
  Upload,
  Wrench,
} from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluComponentSize } from '@/hooks/useGluComponentSize'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate, formatDateTime } from '@/lib/formatDate'
import { readApiError } from '@/lib/readApiError'
import {
  deleteRepairEquipmentPhoto,
  getRepairEquipment,
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
  photoStageBadgeTone,
  photoStageLabel,
  PhotoStage,
  RepairEquipmentStatus,
  repairEquipmentStatusBadgeTone,
  repairEquipmentStatusLabel,
  type RepairEquipmentDetailDto,
  type RepairEquipmentDto,
  type RepairEquipmentPhotoDto,
} from '@/types/repairsApi'
import './repair-equipment-detail.css'

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
  const [batchEquipments, setBatchEquipments] = useState<RepairEquipmentDto[]>([])
  const size = useGluComponentSize()

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
  const [isDragging, setIsDragging] = useState(false)

  // Lightbox
  const [lightboxPhoto, setLightboxPhoto] = useState<RepairEquipmentPhotoDto | null>(null)
  const [lightboxRotation, setLightboxRotation] = useState<number>(0)

  const loadData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!tenantId || !equipmentId) return
      if (!options?.silent) setLoading(true)
      try {
        const data = await getRepairEquipment(tenantId, equipmentId)
        setEquipment(data)
        setPhotos(data.photos || [])
        if (data.batchId) {
          try {
            const list = await listBatchEquipments(tenantId, data.batchId)
            setBatchEquipments(list)
          } catch {
            // Continúa con la ficha principal si la lista de lote falla
          }
        }
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

  // Navegación secuencial por el lote
  const currentIndex = useMemo(() => {
    if (!equipment || !batchEquipments.length) return -1
    return batchEquipments.findIndex((e) => e.id === equipment.id)
  }, [equipment, batchEquipments])

  const prevEquipment = useMemo(() => {
    if (currentIndex <= 0) return null
    return batchEquipments[currentIndex - 1]
  }, [currentIndex, batchEquipments])

  const nextEquipment = useMemo(() => {
    if (currentIndex < 0 || currentIndex >= batchEquipments.length - 1) return null
    return batchEquipments[currentIndex + 1]
  }, [currentIndex, batchEquipments])

  // Atajos de teclado para navegación (Alt + Izquierda / Alt + Derecha)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return
      if (e.altKey && e.key === 'ArrowLeft' && prevEquipment && equipment?.batchId) {
        navigate(`/taller/lotes/${equipment.batchId}/equipos/${prevEquipment.id}`)
      } else if (e.altKey && e.key === 'ArrowRight' && nextEquipment && equipment?.batchId) {
        navigate(`/taller/lotes/${equipment.batchId}/equipos/${nextEquipment.id}`)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, prevEquipment, nextEquipment, equipment?.batchId])

  // Acción rápida contextual de 1-clic según la fase actual
  const quickAction = useMemo(() => {
    if (!equipment) return null
    switch (equipment.status) {
      case RepairEquipmentStatus.Received:
        return {
          label: 'Iniciar Diagnóstico',
          icon: Wrench,
          targetStatus: RepairEquipmentStatus.Diagnosing,
        }
      case RepairEquipmentStatus.Diagnosing:
        return {
          label: 'Pasar a Reparación',
          icon: Wrench,
          targetStatus: RepairEquipmentStatus.InRepair,
        }
      case RepairEquipmentStatus.InRepair:
        return {
          label: 'A Control de Calidad',
          icon: CheckCircle2,
          targetStatus: RepairEquipmentStatus.QualityCheck,
        }
      case RepairEquipmentStatus.QualityCheck:
        return {
          label: 'Aprobar QC & Listo',
          icon: CheckCircle2,
          targetStatus: RepairEquipmentStatus.ReadyToDispatch,
        }
      default:
        return null
    }
  }, [equipment])

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
  const handleOpenStatusModal = (preselectedStatus?: RepairEquipmentStatus) => {
    if (!equipment) return
    setTargetStatus(
      preselectedStatus !== undefined
        ? preselectedStatus
        : equipment.status === RepairEquipmentStatus.Received
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.show({
        title: 'Formato no soportado',
        message: 'Por favor arrastre un archivo de imagen (JPG, PNG, WebP).',
        variant: 'error',
      })
      return
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.show({
        title: 'Archivo muy pesado',
        message: 'La imagen no debe superar los 15 MB.',
        variant: 'error',
      })
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
      <TenantSessionGate
        title="Ficha del Equipo"
        lead="Gestión operativa, trazabilidad y evidencias fotográficas."
      >
        <div className="ecu-dashboard-layout">
          <SectionCard title="Cargando equipo…">
            <p className="app-shell__muted" style={{ margin: 0 }}>
              Recuperando información técnica y evidencias fotográficas…
            </p>
          </SectionCard>
        </div>
      </TenantSessionGate>
    )
  }

  if (!equipment) {
    return (
      <TenantSessionGate
        title="Ficha del Equipo"
        lead="Gestión operativa, trazabilidad y evidencias fotográficas."
      >
        <div className="ecu-dashboard-layout">
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
      </TenantSessionGate>
    )
  }

  const isCancelled = equipment.status === RepairEquipmentStatus.Cancelled

  return (
    <TenantSessionGate
      title="Ficha del Equipo"
      lead="Gestión operativa, trazabilidad y evidencias fotográficas."
    >
      <div className="ecu-dashboard-layout">
        {/* Breadcrumb de Navegación Jerárquica */}
        <nav className="ecu-breadcrumb" aria-label="Navegación jerárquica">
          <Link to="/taller/lotes" className="ecu-breadcrumb__item">
            Lotes de Reparación
          </Link>
          <ChevronRight size={13} className="ecu-breadcrumb__sep" aria-hidden />
          <Link to={`/taller/lotes/${equipment.batchId}`} className="ecu-breadcrumb__item">
            {equipment.batchNumber ? `Lote #${equipment.batchNumber}` : 'Lote'}
          </Link>
          <ChevronRight size={13} className="ecu-breadcrumb__sep" aria-hidden />
          <span className="ecu-breadcrumb__current font-mono">
            {equipment.serialNumber}
          </span>
        </nav>

        {/* Header Principal */}
        <PageHeader
          title={`Equipo: ${equipment.serialNumber}`}
          subtitle={`${equipment.brand} · ${equipment.model} ${
            equipment.productLine ? `· Línea ${equipment.productLine}` : ''
          }`}
          badge={
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
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
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
              <Button
                variant="secondary"
                onClick={() => navigate(`/taller/lotes/${equipment.batchId}`)}
                title="Regresar a la lista de equipos del lote"
              >
                <ArrowLeft size={16} className="mr-1.5" />
                Volver al Lote
              </Button>

              {canUpdateStatus && !isCancelled && quickAction && (
                <Button
                  variant="primary"
                  onClick={() => handleOpenStatusModal(quickAction.targetStatus)}
                  title={`Avanzar a ${repairEquipmentStatusLabel(quickAction.targetStatus)}`}
                >
                  <quickAction.icon size={16} className="mr-1.5" />
                  {quickAction.label}
                </Button>
              )}

              {canUpdateStatus && !isCancelled && equipment.status === RepairEquipmentStatus.QualityCheck && (
                <Button
                  variant="outline"
                  onClick={() => handleOpenStatusModal(RepairEquipmentStatus.InRepair)}
                  style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#dc2626' }}
                  title="Rechazar control de calidad y devolver a reparación"
                >
                  <AlertCircle size={16} className="mr-1.5" />
                  Rechazar QC
                </Button>
              )}

              {canUpdateStatus && !isCancelled && (
                <Button
                  variant={quickAction ? 'outline' : 'primary'}
                  onClick={() => handleOpenStatusModal()}
                  title="Cambiar fase operativa o registrar notas técnicas"
                >
                  <Wrench size={16} className="mr-1.5" />
                  {quickAction ? 'Otras opciones...' : 'Actualizar Estado'}
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

        {/* Barra de Navegación Secuencial de Equipos («Anterior / Siguiente») */}
        {batchEquipments.length > 0 && (
          <div className="ecu-equipment-nav-strip" aria-label="Navegación secuencial por el lote">
            <div className="ecu-equipment-nav-strip__info">
              <span className="ecu-equipment-nav-strip__badge">
                {currentIndex >= 0 ? `Equipo ${currentIndex + 1} de ${batchEquipments.length}` : 'Equipos del lote'}
              </span>
              <span>
                en {equipment.batchNumber ? `Lote #${equipment.batchNumber}` : 'Lote'} · Usa <kbd style={{ padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'var(--glb-surface-muted)', border: '1px solid var(--shell-border)', fontSize: '0.7rem' }}>Alt + ◄</kbd> / <kbd style={{ padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'var(--glb-surface-muted)', border: '1px solid var(--shell-border)', fontSize: '0.7rem' }}>Alt + ►</kbd> para alternar
              </span>
            </div>
            <div className="ecu-equipment-nav-strip__controls">
              <Button
                variant="outline"
                size="sm"
                disabled={!prevEquipment}
                onClick={() => prevEquipment && navigate(`/taller/lotes/${equipment.batchId}/equipos/${prevEquipment.id}`)}
                title={prevEquipment ? `Anterior: Serie ${prevEquipment.serialNumber}` : 'Primer equipo del lote'}
              >
                <ChevronLeft size={14} className="mr-1" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!nextEquipment}
                onClick={() => nextEquipment && navigate(`/taller/lotes/${equipment.batchId}/equipos/${nextEquipment.id}`)}
                title={nextEquipment ? `Siguiente: Serie ${nextEquipment.serialNumber}` : 'Último equipo del lote'}
              >
                Siguiente
                <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Tira de Métricas KPI */}
        <div className="ecu-stat-grid">
          <StatCard
            label="Identificación"
            value={equipment.serialNumber}
            footerText={`${equipment.brand} - ${equipment.model}`}
            icon={<Cpu size={22} color="#3b82f6" />}
          />
          <StatCard
            label="Fase Operativa"
            value={repairEquipmentStatusLabel(equipment.status)}
            footerText={equipment.updatedAt ? `Act.: ${formatDate(equipment.updatedAt)}` : 'Sin cambios'}
            icon={<Wrench size={22} color="#f59e0b" />}
          />
          <StatCard
            label="Nivel & Tarifa"
            value={damageLevelLabel(equipment.damageLevel)}
            footerText={
              equipment.serviceFeeApplied
                ? `Tarifa: $${equipment.serviceFeeApplied.toFixed(2)}`
                : 'Tarifa pendiente'
            }
            icon={<DollarSign size={22} color="#10b981" />}
          />
          <StatCard
            label="Evidencias S3"
            value={`${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'}`}
            footerText="Cloud Storage B2"
            icon={<Camera size={22} color="#a855f7" />}
          />
        </div>

        {/* Cuadrícula de 2 Columnas: Ficha Técnica (Izq) + Trazabilidad (Der) */}
        <div className="ecu-equipment-detail__layout">
          {/* Columna Izquierda: Ficha y Fases */}
          <div className="ecu-equipment-detail__main">
            {/* Especificaciones y Datos de Entrada */}
            <SectionCard
              title="Especificaciones & Datos de Entrada"
              subtitle="Información de origen proporcionada en el manifiesto o plantilla Excel del lote."
            >
              <div className="ecu-equipment-spec-grid">
                <div className="ecu-equipment-spec-tile">
                  <span className="ecu-equipment-spec-tile__label">Número de Serie</span>
                  <span className="ecu-equipment-spec-tile__value ecu-equipment-spec-tile__value--mono">
                    {equipment.serialNumber}
                  </span>
                </div>

                <div className="ecu-equipment-spec-tile">
                  <span className="ecu-equipment-spec-tile__label">Marca</span>
                  <span className="ecu-equipment-spec-tile__value">{equipment.brand}</span>
                </div>

                <div className="ecu-equipment-spec-tile">
                  <span className="ecu-equipment-spec-tile__label">Modelo</span>
                  <span className="ecu-equipment-spec-tile__value">{equipment.model}</span>
                </div>

                <div className="ecu-equipment-spec-tile">
                  <span className="ecu-equipment-spec-tile__label">Línea de Producto</span>
                  <span className="ecu-equipment-spec-tile__value">
                    {equipment.productLine || 'General / No especificada'}
                  </span>
                </div>

                <div className="ecu-equipment-spec-tile">
                  <span className="ecu-equipment-spec-tile__label">Lote Padre</span>
                  <Link
                    to={`/taller/lotes/${equipment.batchId}`}
                    className="ecu-equipment-spec-tile__link"
                    title="Ver lote de origen"
                  >
                    <span>{equipment.batchNumber ? `#${equipment.batchNumber}` : 'Ver Lote'}</span>
                    <ExternalLink size={13} />
                  </Link>
                </div>

                <div className="ecu-equipment-spec-tile">
                  <span className="ecu-equipment-spec-tile__label">Cliente B2B</span>
                  <span className="ecu-equipment-spec-tile__value">
                    {equipment.customerName || 'No asignado'}
                  </span>
                </div>
              </div>

              {/* Atributos Adicionales de la Plantilla */}
              {parsedCustomAttributes.length > 0 && (
                <div className="ecu-equipment-custom-attrs">
                  <div className="ecu-equipment-custom-attrs__title">
                    <Tag size={13} />
                    <span>Atributos Adicionales de la Plantilla</span>
                  </div>
                  <div className="ecu-equipment-custom-attrs__grid">
                    {parsedCustomAttributes.map(([key, value]) => (
                      <div key={key} className="ecu-equipment-custom-attr-chip">
                        <span className="ecu-equipment-custom-attr-chip__key">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span className="ecu-equipment-custom-attr-chip__val">
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
              <div className="ecu-equipment-phases">
                {/* Diagnóstico */}
                <div className="ecu-equipment-phase-card">
                  <div className="ecu-equipment-phase-card__header">
                    <div className="ecu-equipment-phase-card__title-group">
                      <span className="ecu-equipment-phase-card__indicator ecu-equipment-phase-card__indicator--diag" />
                      <h4 className="ecu-equipment-phase-card__title">Diagnóstico Técnico</h4>
                    </div>
                    <span className="ecu-equipment-phase-card__date">
                      <Clock size={12} />
                      {equipment.diagnosedAt ? formatDateTime(equipment.diagnosedAt) : 'No diagnosticado aún'}
                    </span>
                  </div>
                  <p
                    className={`ecu-equipment-phase-card__notes ${
                      !equipment.diagnosticNotes ? 'ecu-equipment-phase-card__notes--empty' : ''
                    }`}
                  >
                    {equipment.diagnosticNotes || 'Sin notas de diagnóstico registradas.'}
                  </p>
                </div>

                {/* Reparación */}
                <div className="ecu-equipment-phase-card">
                  <div className="ecu-equipment-phase-card__header">
                    <div className="ecu-equipment-phase-card__title-group">
                      <span className="ecu-equipment-phase-card__indicator ecu-equipment-phase-card__indicator--repair" />
                      <h4 className="ecu-equipment-phase-card__title">Trabajo de Reparación</h4>
                    </div>
                    <span className="ecu-equipment-phase-card__date">
                      <Clock size={12} />
                      {equipment.repairedAt ? formatDateTime(equipment.repairedAt) : 'Reparación pendiente'}
                    </span>
                  </div>
                  <p
                    className={`ecu-equipment-phase-card__notes ${
                      !equipment.repairNotes ? 'ecu-equipment-phase-card__notes--empty' : ''
                    }`}
                  >
                    {equipment.repairNotes || 'Sin notas de reparación registradas.'}
                  </p>
                </div>

                {/* Control de Calidad */}
                <div className="ecu-equipment-phase-card">
                  <div className="ecu-equipment-phase-card__header">
                    <div className="ecu-equipment-phase-card__title-group">
                      <span
                        className={`ecu-equipment-phase-card__indicator ${
                          equipment.passedQualityCheck === true
                            ? 'ecu-equipment-phase-card__indicator--qc-ok'
                            : equipment.passedQualityCheck === false
                              ? 'ecu-equipment-phase-card__indicator--qc-fail'
                              : 'ecu-equipment-phase-card__indicator--qc-none'
                        }`}
                      />
                      <h4 className="ecu-equipment-phase-card__title">Control de Calidad (QC)</h4>
                      {equipment.passedQualityCheck !== null && (
                        <StatusBadge tone={equipment.passedQualityCheck ? 'success' : 'danger'}>
                          {equipment.passedQualityCheck ? 'Aprobado' : 'Rechazado'}
                        </StatusBadge>
                      )}
                    </div>
                    <span className="ecu-equipment-phase-card__date">
                      <Clock size={12} />
                      {equipment.qualityCheckedAt
                        ? formatDateTime(equipment.qualityCheckedAt)
                        : 'QC pendiente'}
                    </span>
                  </div>
                  <p
                    className={`ecu-equipment-phase-card__notes ${
                      !equipment.qualityCheckNotes ? 'ecu-equipment-phase-card__notes--empty' : ''
                    }`}
                  >
                    {equipment.qualityCheckNotes || 'Sin notas de control de calidad registradas.'}
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Columna Derecha: Trazabilidad & Eventos */}
          <div className="ecu-equipment-detail__aside">
            <SectionCard
              title="Trazabilidad & Eventos"
              subtitle="Historial inmutable de cambios de estado y acciones técnicas."
            >
              {equipment.events && equipment.events.length > 0 ? (
                <div className="ecu-equipment-timeline">
                  {equipment.events.map((ev) => (
                    <div key={ev.id} className="ecu-equipment-timeline__item">
                      <div className="ecu-equipment-timeline__dot" />
                      <div className="ecu-equipment-timeline__content">
                        <div className="ecu-equipment-timeline__badges">
                          {ev.fromStatus !== null && ev.fromStatus !== undefined ? (
                            <>
                              <StatusBadge tone={repairEquipmentStatusBadgeTone(ev.fromStatus)}>
                                {repairEquipmentStatusLabel(ev.fromStatus)}
                              </StatusBadge>
                              <span className="ecu-equipment-timeline__arrow">➔</span>
                            </>
                          ) : null}
                          {ev.toStatus !== null && ev.toStatus !== undefined ? (
                            <StatusBadge tone={repairEquipmentStatusBadgeTone(ev.toStatus)}>
                              {repairEquipmentStatusLabel(ev.toStatus)}
                            </StatusBadge>
                          ) : null}
                        </div>

                        <div className="ecu-equipment-timeline__meta">
                          <Clock size={11} />
                          <span>{formatDateTime(ev.occurredAt || ev.createdAt)}</span>
                        </div>

                        {(ev.note || ev.notes) && (
                          <p className="ecu-equipment-timeline__note">
                            {ev.note || ev.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="app-shell__muted" style={{ margin: 0, textAlign: 'center', padding: '1.5rem 0' }}>
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
          {/* Pestañas de filtrado por etapa con OptionGroup oficial de Glubox */}
          <div style={{ marginBottom: '1.25rem' }}>
            <OptionGroup
              id="equipment-photos-tab"
              name="equipment-photos-tab"
              layout="segmented"
              variant="outline"
              size={size}
              value={activePhotoTab}
              onChange={setActivePhotoTab}
              options={[
                { value: 'all', label: `Todas (${photos.length})` },
                {
                  value: String(PhotoStage.DamageInitial),
                  label: `Recepción Inicial (${photos.filter((p) => p.stage === PhotoStage.DamageInitial).length})`,
                },
                {
                  value: String(PhotoStage.InRepair),
                  label: `En Proceso (${photos.filter((p) => p.stage === PhotoStage.InRepair).length})`,
                },
                {
                  value: String(PhotoStage.QualityFinal),
                  label: `Calidad Final (${photos.filter((p) => p.stage === PhotoStage.QualityFinal).length})`,
                },
              ]}
            />
          </div>

          {/* Rejilla de fotos */}
          {filteredPhotos.length > 0 ? (
            <div className="ecu-equipment-photo-grid">
              {filteredPhotos.map((photo) => (
                <div key={photo.id} className="ecu-equipment-photo-card">
                  {/* Imagen Thumbnail */}
                  <div
                    className="ecu-equipment-photo-card__thumb"
                    onClick={() => setLightboxPhoto(photo)}
                  >
                    <img
                      src={photo.downloadUrl}
                      alt={photo.caption || photo.fileName}
                      loading="lazy"
                      className="ecu-equipment-photo-card__img"
                    />
                    <div className="ecu-equipment-photo-card__badge">
                      <StatusBadge tone={photoStageBadgeTone(photo.stage)}>
                        {photoStageLabel(photo.stage)}
                      </StatusBadge>
                    </div>
                    <div className="ecu-equipment-photo-card__overlay">
                      <span className="ecu-equipment-photo-card__zoom-pill">
                        <Eye size={13} />
                        Ver imagen
                      </span>
                    </div>
                  </div>

                  {/* Pie de foto e info */}
                  <div className="ecu-equipment-photo-card__body">
                    <p
                      className={`ecu-equipment-photo-card__caption ${
                        !photo.caption ? 'ecu-equipment-photo-card__caption--empty' : ''
                      }`}
                    >
                      {photo.caption || 'Sin descripción'}
                    </p>

                    <div className="ecu-equipment-photo-card__footer">
                      <span className="ecu-equipment-photo-card__date">
                        <Calendar size={11} />
                        {formatDate(photo.capturedAt)}
                      </span>

                      <div className="ecu-equipment-photo-card__actions">
                        <button
                          type="button"
                          onClick={() => setLightboxPhoto(photo)}
                          className="ecu-equipment-photo-card__action-btn"
                          title="Ampliar imagen"
                        >
                          <Eye size={13} />
                        </button>
                        {canUploadPhoto && !isCancelled && (
                          <button
                            type="button"
                            onClick={() => void handleDeletePhoto(photo.id)}
                            disabled={deletingPhotoId === photo.id}
                            className="ecu-equipment-photo-card__action-btn ecu-equipment-photo-card__action-btn--delete"
                            title="Eliminar evidencia"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
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
          <div className="ecu-modal-form">
            <div className="ecu-modal-form__field">
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

            <div className="ecu-modal-form__field">
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

            <div className="ecu-modal-form__field">
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
              <span className="ecu-modal-form__hint" style={{ marginTop: '0.35rem', display: 'block' }}>
                Requerida para poder incluir este equipo en un acta de despacho exitosa.
              </span>
            </div>

            <div className="ecu-modal-form__field">
              <label className="ecu-modal-form__label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                Observaciones / Notas Técnicas
              </label>
              <textarea
                className="glb-textbox__input"
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '0.65rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--shell-border)',
                  background: 'var(--glb-surface)',
                  color: 'var(--shell-text)',
                  boxSizing: 'border-box',
                }}
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
          <div className="ecu-modal-form">
            <div className="ecu-modal-form__field">
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

            <div className="ecu-modal-form__field">
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

            <div className="ecu-modal-form__field">
              <label className="ecu-modal-form__label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                Archivo de Imagen (Evidencia)
              </label>

              {/* Zona Drag & Drop interactiva */}
              <div
                className={`ecu-equipment-dropzone ${isDragging ? 'ecu-equipment-dropzone--active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('equipment-file-input')?.click()}
              >
                <input
                  id="equipment-file-input"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <Upload size={26} className="ecu-equipment-dropzone__icon" aria-hidden />
                <p className="ecu-equipment-dropzone__title">
                  {selectedFile ? selectedFile.name : 'Arrastra una fotografía o haz clic para explorar'}
                </p>
                <p className="ecu-equipment-dropzone__hint">
                  JPG, PNG o WebP hasta 15 MB · Optimización Full HD en Backblaze B2
                </p>
              </div>

              {/* Botón de captura rápida con cámara móvil / tablet */}
              <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <input
                  id="equipment-camera-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('equipment-camera-input')?.click()}
                >
                  <Camera size={14} className="mr-1" />
                  Tomar con cámara
                </Button>
              </div>
            </div>

            {previewUrl && (
              <div
                style={{
                  borderRadius: '0.5rem',
                  overflow: 'hidden',
                  border: '1px solid var(--shell-border)',
                  maxHeight: '12rem',
                  background: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={previewUrl}
                  alt="Vista previa"
                  style={{ maxHeight: '12rem', objectFit: 'contain' }}
                />
              </div>
            )}
          </div>
        </Popup>

        {/* Lightbox Modal: Visualizador de Imagen Completa */}
        {lightboxPhoto && (
          <Popup
            open={true}
            onClose={() => {
              setLightboxPhoto(null)
              setLightboxRotation(0)
            }}
            title={`Evidencia: ${photoStageLabel(lightboxPhoto.stage)}`}
            width="min(95vw, 48rem)"
            actions={[
              {
                id: 'rotate',
                label: 'Rotar 90°',
                variant: 'outline',
                onClick: () => setLightboxRotation((prev) => (prev + 90) % 360),
              },
              {
                id: 'copy',
                label: 'Copiar Enlace',
                variant: 'outline',
                onClick: () => {
                  void navigator.clipboard.writeText(lightboxPhoto.downloadUrl)
                  toast.show({
                    title: 'Enlace copiado',
                    message: 'URL pública de la imagen copiada al portapapeles.',
                    variant: 'info',
                  })
                },
              },
              {
                id: 'close',
                label: 'Cerrar',
                variant: 'secondary',
                onClick: () => {
                  setLightboxPhoto(null)
                  setLightboxRotation(0)
                },
              },
            ]}
          >
            <div className="ecu-lightbox-modal">
              <div className="ecu-lightbox-modal__img-wrap">
                <img
                  src={lightboxPhoto.downloadUrl}
                  alt={lightboxPhoto.caption || 'Evidencia'}
                  className="ecu-lightbox-modal__img"
                  style={{
                    transform: `rotate(${lightboxRotation}deg)`,
                    transition: 'transform 0.25s ease',
                  }}
                />
              </div>

              <div className="ecu-lightbox-modal__info">
                <div>
                  <p className="ecu-lightbox-modal__caption" style={{ margin: 0 }}>
                    {lightboxPhoto.caption || 'Sin descripción'}
                  </p>
                  <p className="ecu-lightbox-modal__date" style={{ margin: '0.2rem 0 0 0' }}>
                    Registrada el {formatDateTime(lightboxPhoto.capturedAt)}
                  </p>
                </div>

                <a
                  href={lightboxPhoto.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="glb-btn glb-btn--outline glb-btn--sm"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <ExternalLink size={13} />
                  Abrir original
                </a>
              </div>
            </div>
          </Popup>
        )}
      </div>
    </TenantSessionGate>
  )
}
