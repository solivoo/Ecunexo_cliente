import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, DataGrid, Select, TextBox, useToast, type ColumnDef } from 'glubox'
import {
  EcuModal,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { GridIconButton } from '@/components/ui/GridIconButton'
import {
  Copy,
  ExternalLink,
  FileCheck2,
  Plus,
  QrCode,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { formatDateTime } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  createRepairDispatch,
  listBatchEquipments,
  listRepairBatches,
  listRepairDispatches,
} from '@/services/repairsApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  RepairEquipmentStatus,
  type BatchListItemDto,
  type RepairDispatchDto,
  type RepairEquipmentDto,
} from '@/types/repairsApi'

type Row = RepairDispatchDto & Record<string, unknown>

const messages = createSpanishDataGridMessages('despacho', 'despachos')

export function RepairDispatchesListPage() {
  const toast = useToast()
  const [params] = useSearchParams()
  const tenantId = useAppSelector(selectTenantId)
  const initialBatchId = params.get('batchId')

  const [dispatches, setDispatches] = useState<RepairDispatchDto[]>([])
  const [batches, setBatches] = useState<BatchListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  // Modal de Crear Despacho
  const [createModalOpen, setCreateModalOpen] = useState(Boolean(initialBatchId))
  const [selectedBatchId, setSelectedBatchId] = useState(initialBatchId ?? '')
  const [readyEquipments, setReadyEquipments] = useState<RepairEquipmentDto[]>([])
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<Set<string>>(new Set())
  const [loadingEquipments, setLoadingEquipments] = useState(false)
  const [dispatchNumber, setDispatchNumber] = useState('')
  const [carrierName, setCarrierName] = useState('')
  const [carrierDocument, setCarrierDocument] = useState('')
  const [carrierPlate, setCarrierPlate] = useState('')
  const [savingDispatch, setSavingDispatch] = useState(false)

  // Modal de Ver QR y Acta
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [activeDispatch, setActiveDispatch] = useState<RepairDispatchDto | null>(null)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId) return
      setLoading(true)
      try {
        const [dList, bList] = await Promise.all([
          listRepairDispatches(tenantId),
          listRepairBatches(tenantId),
        ])
        setDispatches(dList)
        setBatches(bList)
        setError(null)
        if (!opts?.silent) {
          toast.show({ title: 'Actualizado', message: 'Despachos sincronizados.', variant: 'success' })
        }
      } catch (err: unknown) {
        const msg = readApiError(err, 'No se pudieron cargar los despachos.')
        setError(msg)
        setDispatches([])
        toast.show({ title: 'Error', message: msg, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [tenantId, toast]
  )

  useEffect(() => {
    void load({ silent: true })
  }, [load])

  // Cargar equipos listos cuando cambia el lote en el modal
  useEffect(() => {
    if (!tenantId || !selectedBatchId) {
      setReadyEquipments([])
      setSelectedEquipmentIds(new Set())
      return
    }

    setLoadingEquipments(true)
    void (async () => {
      try {
        const list = await listBatchEquipments(
          tenantId,
          selectedBatchId,
          RepairEquipmentStatus.ReadyToDispatch
        )
        setReadyEquipments(list)
        // Seleccionar todos por defecto
        setSelectedEquipmentIds(new Set(list.map((e) => e.id)))
      } catch {
        setReadyEquipments([])
        setSelectedEquipmentIds(new Set())
      } finally {
        setLoadingEquipments(false)
      }
    })()
  }, [selectedBatchId, tenantId])

  // Autogenerar número de despacho
  const openCreateModal = () => {
    const now = new Date()
    const year = now.getFullYear()
    const seq = Math.floor(100 + Math.random() * 900)
    setDispatchNumber(`DSP-${year}-WPH-${seq}`)
    setCarrierName('Transportes Rápidos Ecuador S.A.')
    setCarrierPlate('PBH-8942')
    setCarrierDocument('1719283746')
    setCreateModalOpen(true)
  }

  const toggleSelectAll = () => {
    if (selectedEquipmentIds.size === readyEquipments.length) {
      setSelectedEquipmentIds(new Set())
    } else {
      setSelectedEquipmentIds(new Set(readyEquipments.map((e) => e.id)))
    }
  }

  const toggleSelectEquipment = (id: string) => {
    const next = new Set(selectedEquipmentIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedEquipmentIds(next)
  }

  const handleCreateDispatch = async () => {
    if (!tenantId) return
    if (!selectedBatchId) {
      toast.show({ title: 'Atención', message: 'Debes seleccionar un lote.', variant: 'error' })
      return
    }
    if (selectedEquipmentIds.size === 0) {
      toast.show({ title: 'Atención', message: 'Selecciona al menos un equipo listo.', variant: 'error' })
      return
    }

    setSavingDispatch(true)
    try {
      const res = await createRepairDispatch(tenantId, {
        batchId: selectedBatchId,
        dispatchNumber: dispatchNumber.trim(),
        equipmentIds: Array.from(selectedEquipmentIds),
        carrierName: carrierName.trim() || undefined,
        carrierDocument: carrierDocument.trim() || undefined,
        carrierVehiclePlate: carrierPlate.trim() || undefined,
      })

      toast.show({
        title: '¡Despacho Emitido!',
        message: `Acta ${res.dispatchNumber} generada con ${res.dispatchedCount} equipos.`,
        variant: 'success',
      })

      setCreateModalOpen(false)
      void load({ silent: true })

      // Abrir QR del nuevo despacho
      const updatedList = await listRepairDispatches(tenantId)
      const found = updatedList.find((d) => d.id === res.dispatchId)
      if (found) {
        setActiveDispatch(found)
        setQrModalOpen(true)
      }
    } catch (err: unknown) {
      toast.show({
        title: 'Error al emitir',
        message: readApiError(err, 'No se pudo crear el acta de despacho.'),
        variant: 'error',
      })
    } finally {
      setSavingDispatch(false)
    }
  }

  const handleOpenQrModal = (d: RepairDispatchDto) => {
    setActiveDispatch(d)
    setQrModalOpen(true)
  }

  const publicVerifyUrl = useMemo(() => {
    if (!activeDispatch) return ''
    return `${window.location.origin}/verificar/despacho/${activeDispatch.verificationHash}`
  }, [activeDispatch])

  const copyVerifyUrl = async () => {
    if (!publicVerifyUrl) return
    await navigator.clipboard.writeText(publicVerifyUrl)
    toast.show({
      title: 'Enlace copiado',
      message: 'Se copió la URL de verificación pública al portapapeles.',
      variant: 'success',
    })
  }

  const batchOptions = useMemo(
    () =>
      batches.map((b) => ({
        value: b.id,
        label: `${b.batchNumber} (${b.customerName}) — ${b.readyCount} listos`,
      })),
    [batches]
  )

  const columns = useMemo(
    (): ColumnDef<Row>[] => [
      {
        key: 'dispatchNumber',
        header: 'Nº Acta Despacho',
        width: 180,
        sortable: true,
        renderCell: (_v: Row['dispatchNumber'], row: Row) => (
          <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
            {row.dispatchNumber}
          </span>
        ),
      },
      {
        key: 'carrierName',
        header: 'Transportista',
        width: 200,
        sortable: true,
        renderCell: (_v: Row['carrierName'], row: Row) => (
          <div>
            <div className="font-medium text-slate-800 dark:text-slate-200">
              {row.carrierName || 'No registrado'}
            </div>
            {row.carrierVehiclePlate && (
              <span className="text-xs text-slate-500 font-mono">
                Placa: {row.carrierVehiclePlate}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'id',
        header: 'Equipos',
        width: 110,
        align: 'center',
        renderCell: (_v: unknown, row: Row) => (
          <span className="font-bold text-indigo-600 dark:text-indigo-400">
            {row.items?.length ?? 0} unidades
          </span>
        ),
      },
      {
        key: 'dispatchedAt',
        header: 'Fecha Salida',
        width: 170,
        sortable: true,
        renderCell: (_v: Row['dispatchedAt'], row: Row) => (
          <span>{row.dispatchedAt ? formatDateTime(row.dispatchedAt) : 'En preparación'}</span>
        ),
      },
      {
        key: 'status',
        header: 'Estado',
        width: 130,
        renderCell: () => <StatusBadge tone="success" withDot>Emitido / Certificado</StatusBadge>,
      },
      {
        key: 'id',
        header: 'Acta & QR',
        width: 100,
        align: 'center',
        renderCell: (_v: unknown, row: Row) => (
          <GridIconButton
            icon={QrCode}
            label="Ver Acta Oficial y Código QR"
            onClick={() => handleOpenQrModal(row)}
          />
        ),
      },
    ],
    []
  )

  const totalDispatchedEquipments = useMemo(() => {
    return dispatches.reduce((acc, d) => acc + (d.items?.length ?? 0), 0)
  }, [dispatches])

  return (
    <TenantSessionGate
      title="Actas y Despachos de Reparación"
      lead="Entrega certificada de electrodomésticos reparados con código QR de verificación móvil."
    >
      <div className="ecu-page-container">
        <PageHeader
          title="Actas y Despachos de Salida"
          subtitle="Entrega certificada de electrodomésticos reparados con código QR de verificación móvil y preparación para facturación SRI."
          badge={<StatusBadge tone="success">Trazabilidad QR</StatusBadge>}
          actions={
            <Button type="button" variant="primary" onClick={openCreateModal}>
              <Plus className="w-4 h-4 mr-2" />
              Emitir Despacho
            </Button>
          }
        />

        <div className="ecu-stat-grid">
          <StatCard
            label="Total Despachos"
            value={dispatches.length}
            icon={<FileCheck2 className="w-5 h-5 text-indigo-500" />}
            toneColor="#6366f1"
            footerText="Actas emitidas con firma"
          />
          <StatCard
            label="Equipos Retirados"
            value={totalDispatchedEquipments}
            icon={<Truck className="w-5 h-5 text-emerald-500" />}
            toneColor="#10b981"
            footerText="Reincorporados a Whirlpool"
          />
          <StatCard
            label="Certificación Digital"
            value="100% QR"
            icon={<ShieldCheck className="w-5 h-5 text-blue-500" />}
            toneColor="#3b82f6"
            footerText="Auditables sin login"
          />
        </div>

        <SectionCard
          title="Historial de Despachos"
          subtitle="Listado cronológico de despachos de lotes y números de control"
        >
          {error && (
            <div className="ecu-form-error-banner mb-4" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          )}

          {dispatches.length === 0 && !loading ? (
            <EmptyState
              icon="local_shipping"
              title="Aún no se han emitido despachos"
              description="Cuando tus equipos superen el control de calidad y pasen al estado 'Listo para Retiro', podrás emitir el acta con código QR aquí."
              action={
                <Button type="button" variant="primary" onClick={openCreateModal}>
                  <Plus className="w-4 h-4 mr-2" />
                  Emitir Primer Despacho
                </Button>
              }
            />
          ) : (
            <DataGrid
              className="ecu-companies-grid"
              dataSource={dispatches as Row[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={280}
              searchPlaceholder="Buscar por acta o transportista..."
              loading={loading}
              paging={paging}
              pageSizeOptions={pageSizeOptions}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              messages={messages}
            />
          )}
        </SectionCard>

        {/* Modal de Crear Despacho */}
        <EcuModal
          open={createModalOpen}
          title="Generar Acta de Despacho y Salida de Equipos"
          onClose={() => setCreateModalOpen(false)}
          footer={
            <div className="flex justify-end gap-2 w-full">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateModalOpen(false)}
                disabled={savingDispatch}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleCreateDispatch}
                disabled={savingDispatch || selectedEquipmentIds.size === 0}
              >
                {savingDispatch
                  ? 'Generando Acta...'
                  : `Emitir Despacho (${selectedEquipmentIds.size} Equipos)`}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Select
                  id="dispatch-batch-id"
                  label="Lote Origen *"
                  labelPosition="outlined"
                  variant="outline"
                  options={batchOptions}
                  value={selectedBatchId}
                  onChange={(val: string) => setSelectedBatchId(val)}
                  fullWidth
                />
              </div>

              <div>
                <TextBox
                  id="dispatch-num-input"
                  label="Número de Acta *"
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

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <TextBox
                  id="carrier-name-input"
                  label="Conductor / Transportista"
                  labelPosition="outlined"
                  variant="outline"
                  value={carrierName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setCarrierName(e.target.value)}
                  placeholder="Nombre y Apellido"
                  fullWidth
                />
              </div>

              <div>
                <TextBox
                  id="carrier-doc-input"
                  label="Cédula / Documento"
                  labelPosition="outlined"
                  variant="outline"
                  value={carrierDocument}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setCarrierDocument(e.target.value)}
                  placeholder="ej. 1718293847"
                  fullWidth
                />
              </div>

              <div>
                <TextBox
                  id="carrier-plate-input"
                  label="Placa de Vehículo"
                  labelPosition="outlined"
                  variant="outline"
                  value={carrierPlate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setCarrierPlate(e.target.value)}
                  placeholder="ej. PBH-8942"
                  fullWidth
                />
              </div>
            </div>

            {/* Selector de equipos listos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  Equipos Listos para Despacho ({readyEquipments.length})
                </span>
                {readyEquipments.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline font-medium bg-transparent border-none p-0 cursor-pointer"
                    onClick={toggleSelectAll}
                  >
                    {selectedEquipmentIds.size === readyEquipments.length
                      ? 'Deseleccionar todos'
                      : 'Seleccionar todos'}
                  </button>
                )}
              </div>

              {loadingEquipments ? (
                <p className="text-xs text-slate-500 py-4 text-center">Cargando equipos listos...</p>
              ) : readyEquipments.length === 0 ? (
                <div className="p-4 text-center bg-amber-50/40 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/30 text-xs text-amber-700 dark:text-amber-300">
                  No hay equipos en estado 'Listo para Retiro' en este lote. Cambia el estado de los
                  equipos reparados primero.
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                  {readyEquipments.map((eq) => {
                    const isSelected = selectedEquipmentIds.has(eq.id)
                    return (
                      <div
                        key={eq.id}
                        className={`flex items-center justify-between p-2.5 text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/20'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                        }`}
                        onClick={() => toggleSelectEquipment(eq.id)}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectEquipment(eq.id)}
                            className="rounded text-primary focus:ring-primary h-4 w-4"
                          />
                          <div>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                              {eq.serialNumber}
                            </span>
                            <span className="text-slate-500 ml-2">
                              {eq.model} ({eq.brand})
                            </span>
                          </div>
                        </div>
                        <StatusBadge tone="success">Listo Retiro</StatusBadge>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </EcuModal>

        {/* Modal de Ver QR y Certificación Oficial */}
        <EcuModal
          open={qrModalOpen}
          title={`Acta de Despacho Oficial — ${activeDispatch?.dispatchNumber ?? ''}`}
          onClose={() => setQrModalOpen(false)}
          footer={
            <div className="flex justify-between items-center w-full">
              <Button type="button" variant="outline" onClick={copyVerifyUrl}>
                <Copy className="w-4 h-4 mr-2" />
                Copiar Enlace de Validación
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => window.open(publicVerifyUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir Pantalla Móvil QR
                </Button>
              </div>
            </div>
          }
        >
          {activeDispatch && (
            <div className="text-center space-y-4 py-2">
              <div className="inline-block p-4 bg-white rounded-2xl shadow-sm border border-slate-200">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    publicVerifyUrl
                  )}`}
                  alt="Código QR de Verificación"
                  className="w-44 h-44 mx-auto"
                />
              </div>

              <div>
                <span className="text-xs font-mono px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300">
                  Hash: {activeDispatch.verificationHash}
                </span>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-2">
                  Acta Digital de Entrega Certificada
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Cualquier transportista o auditor puede escanear este código QR con la cámara de
                  su teléfono para validar la lista de números de serie autorizados sin necesidad de
                  iniciar sesión.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-left text-xs space-y-1 border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Equipos Despachados:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {activeDispatch.items?.length ?? 0} unidades
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Conductor:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {activeDispatch.carrierName ?? 'No registrado'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Placa:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                    {activeDispatch.carrierVehiclePlate ?? '—'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </EcuModal>
      </div>
    </TenantSessionGate>
  )
}
