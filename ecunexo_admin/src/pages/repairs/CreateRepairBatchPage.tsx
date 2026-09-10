import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, TextBox, useToast, type PageActionItem } from 'glubox'
import { EcuPageActions, PageHeader, SectionCard, StatusBadge } from '@/components/ui'
import { ArrowLeft, Download, FileSpreadsheet, Info, UploadCloud } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import {
  downloadRepairTemplate,
  importRepairBatch,
  listRepairCustomers,
} from '@/services/repairsApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { RepairCustomerDto } from '@/types/repairsApi'

export function CreateRepairBatchPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const canImport = useHasPermission('repairs.batches.import')

  const [customers, setCustomers] = useState<RepairCustomerDto[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [contractRef, setContractRef] = useState('')
  const [rateN1, setRateN1] = useState('35.00')
  const [rateN2, setRateN2] = useState('65.00')
  const [rateN3, setRateN3] = useState('110.00')
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const actionItems = useMemo<PageActionItem[]>(() => [
    {
      id: 'batches',
      label: 'Listado de lotes',
      icon: 'layers',
      route: '/taller/lotes',
      disabled: false,
    },
    {
      id: 'template',
      label: 'Descargar plantilla Excel',
      icon: 'download',
      route: null,
      disabled: downloadingTemplate,
    },
  ], [downloadingTemplate])

  const handleActionSelect = useCallback((item: PageActionItem) => {
    if (item.id === 'template') {
      void handleDownloadTemplate()
    }
  }, [tenantId])

  useEffect(() => {
    if (!tenantId) return
    let active = true

    void (async () => {
      try {
        const list = await listRepairCustomers(tenantId)
        if (!active) return
        setCustomers(list)
        if (list.length > 0) {
          const wph = list.find((c) => c.name.toLowerCase().includes('whirlpool')) ?? list[0]
          setSelectedCustomerId(wph.id)
        }
      } catch {
        if (active) setCustomers([])
      }
    })()

    // Generar sugerencia de lote
    const now = new Date()
    const year = now.getFullYear()
    const randomSuffix = Math.floor(100 + Math.random() * 900)
    setBatchNumber(`LOTE-WPH-${year}-${randomSuffix}`)
    setContractRef(`CT-WPH-${year}-Q${Math.floor(now.getMonth() / 3) + 1}`)

    return () => {
      active = false
    }
  }, [tenantId])

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: `${c.name} ${c.taxId ? `(${c.taxId})` : ''}`,
      })),
    [customers]
  )

  const handleDownloadTemplate = async () => {
    if (!tenantId) return
    setDownloadingTemplate(true)
    try {
      const blob = await downloadRepairTemplate(tenantId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Plantilla_Lote_Equipos_Taller.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.show({
        title: 'Plantilla generada',
        message: 'Se descargó la plantilla oficial Excel de EcuNexo Taller.',
        variant: 'success',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'Error',
        message: readApiError(err, 'No se pudo descargar la plantilla.'),
        variant: 'error',
      })
    } finally {
      setDownloadingTemplate(false)
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setError(null)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) {
      if (!dropped.name.endsWith('.xlsx') && !dropped.name.endsWith('.xls')) {
        setError('El archivo debe ser un libro de Excel válido (.xlsx o .xls).')
        return
      }
      setFile(dropped)
      setError(null)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!tenantId) return

    if (!selectedCustomerId) {
      setError('Debes seleccionar un cliente corporativo.')
      return
    }

    if (!batchNumber.trim()) {
      setError('El número de lote es obligatorio.')
      return
    }

    if (!file) {
      setError('Debes adjuntar el archivo Excel con los equipos a importar.')
      return
    }

    setBusy(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('customerId', selectedCustomerId)
      formData.append('batchNumber', batchNumber.trim())
      if (contractRef.trim()) formData.append('contractReference', contractRef.trim())
      if (rateN1) formData.append('rateN1', rateN1)
      if (rateN2) formData.append('rateN2', rateN2)
      if (rateN3) formData.append('rateN3', rateN3)
      formData.append('file', file)

      const result = await importRepairBatch(tenantId, formData)

      toast.show({
        title: '¡Lote importado con éxito!',
        message: `Se registraron ${result.totalImported} equipos (N1: ${result.level1Count}, N2: ${result.level2Count}, N3: ${result.level3Count}).`,
        variant: 'success',
      })

      navigate(`/taller/lotes/${result.batchId}`)
    } catch (err: unknown) {
      const msg = readApiError(err, 'Error al procesar la importación del lote.')
      setError(msg)
      toast.show({ title: 'Error en importación', message: msg, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  if (!canImport) {
    return (
      <TenantSessionGate
        title="Importar Lote"
        lead="Recepción masiva de equipos mediante plantilla Excel."
      >
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres el permiso repairs.batches.import para importar lotes de equipos."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
          <SectionCard title="Permisos insuficientes">
            <p className="app-shell__muted" style={{ marginBottom: '1rem' }}>
              No posees los privilegios requeridos para realizar la importación masiva de lotes de electrodomésticos en esta empresa.
            </p>
            <Button type="button" variant="outline" onClick={() => navigate('/taller/lotes')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Lotes
            </Button>
          </SectionCard>
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Importar Lote de Reparación"
      lead="Recepción masiva de equipos mediante plantilla Excel con mapeo dinámico de atributos y tarifas por nivel de daño."
    >
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Importar Lote de Reparación"
          subtitle="Recepción masiva de equipos mediante plantilla Excel con mapeo dinámico de atributos y tarifas por nivel de daño."
          badge={<StatusBadge tone="primary" withDot>Asistente de Ingreso</StatusBadge>}
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/taller/lotes')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a Lotes
              </Button>
              <EcuPageActions
                items={actionItems}
                variant="outline"
                triggerLabel="Acciones de importación"
                renderIcon={renderSidebarIcon}
                onNavigate={(route: string) => navigate(route)}
                onActionSelect={handleActionSelect}
              />
            </>
          }
        />

        <div style={{ maxWidth: '56rem', margin: '0 auto', width: '100%' }}>
          {error && (
            <div className="ecu-form-error-banner mb-6" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
          <SectionCard
            title="Datos del Contrato y Cliente"
            subtitle="Identificación del fabricante y número de control interno del lote"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Select
                  id="repair-customer"
                  label="Cliente Corporativo *"
                  labelPosition="outlined"
                  variant="outline"
                  options={customerOptions}
                  value={selectedCustomerId}
                  onChange={(val: string) => setSelectedCustomerId(val)}
                  fullWidth
                />
              </div>

              <div>
                <TextBox
                  id="repair-batch-num"
                  label="Número de Lote *"
                  labelPosition="outlined"
                  variant="outline"
                  value={batchNumber}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setBatchNumber(e.target.value)}
                  placeholder="ej. LOTE-WPH-2026-001"
                  required
                  fullWidth
                />
              </div>

              <div className="md:col-span-2">
                <TextBox
                  id="repair-contract-ref"
                  label="Referencia de Contrato / Orden Marco"
                  labelPosition="outlined"
                  variant="outline"
                  value={contractRef}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setContractRef(e.target.value)}
                  placeholder="ej. Contrato Reacondicionamiento Whirlpool Anual #452"
                  fullWidth
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Tarifario Acordado de Servicio ($ USD)"
            subtitle="Tarifas pactadas por equipo según nivel de daño para la liquidación y facturación SRI"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                    Nivel 1 (Leve / Estético)
                  </span>
                  <StatusBadge tone="info">N1</StatusBadge>
                </div>
                <TextBox
                  id="repair-rate-n1"
                  label="Tarifa N1 ($)"
                  labelPosition="outlined"
                  variant="outline"
                  value={rateN1}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setRateN1(e.target.value)}
                  placeholder="35.00"
                  fullWidth
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Rayones leves, limpieza, perillas
                </span>
              </div>

              <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                    Nivel 2 (Medio / Chapa)
                  </span>
                  <StatusBadge tone="warning">N2</StatusBadge>
                </div>
                <TextBox
                  id="repair-rate-n2"
                  label="Tarifa N2 ($)"
                  labelPosition="outlined"
                  variant="outline"
                  value={rateN2}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setRateN2(e.target.value)}
                  placeholder="65.00"
                  fullWidth
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Golpes en paneles laterales, pintura
                </span>
              </div>

              <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                    Nivel 3 (Grave / Estructural)
                  </span>
                  <StatusBadge tone="danger">N3</StatusBadge>
                </div>
                <TextBox
                  id="repair-rate-n3"
                  label="Tarifa N3 ($)"
                  labelPosition="outlined"
                  variant="outline"
                  value={rateN3}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setRateN3(e.target.value)}
                  placeholder="110.00"
                  fullWidth
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Descuadre de chasis, motores, cableado
                </span>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Planilla de Equipos (Excel)"
            subtitle="Arrastra el archivo entregado por Whirlpool o descarga la plantilla oficial con validación"
            action={
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
              >
                <Download className="w-4 h-4 mr-2" />
                {downloadingTemplate ? 'Generando...' : 'Descargar Plantilla Oficial'}
              </Button>
            }
          >
            <div
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50/20'
                  : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />

              {file ? (
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mb-3">
                    <FileSpreadsheet className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {file.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {(file.size / 1024).toFixed(1)} KB — Clic para cambiar archivo
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center mb-3">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Arrastra el archivo Excel aquí o haz clic para examinar
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Formatos soportados: .xlsx, .xls (Máximo 500 equipos por lote)
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
              <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <strong>Mapeo dinámico y atributos adicionales:</strong> Columnas como{' '}
                <code>serial_number</code>, <code>model</code>, <code>brand</code> y{' '}
                <code>damage_level</code> se asignan directamente al catálogo técnico. Cualquier
                columna adicional en el Excel (ej. <em>pallet_id</em>, <em>bodega_origen</em>) se
                guardará de forma automática en el esquema JSONB del equipo sin perder datos.
              </div>
            </div>
          </SectionCard>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/taller/lotes')}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={busy || !file}
            >
              {busy ? 'Procesando e Importando...' : 'Importar Lote y Registrar Equipos'}
            </Button>
          </div>
        </form>
        </div>
      </div>
    </TenantSessionGate>
  )
}
