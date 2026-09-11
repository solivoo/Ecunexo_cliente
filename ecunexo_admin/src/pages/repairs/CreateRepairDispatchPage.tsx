import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, DataGrid, Select, TextBox, useToast, type ColumnDef, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { ArrowLeft, AlertCircle, PackageCheck, Truck, UserCheck } from 'lucide-react'
import { createAndLinkDispatchInvoice } from '@/pages/repairs/dispatchInvoiceHelper'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  createRepairDispatch,
  getRepairBatch,
  listBatchEquipments,
  listRepairBatches,
} from '@/services/repairsApi'
import {
  getTenantCarriers,
  saveTenantCarrier,
  type TransportCarrier,
} from '@/services/carrierStorage'
import { ManageCarriersModal } from '@/pages/repairs/ManageCarriersModal'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  DamageLevel,
  damageLevelBadgeTone,
  damageLevelLabel,
  DispatchExitType,
  dispatchExitTypeLabel,
  RepairEquipmentStatus,
  type BatchDetailDto,
  type BatchListItemDto,
  type RepairEquipmentDto,
} from '@/types/repairsApi'

type Row = RepairEquipmentDto & Record<string, unknown>

const messages = createSpanishDataGridMessages('equipo listo', 'equipos listos')

function rateForLevel(batch: BatchDetailDto | null, level: DamageLevel): number {
  if (!batch) return 0
  switch (level) {
    case DamageLevel.Level1:
      return Number(batch.agreedRateN1 ?? 0)
    case DamageLevel.Level2:
      return Number(batch.agreedRateN2 ?? 0)
    case DamageLevel.Level3:
      return Number(batch.agreedRateN3 ?? 0)
    default:
      return 0
  }
}

export function CreateRepairDispatchPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const tenantId = useAppSelector(selectTenantId)
  const initialBatchId = params.get('batchId') ?? ''

  const auth = useAppSelector((s) => s.auth)
  const currentUserName = auth.userName || auth.userEmail || 'Usuario de la cuenta'
  const currentUserEmail = auth.userEmail || ''
  const currentUserRole = auth.isSubscriptionHolder
    ? 'Administrador Titular'
    : 'Supervisor Técnico de Taller'

  const canCreate = useHasPermission('repairs.dispatches.create')
  const canReadBatches = useHasPermission('repairs.batches.read')

  const [batches, setBatches] = useState<BatchListItemDto[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState(initialBatchId)
  const [batchDetail, setBatchDetail] = useState<BatchDetailDto | null>(null)
  const [readyEquipments, setReadyEquipments] = useState<RepairEquipmentDto[]>([])
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([])
  const [loadingBatches, setLoadingBatches] = useState(true)
  const [loadingEquipments, setLoadingEquipments] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [dispatchNumber, setDispatchNumber] = useState('')
  const [exitType, setExitType] = useState<DispatchExitType>(DispatchExitType.Repaired)
  const [returnReason, setReturnReason] = useState('')
  const [notes, setNotes] = useState('')
  const [carrierName, setCarrierName] = useState('')
  const [carrierDocument, setCarrierDocument] = useState('')
  const [carrierPlate, setCarrierPlate] = useState('')

  // Transport operators state
  const [carriers, setCarriers] = useState<TransportCarrier[]>([])
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>('')
  const [isCarrierModalOpen, setIsCarrierModalOpen] = useState(false)
  const [saveCarrierCheckbox, setSaveCarrierCheckbox] = useState(false)
  const [autoInvoice, setAutoInvoice] = useState(false)

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  useEffect(() => {
    const now = new Date()
    const seq = String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0')
    setDispatchNumber(
      `DSP-${now.getFullYear()}-${seq}-${String(now.getHours()).padStart(2, '0')}${String(
        now.getMinutes()
      ).padStart(2, '0')}`
    )
  }, [])

  useEffect(() => {
    if (tenantId) {
      setCarriers(getTenantCarriers(tenantId))
    }
  }, [tenantId])

  useEffect(() => {
    if (!tenantId || !canReadBatches) {
      setLoadingBatches(false)
      return
    }
    setLoadingBatches(true)
    void (async () => {
      try {
        const list = await listRepairBatches(tenantId)
        setBatches(list)
        setError(null)
      } catch (err: unknown) {
        setError(readApiError(err, 'No se pudieron cargar los lotes.'))
      } finally {
        setLoadingBatches(false)
      }
    })()
  }, [tenantId, canReadBatches])

  useEffect(() => {
    if (!tenantId || !selectedBatchId) {
      setReadyEquipments([])
      setSelectedIds([])
      setBatchDetail(null)
      return
    }

    // Determinar qué estados de equipos cargar según el tipo de egreso
    const statusesToLoad: RepairEquipmentStatus[] = exitType === DispatchExitType.Repaired
      ? [RepairEquipmentStatus.ReadyToDispatch]
      : exitType === DispatchExitType.Irreparable
        ? [RepairEquipmentStatus.Irreparable]
        : [
            RepairEquipmentStatus.Received,
            RepairEquipmentStatus.Diagnosing,
            RepairEquipmentStatus.InRepair,
            RepairEquipmentStatus.QualityCheck,
            RepairEquipmentStatus.Irreparable,
          ]

    setLoadingEquipments(true)
    void (async () => {
      try {
        const [detail] = await Promise.all([
          getRepairBatch(tenantId, selectedBatchId),
        ])
        setBatchDetail(detail)

        // Cargar equipos de todos los estados requeridos
        const allEquipments: RepairEquipmentDto[] = []
        const uniqueStatuses = [...new Set(statusesToLoad)]
        for (const st of uniqueStatuses) {
          const eq = await listBatchEquipments(tenantId, selectedBatchId, st)
          allEquipments.push(...eq)
        }
        setReadyEquipments(allEquipments)
        setSelectedIds(allEquipments.map((e) => e.id))
      } catch (err: unknown) {
        setReadyEquipments([])
        setBatchDetail(null)
        setSelectedIds([])
        toast.show({
          title: 'Error',
          message: readApiError(err, 'No se pudieron cargar los equipos.'),
          variant: 'error',
        })
      } finally {
        setLoadingEquipments(false)
      }
    })()
  }, [tenantId, selectedBatchId, exitType, toast])

  const selectedEquipments = useMemo(
    () => readyEquipments.filter((e) => selectedIds.includes(e.id)),
    [readyEquipments, selectedIds]
  )

  const estimatedUsd = useMemo(
    () =>
      selectedEquipments.reduce(
        (sum, eq) => sum + rateForLevel(batchDetail, eq.damageLevel),
        0
      ),
    [selectedEquipments, batchDetail]
  )

  const missingPricingEquipments = useMemo(() => {
    if (exitType !== DispatchExitType.Repaired) return []
    return selectedEquipments.filter((eq) => rateForLevel(batchDetail, eq.damageLevel) <= 0)
  }, [exitType, selectedEquipments, batchDetail])

  const isPartial =
    readyEquipments.length > 0 &&
    selectedEquipments.length > 0 &&
    selectedEquipments.length < readyEquipments.length

  const batchOptions = useMemo(
    () =>
      batches
        .filter((b) => b.id === selectedBatchId || b.totalCount > 0)
        .map((b) => ({
          value: b.id,
          label: `${b.batchNumber} (${b.customerName}) — ${b.totalCount} eq. total`,
        })),
    [batches, selectedBatchId]
  )

  const carrierOptions = useMemo(() => {
    const list = carriers.map((c) => ({
      value: c.id,
      label: `${c.name}${c.vehiclePlate ? ` [${c.vehiclePlate}]` : ''}${
        c.document ? ` · ${c.document}` : ''
      }`,
    }))
    return [
      { value: '', label: '— Seleccionar operador del directorio frecuente —' },
      ...list,
      { value: '__new__', label: '+ Registrar nuevo operador de transporte...' },
    ]
  }, [carriers])

  const handleSelectCarrierOption = (val: string) => {
    setSelectedCarrierId(val)
    if (val === '__new__') {
      setIsCarrierModalOpen(true)
      return
    }
    const found = carriers.find((c) => c.id === val)
    if (found) {
      setCarrierName(found.name)
      setCarrierDocument(found.document)
      setCarrierPlate(found.vehiclePlate)
    }
  }

  const handleCarrierChosenFromModal = (carrier: TransportCarrier) => {
    if (tenantId) {
      setCarriers(getTenantCarriers(tenantId))
    }
    setSelectedCarrierId(carrier.id)
    setCarrierName(carrier.name)
    setCarrierDocument(carrier.document)
    setCarrierPlate(carrier.vehiclePlate)
  }

  const columns = useMemo(
    (): ColumnDef<Row>[] => [
      {
        key: 'serialNumber',
        header: 'Serie',
        width: 160,
        sortable: true,
        renderCell: (_v, row) => (
          <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>
            {row.serialNumber}
          </span>
        ),
      },
      {
        key: 'model',
        header: 'Modelo',
        width: 200,
        sortable: true,
      },
      {
        key: 'brand',
        header: 'Marca',
        width: 120,
        sortable: true,
      },
      {
        key: 'damageLevel',
        header: 'Nivel',
        width: 160,
        renderCell: (_v, row) => (
          <StatusBadge tone={damageLevelBadgeTone(row.damageLevel)}>
            {damageLevelLabel(row.damageLevel)}
          </StatusBadge>
        ),
      },
      {
        key: 'id',
        header: 'Tarifa ($)',
        width: 120,
        align: 'right',
        renderCell: (_v, row) => {
          const rate = rateForLevel(batchDetail, row.damageLevel)
          if (exitType === DispatchExitType.Repaired && rate <= 0) {
            return (
              <StatusBadge tone="danger">
                Sin tarifa
              </StatusBadge>
            )
          }
          return (
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              ${rate.toFixed(2)}
            </span>
          )
        },
      },
    ],
    [batchDetail, exitType]
  )

  const actionItems = useMemo<PageActionItem[]>(
    () => [
      {
        id: 'list',
        label: 'Lista de actas',
        icon: 'truck',
        route: '/taller/despachos',
        disabled: false,
      },
    ],
    []
  )

  const selectAll = () => setSelectedIds(readyEquipments.map((e) => e.id))
  const clearSelection = () => setSelectedIds([])

  const handleSubmit = async () => {
    if (!tenantId) return
    if (!selectedBatchId) {
      toast.show({ title: 'Atención', message: 'Selecciona un lote de origen.', variant: 'error' })
      return
    }
    if (!dispatchNumber.trim()) {
      toast.show({ title: 'Atención', message: 'El número de acta es obligatorio.', variant: 'error' })
      return
    }
    if (selectedIds.length === 0) {
      toast.show({ title: 'Atención', message: 'Selecciona al menos un equipo.', variant: 'error' })
      return
    }
    if (exitType === DispatchExitType.Repaired && missingPricingEquipments.length > 0) {
      toast.show({
        title: 'Tarifa de facturación requerida',
        message: `No se puede generar un acta de reparación exitosa si no se ha definido un precio para facturación (${missingPricingEquipments.length} equipo(s) sin tarifa). Defina las tarifas acordadas en el lote o en la ficha del cliente.`,
        variant: 'error',
      })
      return
    }
    if (exitType !== DispatchExitType.Repaired && !returnReason.trim()) {
      toast.show({
        title: 'Atención',
        message: 'El motivo de salida es obligatorio para egresos sin reparación.',
        variant: 'error',
      })
      return
    }

    // Si el usuario marcó guardar el transportista para futuros despachos
    if (saveCarrierCheckbox && carrierName.trim()) {
      const alreadyExists = carriers.some(
        (c) => c.name.toLowerCase() === carrierName.trim().toLowerCase()
      )
      if (!alreadyExists) {
        saveTenantCarrier(tenantId, {
          name: carrierName.trim(),
          document: carrierDocument.trim(),
          vehiclePlate: carrierPlate.trim(),
        })
      }
    }

    setSaving(true)
    try {
      const res = await createRepairDispatch(tenantId, {
        batchId: selectedBatchId,
        dispatchNumber: dispatchNumber.trim(),
        equipmentIds: selectedIds.map(String),
        exitType,
        carrierName: carrierName.trim() || undefined,
        carrierDocument: carrierDocument.trim() || undefined,
        carrierVehiclePlate: carrierPlate.trim() || undefined,
        notes: notes.trim() || undefined,
        returnReason: returnReason.trim() || undefined,
      })

      if (autoInvoice && exitType === DispatchExitType.Repaired) {
        try {
          await createAndLinkDispatchInvoice(tenantId, res.dispatchId)
          toast.show({
            title: 'Salida y factura generadas',
            message: `${res.dispatchNumber}: ${res.dispatchedCount} equipos registrados como salida y borrador de factura vinculado.`,
            variant: 'success',
          })
        } catch (invErr) {
          toast.show({
            title: 'Acta emitida (Factura pendiente)',
            message: `Acta ${res.dispatchNumber} emitida. Factura pendiente: ${readApiError(invErr, 'No se pudo generar el borrador automático')}. Puedes generarla en el detalle del acta.`,
            variant: 'warning',
          })
        }
      } else {
        toast.show({
          title: 'Acta emitida',
          message: `${res.dispatchNumber}: ${res.dispatchedCount} equipos registrados como salida.`,
          variant: 'success',
        })
      }
      navigate(`/taller/despachos/${res.dispatchId}`)
    } catch (err: unknown) {
      toast.show({
        title: 'Error al emitir',
        message: readApiError(err, 'No se pudo crear el acta de salida.'),
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  if (!canCreate) {
    return (
      <TenantSessionGate title="Nueva Acta" lead="Despacho parcial de equipos listos para retiro.">
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso restringido"
            subtitle="Requieres repairs.dispatches.create para generar actas de despacho."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
          <SectionCard title="Permisos insuficientes">
            <Button type="button" variant="outline" onClick={() => navigate('/taller/despachos')}>
              <ArrowLeft size={16} strokeWidth={2} aria-hidden />
              Volver a Actas
            </Button>
          </SectionCard>
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Generar Acta de Despacho"
      lead="Selecciona un subconjunto de equipos listos y emite el acta parcial o total."
    >
      <div className="ecu-dashboard-layout ecu-dashboard-layout--fluid">
        <PageHeader
          title="Generar Acta de Despacho"
          subtitle="Despacho parcial o total de equipos en estado «Listo para Retiro», con datos de transporte y estimación de tarifas."
          badge={
            <StatusBadge tone={isPartial ? 'warning' : 'primary'} withDot>
              {isPartial ? 'Despacho parcial' : 'Asistente de salida'}
            </StatusBadge>
          }
          actions={
            <>
              <Button type="button" variant="outline" onClick={() => navigate('/taller/despachos')}>
                <ArrowLeft size={16} strokeWidth={2} aria-hidden />
                Volver
              </Button>
              <EcuPageActions
                items={actionItems}
                variant="outline"
                triggerLabel="Acciones"
                renderIcon={renderSidebarIcon}
                onNavigate={(route: string) => navigate(route)}
              />
            </>
          }
        />

        {error && (
          <div className="ecu-form-error-banner" role="alert">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
        )}

        <div className="ecu-stat-grid">
          <StatCard
            label="Equipos listos"
            value={String(readyEquipments.length)}
            icon={<PackageCheck size={20} strokeWidth={2} aria-hidden />}
            toneColor="var(--shell-primary)"
          />
          <StatCard
            label="Seleccionados"
            value={String(selectedEquipments.length)}
            icon="checklist"
            toneColor="var(--shell-primary)"
          />
          <StatCard
            label="Estimado USD"
            value={`$${estimatedUsd.toFixed(2)}`}
            icon="payments"
            toneColor="var(--shell-primary)"
            footerText="Según tarifas N1/N2/N3 del lote"
          />
        </div>

        {/* Emisor del Despacho (Usuario de la Cuenta) */}
        <SectionCard
          title="Emisor del despacho"
          subtitle="Usuario de la cuenta que autoriza y emite el acta de entrega"
          action={
            <StatusBadge tone="success" withDot>
              Sesión Verificada
            </StatusBadge>
          }
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--shell-border)',
              backgroundColor: 'var(--glb-surface)',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(var(--shell-primary-rgb, 14, 165, 233), 0.12)',
                  color: 'var(--shell-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '1.05rem',
                }}
              >
                <UserCheck size={20} strokeWidth={2} aria-hidden />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--glb-text)' }}>
                    {currentUserName}
                  </strong>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: 'var(--glb-app-bg, #f1f5f9)',
                      border: '1px solid var(--shell-border)',
                      color: 'var(--glb-muted)',
                      fontWeight: 600,
                    }}
                  >
                    {currentUserRole}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--glb-muted)', marginTop: '2px' }}>
                  {currentUserEmail ? `${currentUserEmail} · ` : ''}Aparece en el bloque «Emisor Autorizado» del Acta oficial en PDF.
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.785rem', color: 'var(--glb-muted)', maxWidth: 280, textAlign: 'right' }}>
              El despacho quedará certificado con hash criptográfico SHA-256 ligado a esta empresa y usuario.
            </div>
          </div>
        </SectionCard>

        {/* Tipo de egreso / salida */}
        <SectionCard
          title="Tipo de egreso"
          subtitle="Define el motivo por el que los equipos salen del taller"
        >
          <div className="ecu-modal-form" style={{ paddingTop: 0 }}>
            <div className="ecu-modal-form__grid">
              {([
                {
                  value: DispatchExitType.Repaired,
                  icon: '✅',
                  label: 'Despacho de reparados',
                  desc: 'Equipos que aprobaron control de calidad y están listos para retiro.',
                  tone: 'success' as const,
                },
                {
                  value: DispatchExitType.Irreparable,
                  icon: '🔴',
                  label: 'Devolución de irreparables',
                  desc: 'Equipos declarados irreparables. Se devuelven con acta de baja técnica.',
                  tone: 'danger' as const,
                },
                {
                  value: DispatchExitType.ClientRequest,
                  icon: '🔄',
                  label: 'Retiro anticipado por cliente',
                  desc: 'El cliente retira el equipo antes de finalizar la reparación.',
                  tone: 'warning' as const,
                },
                {
                  value: DispatchExitType.TechRefusal,
                  icon: '⛔',
                  label: 'Rechazo técnico del taller',
                  desc: 'El equipo está fuera del alcance del servicio o presenta condiciones no aceptables.',
                  tone: 'warning' as const,
                },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setExitType(opt.value)
                    setReturnReason('')
                    setSelectedIds([])
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem',
                    padding: '0.85rem 1rem',
                    borderRadius: '8px',
                    border: `2px solid ${exitType === opt.value ? 'var(--shell-primary)' : 'var(--shell-border)'}`,
                    backgroundColor: exitType === opt.value ? 'rgba(var(--shell-primary-rgb, 14,165,233), 0.07)' : 'var(--glb-surface)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.15s, background-color 0.15s',
                  }}
                >
                  <span style={{ fontSize: '1.25rem', lineHeight: 1, flexShrink: 0, marginTop: '2px' }}>{opt.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--glb-text)', marginBottom: '2px' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--glb-muted)', lineHeight: 1.35 }}>
                      {opt.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {exitType !== DispatchExitType.Repaired && (
              <div className="ecu-modal-form__field" style={{ marginTop: '1rem' }}>
                <TextBox
                  id="create-dispatch-return-reason"
                  label="Motivo de salida *"
                  labelPosition="outlined"
                  variant="outline"
                  value={returnReason}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setReturnReason(e.target.value)}
                  placeholder={
                    exitType === DispatchExitType.Irreparable
                      ? 'ej. Compresor fundido, sin posibilidad de repuesto'
                      : exitType === DispatchExitType.ClientRequest
                        ? 'ej. Cliente solicita retiro urgente para viaje al exterior'
                        : 'ej. Equipo con corrosión severa fuera del contrato de servicio'
                  }
                  fullWidth
                />
              </div>
            )}
          </div>
        </SectionCard>

        {/* Lote y número de acta */}
        <SectionCard
          title="Lote y número de acta"
          subtitle="Elige el lote de origen y el identificador oficial del acta de salida"
        >
          <div className="ecu-modal-form" style={{ paddingTop: 0 }}>
            <div className="ecu-modal-form__grid">
              <div className="ecu-modal-form__field">
                <Select
                  id="create-dispatch-batch"
                  label="Lote origen *"
                  labelPosition="outlined"
                  variant="outline"
                  options={batchOptions}
                  value={selectedBatchId}
                  onChange={(val: string) => setSelectedBatchId(val)}
                  placeholder={
                    loadingBatches ? 'Cargando lotes...' : 'Seleccionar lote con equipos listos...'
                  }
                  fullWidth
                  disabled={loadingBatches}
                />
              </div>
              <div className="ecu-modal-form__field">
                <TextBox
                  id="create-dispatch-number"
                  label="Número de acta *"
                  labelPosition="outlined"
                  variant="outline"
                  value={dispatchNumber}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDispatchNumber(e.target.value)}
                  placeholder="ej. DSP-2026-WPH-001"
                  required
                  fullWidth
                />
              </div>
            </div>
            <div className="ecu-modal-form__field">
              <TextBox
                id="create-dispatch-notes"
                label="Notas / observaciones"
                labelPosition="outlined"
                variant="outline"
                value={notes}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
                placeholder="Opcional — instrucciones de retiro, muelle, etc."
                fullWidth
              />
            </div>
          </div>
        </SectionCard>

        {/* Datos del transportista y retiro */}
        <SectionCard
          title="Datos del transportista y retiro"
          subtitle="Selecciona un operador registrado o ingresa los datos de quien retira los equipos"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCarrierModalOpen(true)}
            >
              <Truck size={14} strokeWidth={2} aria-hidden />
              Directorio de Operadores
            </Button>
          }
        >
          <div className="ecu-modal-form" style={{ paddingTop: 0 }}>
            <div className="ecu-modal-form__field" style={{ marginBottom: '1rem' }}>
              <Select
                id="select-frequent-carrier"
                label="Operador de transporte registrado"
                labelPosition="outlined"
                variant="outline"
                options={carrierOptions}
                value={selectedCarrierId}
                onChange={handleSelectCarrierOption}
                fullWidth
              />
            </div>

            <div className="ecu-modal-form__grid--3">
              <div className="ecu-modal-form__field">
                <TextBox
                  id="create-carrier-name"
                  label="Operador de transporte *"
                  labelPosition="outlined"
                  variant="outline"
                  value={carrierName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setCarrierName(e.target.value)
                    setSelectedCarrierId('')
                  }}
                  placeholder="Nombre o razón social del operador"
                  fullWidth
                  required
                />
              </div>
              <div className="ecu-modal-form__field">
                <TextBox
                  id="create-carrier-doc"
                  label="Cédula / RUC del operador *"
                  labelPosition="outlined"
                  variant="outline"
                  value={carrierDocument}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setCarrierDocument(e.target.value)}
                  placeholder="ej. 1718293847 o 0992345678001"
                  fullWidth
                />
              </div>
              <div className="ecu-modal-form__field">
                <TextBox
                  id="create-carrier-plate"
                  label="Placa de vehículo"
                  labelPosition="outlined"
                  variant="outline"
                  value={carrierPlate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setCarrierPlate(e.target.value)}
                  placeholder="ej. PBH-8942 o GDK-6574"
                  fullWidth
                />
              </div>
            </div>

            <div style={{ marginTop: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                id="save-carrier-checkbox"
                type="checkbox"
                checked={saveCarrierCheckbox}
                onChange={(e) => setSaveCarrierCheckbox(e.target.checked)}
                style={{ cursor: 'pointer', width: '15px', height: '15px' }}
              />
              <label
                htmlFor="save-carrier-checkbox"
                style={{ fontSize: '0.825rem', color: 'var(--glb-text)', cursor: 'pointer' }}
              >
                Guardar este operador de transporte en el directorio frecuente
              </label>
            </div>
          </div>
        </SectionCard>

        {/* Equipos elegibles según tipo de egreso */}
        <SectionCard
          title={
            exitType === DispatchExitType.Repaired
              ? `Equipos listos para despacho (${readyEquipments.length})`
              : `${dispatchExitTypeLabel(exitType)} — Equipos (${readyEquipments.length})`
          }
          subtitle={
            exitType === DispatchExitType.Repaired
              ? 'Selecciona los equipos aprobados en control de calidad que se incluyen en esta acta.'
              : exitType === DispatchExitType.Irreparable
                ? 'Selecciona los equipos declarados irreparables que se devuelven al cliente.'
                : 'Selecciona los equipos que el cliente retira o el taller rechaza.'
          }
          action={
            readyEquipments.length > 0 ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
                  Seleccionar todos
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                  Limpiar
                </Button>
              </div>
            ) : undefined
          }
        >
          {!selectedBatchId ? (
            <EmptyState
              icon={<PackageCheck size={22} strokeWidth={1.75} aria-hidden />}
              title="Selecciona un lote"
              description="Elige un lote con equipos en estado «Listo para Retiro» para armar el despacho."
            />
          ) : loadingEquipments ? (
            <p className="ecu-modal-section-lead" style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              Cargando equipos listos...
            </p>
          ) : readyEquipments.length === 0 ? (
            <EmptyState
              className="ecu-empty-state--compact"
              icon={<PackageCheck size={22} strokeWidth={1.75} aria-hidden />}
              title="Sin equipos listos"
              description="No hay equipos en «Listo para Retiro» en este lote. Actualiza la fase técnica desde el detalle del lote."
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/taller/lotes/${selectedBatchId}`)}
                >
                  Ir al lote
                </Button>
              }
            />
          ) : (
            <DataGrid<Row>
              className="ecu-repairs-grid"
              columns={columns}
              dataSource={readyEquipments as Row[]}
              keyExpr="id"
              selectionMode="multiple"
              selectedRowIds={selectedIds}
              onSelectionChange={(rows: Row[]) => setSelectedIds(rows.map((r) => r.id))}
              showSearch
              searchPosition="left"
              searchWidth={280}
              searchPlaceholder="Buscar por serie, modelo o marca..."
              loading={loadingEquipments}
              paging={paging}
              pageSizeOptions={pageSizeOptions}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              messages={messages}
              fullWidth
            />
          )}
        </SectionCard>

        {exitType === DispatchExitType.Repaired && missingPricingEquipments.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '0.85rem 1.15rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: 'var(--glb-text)',
              fontSize: '0.875rem',
              lineHeight: 1.45,
            }}
          >
            <AlertCircle size={20} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} aria-hidden />
            <div>
              <strong style={{ display: 'block', color: '#dc2626', marginBottom: '0.2rem' }}>
                Precio de facturación no definido
              </strong>
              <span>
                No se puede generar el acta de reparación exitosa si no se ha definido un precio para facturación. Hay{' '}
                <strong>{missingPricingEquipments.length} equipo(s)</strong> seleccionado(s) sin tarifa pactada (N1, N2 o N3).
                Configure las tarifas en el lote o en la ficha del cliente antes de emitir la salida.
              </span>
            </div>
          </div>
        )}

        {exitType === DispatchExitType.Repaired && (
          <SectionCard
            title="Facturación electrónica SRI"
            subtitle="Generación automática del comprobante de venta por los equipos reacondicionados"
            action={
              autoInvoice ? (
                <StatusBadge tone="success" withDot>
                  Facturación Automática Activada
                </StatusBadge>
              ) : (
                <StatusBadge tone="neutral">Facturación Manual Posterior</StatusBadge>
              )
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  border: autoInvoice
                    ? '1px solid var(--shell-primary)'
                    : '1px solid var(--shell-border)',
                  backgroundColor: autoInvoice
                    ? 'rgba(var(--shell-primary-rgb, 14, 165, 233), 0.05)'
                    : 'var(--glb-surface)',
                  transition: 'all 0.2s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={autoInvoice}
                  onChange={(e) => setAutoInvoice(e.target.checked)}
                  style={{
                    marginTop: '0.2rem',
                    accentColor: 'var(--shell-primary)',
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                  }}
                />
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem', color: 'var(--glb-text)' }}>
                    Generar automáticamente borrador de factura electrónica al emitir la salida
                  </strong>
                  <span style={{ fontSize: '0.85rem', color: 'var(--glb-muted)' }}>
                    Agrupa los {selectedEquipments.length} equipos seleccionados según sus tarifas N1/N2/N3 del lote y vincula la factura directamente al acta para su posterior firma y transmisión al SRI.
                  </span>
                </div>
              </label>

              {autoInvoice && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '0.75rem',
                    padding: '0.85rem 1rem',
                    borderRadius: '6px',
                    backgroundColor: 'var(--glb-surface-variant, rgba(0,0,0,0.03))',
                    fontSize: '0.875rem',
                    border: '1px solid var(--shell-border)',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--glb-muted)', display: 'block', fontSize: '0.8rem' }}>
                      Subtotal estimado ({selectedEquipments.length} eq.):
                    </span>
                    <strong style={{ fontSize: '1rem', color: 'var(--glb-text)' }}>
                      ${estimatedUsd.toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--glb-muted)', display: 'block', fontSize: '0.8rem' }}>
                      IVA estimado (15%):
                    </span>
                    <strong style={{ fontSize: '1rem', color: 'var(--glb-text)' }}>
                      ${(estimatedUsd * 0.15).toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--glb-muted)', display: 'block', fontSize: '0.8rem' }}>
                      Total estimado comprobante:
                    </span>
                    <strong style={{ color: 'var(--shell-primary)', fontSize: '1.1rem' }}>
                      ${(estimatedUsd * 1.15).toFixed(2)}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            flexWrap: 'wrap',
            paddingTop: '0.5rem',
            borderTop: '1px solid var(--shell-border)',
            position: 'sticky',
            bottom: 0,
            background: 'var(--glb-app-bg, var(--shell-bg))',
            paddingBottom: '0.75rem',
            zIndex: 2,
          }}
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/taller/despachos')}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={
              saving ||
              selectedIds.length === 0 ||
              !selectedBatchId ||
              !dispatchNumber.trim() ||
              (exitType === DispatchExitType.Repaired && missingPricingEquipments.length > 0)
            }
          >
            {saving
              ? 'Emitiendo acta...'
              : exitType === DispatchExitType.Repaired && missingPricingEquipments.length > 0
                ? `Falta definir precio (${missingPricingEquipments.length} eq.)`
                : exitType === DispatchExitType.Repaired
                  ? `Emitir acta (${selectedIds.length} equipos · $${estimatedUsd.toFixed(2)})`
                  : `Registrar salida (${selectedIds.length} equipos — ${dispatchExitTypeLabel(exitType)})`}
          </Button>
        </div>
      </div>

      <ManageCarriersModal
        isOpen={isCarrierModalOpen}
        onClose={() => setIsCarrierModalOpen(false)}
        tenantId={tenantId ?? ''}
        onSelectCarrier={handleCarrierChosenFromModal}
        selectedCarrierId={selectedCarrierId}
      />
    </TenantSessionGate>
  )
}
