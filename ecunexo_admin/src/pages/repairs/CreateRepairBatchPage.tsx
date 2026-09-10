import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Popup, Select, TextBox, useToast, type PageActionItem } from 'glubox'
import { EcuPageActions, PageHeader, SectionCard, StatusBadge } from '@/components/ui'
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Info, Plus, RefreshCw, UploadCloud, XCircle } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { validateEcuadorTaxId, validateEmail, validatePhone } from '@/lib/ecuadorTaxIdValidator'
import { createCustomer, listCustomers } from '@/services/customersApi'
import {
  downloadRepairTemplate,
  importRepairBatch,
  previewRepairBatch,
} from '@/services/repairsApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  CustomerIdentificationType,
  CustomerType,
  type CustomerDto,
} from '@/types/customersApi'
import type { BatchPreviewResponse } from '@/types/repairsApi'

export function CreateRepairBatchPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const canImport = useHasPermission('repairs.batches.import')

  const [customers, setCustomers] = useState<CustomerDto[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [contractRef, setContractRef] = useState('')
  const [rateN1, setRateN1] = useState('')
  const [rateN2, setRateN2] = useState('')
  const [rateN3, setRateN3] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Previsualización y validación previa de la plantilla
  const [previewResult, setPreviewResult] = useState<BatchPreviewResponse | null>(null)
  const [validatingFile, setValidatingFile] = useState(false)

  // Modal para registrar nuevo cliente corporativo
  const [newCustomerOpen, setNewCustomerOpen] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustTaxId, setNewCustTaxId] = useState('')
  const [newCustPerson, setNewCustPerson] = useState('')
  const [newCustEmail, setNewCustEmail] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [newCustAddress, setNewCustAddress] = useState('')
  const [newCustNotes, setNewCustNotes] = useState('')
  const [savingCust, setSavingCust] = useState(false)
  const [newCustError, setNewCustError] = useState<string | null>(null)

  const actionItems = useMemo<PageActionItem[]>(() => [
    {
      id: 'template',
      label: 'Plantilla Excel',
      icon: 'download',
      route: null,
      disabled: downloadingTemplate,
    },
  ], [downloadingTemplate])

  const handleDownloadTemplate = useCallback(async () => {
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
  }, [tenantId, toast])

  const handleActionSelect = useCallback((item: PageActionItem) => {
    if (item.id === 'template') {
      void handleDownloadTemplate()
    }
  }, [handleDownloadTemplate])

  useEffect(() => {
    if (!tenantId) return
    let active = true

    void (async () => {
      try {
        const list = await listCustomers(tenantId)
        if (!active) return
        setCustomers(list.filter((c) => c.isActive))
      } catch {
        if (active) setCustomers([])
      }
    })()

    return () => {
      active = false
    }
  }, [tenantId])

  const customerOptions = useMemo(
    () => [
      { value: '', label: 'Seleccionar cliente habilitado...' },
      ...customers.map((c) => ({
        value: c.id,
        label: `${c.name}${c.taxId ? ` (${c.taxId})` : ''}`,
      })),
    ],
    [customers]
  )

  const handleCreateCustomer = async (e?: FormEvent) => {
    if (e) e.preventDefault()
    if (!tenantId) return

    if (!newCustName.trim()) {
      setNewCustError('La razón social o nombre comercial del cliente es obligatorio.')
      return
    }

    if (newCustTaxId.trim()) {
      const taxValidation = validateEcuadorTaxId(newCustTaxId)
      if (!taxValidation.isValid) {
        setNewCustError(taxValidation.error || 'Identificación fiscal o RUC no válido.')
        return
      }
    }

    if (newCustEmail.trim()) {
      const emailVal = validateEmail(newCustEmail)
      if (!emailVal.isValid) {
        setNewCustError(emailVal.error || 'Correo electrónico no válido.')
        return
      }
    }

    if (newCustPhone.trim()) {
      const phoneVal = validatePhone(newCustPhone)
      if (!phoneVal.isValid) {
        setNewCustError(phoneVal.error || 'Teléfono no válido.')
        return
      }
    }

    setSavingCust(true)
    setNewCustError(null)

    try {
      const tax = newCustTaxId.trim()
      const identificationType =
        tax.length === 10
          ? CustomerIdentificationType.Cedula
          : tax.length === 13
            ? CustomerIdentificationType.Ruc
            : CustomerIdentificationType.Ruc

      const created = await createCustomer(tenantId, {
        name: newCustName.trim(),
        taxId: tax || null,
        customerType: CustomerType.CorporativoB2B,
        identificationType,
        contactPerson: newCustPerson.trim() || null,
        contactEmail: newCustEmail.trim() || null,
        contactPhone: newCustPhone.trim() || null,
        address: newCustAddress.trim() || null,
        notes: newCustNotes.trim() || null,
        isActive: true,
      })

      setCustomers((prev) => [...prev, created])
      setSelectedCustomerId(created.id)
      setNewCustomerOpen(false)
      setNewCustName('')
      setNewCustTaxId('')
      setNewCustPerson('')
      setNewCustEmail('')
      setNewCustPhone('')
      setNewCustAddress('')
      setNewCustNotes('')

      toast.show({
        title: 'Cliente registrado',
        message: `«${created.name}» quedó en el directorio comercial y seleccionado para este lote.`,
        variant: 'success',
      })
    } catch (err: unknown) {
      setNewCustError(readApiError(err, 'Error al registrar el cliente en el directorio.'))
    } finally {
      setSavingCust(false)
    }
  }

  const validateAndPreviewFile = async (fileToValidate: File) => {
    if (!tenantId) return
    setValidatingFile(true)
    setError(null)
    setPreviewResult(null)

    try {
      const formData = new FormData()
      formData.append('file', fileToValidate)
      if (selectedCustomerId) {
        formData.append('customerId', selectedCustomerId)
      }

      const preview = await previewRepairBatch(tenantId, formData)
      setPreviewResult(preview)

      if (!preview.isValid) {
        toast.show({
          title: 'Errores detectados en la plantilla',
          message: `Se encontraron ${preview.errors.length} inconsistencias que impiden la importación. Revisa el resumen.`,
          variant: 'error',
        })
      } else {
        toast.show({
          title: 'Plantilla analizada con éxito',
          message: `${preview.totalRows} equipos listos para ser importados tras confirmación.`,
          variant: 'success',
        })
      }
    } catch (err: unknown) {
      const msg = readApiError(err, 'No se pudo analizar la estructura del archivo Excel.')
      setError(msg)
      toast.show({ title: 'Error de análisis', message: msg, variant: 'error' })
    } finally {
      setValidatingFile(false)
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setError(null)
      void validateAndPreviewFile(selected)
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
      void validateAndPreviewFile(dropped)
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

    if (!previewResult) {
      setError('Debes esperar a que termine la validación previa del archivo.')
      return
    }

    if (!previewResult.isValid) {
      setError('No puedes importar el lote mientras existan errores en el archivo Excel. Corrige la plantilla e intenta nuevamente.')
      return
    }

    setBusy(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('customerId', selectedCustomerId)
      formData.append('batchNumber', batchNumber.trim())
      if (contractRef.trim()) formData.append('contractReference', contractRef.trim())
      if (rateN1.trim()) formData.append('rateN1', rateN1.trim())
      if (rateN2.trim()) formData.append('rateN2', rateN2.trim())
      if (rateN3.trim()) formData.append('rateN3', rateN3.trim())
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
              <ArrowLeft size={16} strokeWidth={2} aria-hidden />
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
                <ArrowLeft size={16} strokeWidth={2} aria-hidden />
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
            <div className="ecu-form-error-banner" style={{ marginBottom: '1.5rem' }} role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Sección 1: Cliente y Contrato */}
            <SectionCard
              title="Datos del Contrato y Cliente Corporativo"
              subtitle="Identificación de la marca/distribuidor y número de control interno del lote"
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewCustError(null)
                    setNewCustomerOpen(true)
                  }}
                >
                  <Plus size={16} strokeWidth={2} aria-hidden />
                  Nuevo Cliente Corporativo
                </Button>
              }
            >
              <div className="ecu-form-grid-2">
                <div>
                  <Select
                    id="repair-customer"
                    label="Cliente del directorio *"
                    labelPosition="outlined"
                    variant="outline"
                    options={customerOptions}
                    value={selectedCustomerId}
                    onChange={(val: string) => setSelectedCustomerId(val)}
                    fullWidth
                  />
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setNewCustError(null)
                        setNewCustomerOpen(true)
                      }}
                      style={{ padding: 0, height: 'auto', fontWeight: 600, color: 'var(--shell-primary)' }}
                    >
                      + Registrar nuevo cliente
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/clientes')}
                      style={{ padding: 0, height: 'auto', color: 'var(--shell-primary)' }}
                    >
                      Ir al Directorio de Clientes &rarr;
                    </Button>
                  </div>
                </div>

                <div>
                  <TextBox
                    id="repair-batch-num"
                    label="Número de Lote *"
                    labelPosition="outlined"
                    variant="outline"
                    value={batchNumber}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setBatchNumber(e.target.value)}
                    placeholder="ej. LOTE-2026-001"
                    required
                    fullWidth
                  />
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <TextBox
                  id="repair-contract-ref"
                  label="Referencia de Contrato / Orden Marco (Opcional)"
                  labelPosition="outlined"
                  variant="outline"
                  value={contractRef}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setContractRef(e.target.value)}
                  placeholder="ej. Contrato Reacondicionamiento Anual #452"
                  fullWidth
                />
              </div>
            </SectionCard>

            {/* Sección 2: Tarifario */}
            <SectionCard
              title="Tarifario Acordado de Servicio ($ USD)"
              subtitle="Tarifas pactadas por equipo según nivel de daño para la liquidación y facturación (Opcional)"
            >
              <div className="ecu-rates-grid">
                <div className="ecu-rate-card ecu-rate-card--n1">
                  <div className="ecu-rate-card__header">
                    <span className="ecu-rate-card__title">
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
                    placeholder="0.00"
                    fullWidth
                  />
                  <span className="ecu-rate-card__hint">
                    Rayones leves, limpieza profunda, sustitución de perillas
                  </span>
                </div>

                <div className="ecu-rate-card ecu-rate-card--n2">
                  <div className="ecu-rate-card__header">
                    <span className="ecu-rate-card__title">
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
                    placeholder="0.00"
                    fullWidth
                  />
                  <span className="ecu-rate-card__hint">
                    Golpes en paneles laterales, pintura, soldadura menor
                  </span>
                </div>

                <div className="ecu-rate-card ecu-rate-card--n3">
                  <div className="ecu-rate-card__header">
                    <span className="ecu-rate-card__title">
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
                    placeholder="0.00"
                    fullWidth
                  />
                  <span className="ecu-rate-card__hint">
                    Descuadre de chasis, reemplazo de compresores o cableado
                  </span>
                </div>
              </div>
            </SectionCard>

            {/* Sección 3: Archivo Excel */}
            <SectionCard
              title="Planilla de Equipos (Excel)"
              subtitle="Carga la planilla Excel con los números de serie, modelos y marcas de los equipos recibidos"
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                >
                  <Download size={16} strokeWidth={2} aria-hidden />
                  {downloadingTemplate ? 'Generando...' : 'Descargar Plantilla Oficial'}
                </Button>
              }
            >
              <div
                className={`ecu-dropzone ${isDragging ? 'ecu-dropzone--active' : ''}`}
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
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />

                {file ? (
                  <>
                    <div className="ecu-dropzone__icon-wrap ecu-dropzone__icon-wrap--success">
                      <FileSpreadsheet size={32} />
                    </div>
                    <h3 className="ecu-dropzone__title">
                      {file.name}
                    </h3>
                    <p className="ecu-dropzone__desc">
                      {(file.size / 1024).toFixed(1)} KB — Clic o arrastra otro archivo para reemplazar
                    </p>
                  </>
                ) : (
                  <>
                    <div className="ecu-dropzone__icon-wrap">
                      <UploadCloud size={32} />
                    </div>
                    <h3 className="ecu-dropzone__title">
                      Arrastra el archivo Excel aquí o haz clic para examinar
                    </h3>
                    <p className="ecu-dropzone__desc">
                      Formatos soportados: .xlsx, .xls (Máximo 500 equipos por lote)
                    </p>
                  </>
                )}
              </div>

              {validatingFile && (
                <div className="ecu-alert-box ecu-alert-box--warning" style={{ marginTop: '1rem' }}>
                  <RefreshCw size={18} className="animate-spin" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Analizando libro Excel...</strong>
                    <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      Validando columnas obligatorias (serial, marca, modelo), formatos de daño y ausencia de duplicados...
                    </div>
                  </div>
                </div>
              )}

              {previewResult && !previewResult.isValid && (
                <div className="ecu-alert-box ecu-alert-box--danger" style={{ marginTop: '1rem' }}>
                  <XCircle size={18} strokeWidth={2} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Se detectaron {previewResult.errors.length} inconsistencias en la plantilla:</strong>
                    <ul style={{ margin: '0.5rem 0 0 1.25rem', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem' }}>
                      {previewResult.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem' }}>
                      Corrige estos registros en tu archivo Excel y vuelve a cargarlo antes de continuar.
                    </p>
                  </div>
                </div>
              )}

              {previewResult && previewResult.warnings.length > 0 && (
                <div className="ecu-alert-box ecu-alert-box--warning" style={{ marginTop: '1rem' }}>
                  <AlertTriangle size={18} strokeWidth={2} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Advertencias ({previewResult.warnings.length}):</strong>
                    <ul style={{ margin: '0.5rem 0 0 1.25rem', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem' }}>
                      {previewResult.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {previewResult && previewResult.isValid && (
                <>
                  <div className="ecu-alert-box ecu-alert-box--success" style={{ marginTop: '1rem' }}>
                    <CheckCircle2 size={18} strokeWidth={2} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <strong>Plantilla validada: {previewResult.totalRows} equipos listos para ingresar</strong>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <StatusBadge tone="info">N1: {previewResult.level1Count}</StatusBadge>
                          <StatusBadge tone="warning">N2: {previewResult.level2Count}</StatusBadge>
                          <StatusBadge tone="danger">N3: {previewResult.level3Count}</StatusBadge>
                        </div>
                      </div>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', opacity: 0.9 }}>
                        Revisa la previsualización de equipos a continuación antes de confirmar el registro definitivo.
                      </p>
                    </div>
                  </div>

                  {/* Tabla de previsualización con scroll */}
                  <div style={{ marginTop: '1.25rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h4 className="font-semibold text-sm m-0 text-slate-900 dark:text-slate-100">Previsualización del Lote</h4>
                    <span className="text-xs text-slate-500">{previewResult.totalRows} equipos detectados</span>
                  </div>
                  <div className="ecu-preview-table-container">
                    <table className="ecu-preview-table">
                      <thead>
                        <tr>
                          <th style={{ width: '60px' }}>Fila</th>
                          <th>Nº Serie</th>
                          <th>Marca</th>
                          <th>Modelo</th>
                          <th>Línea</th>
                          <th style={{ width: '140px' }}>Nivel de Daño</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewResult.items.map((it) => (
                          <tr key={it.rowNumber}>
                            <td style={{ color: 'var(--shell-muted)', fontFamily: 'monospace' }}>#{it.rowNumber}</td>
                            <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{it.serialNumber}</td>
                            <td>{it.brand || '—'}</td>
                            <td>{it.model || '—'}</td>
                            <td>{it.productLine || '—'}</td>
                            <td>
                              <StatusBadge
                                tone={
                                  it.damageLevel === 1
                                    ? 'info'
                                    : it.damageLevel === 2
                                    ? 'warning'
                                    : it.damageLevel === 3
                                    ? 'danger'
                                    : 'neutral'
                                }
                              >
                                {it.damageLevelName}
                              </StatusBadge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="ecu-info-banner">
                <Info size={16} strokeWidth={2} style={{ color: 'var(--shell-primary)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Mapeo automático y campos personalizados:</strong> Columnas como{' '}
                  <code>serial_number</code>, <code>model</code>, <code>brand</code> y{' '}
                  <code>damage_level</code> se homologan directamente al catálogo técnico. Cualquier
                  columna adicional en el Excel (ej. <em>pallet_id</em>, <em>bodega_origen</em>) se
                  almacenará de forma dinámica en los atributos JSON del equipo.
                </div>
              </div>
            </SectionCard>

            {/* Acciones de envío */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--shell-border)' }}>
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
                disabled={busy || !file || !selectedCustomerId || !batchNumber.trim() || validatingFile || !previewResult || !previewResult.isValid}
              >
                {busy
                  ? 'Procesando e Importando...'
                  : validatingFile
                  ? 'Validando...'
                  : previewResult?.isValid
                  ? `Confirmar e Importar Lote (${previewResult.totalRows} Equipos)`
                  : 'Importar Lote'}
              </Button>
            </div>
          </form>
        </div>

        {/* Modal Popup para Registro Rápido de Cliente Corporativo */}
        <Popup
          open={newCustomerOpen}
          title="Registrar Cliente Corporativo"
          onClose={() => setNewCustomerOpen(false)}
          width="min(92vw, 36rem)"
          actions={[
            {
              id: 'cancel',
              label: 'Cancelar',
              variant: 'ghost',
              onClick: () => setNewCustomerOpen(false),
              disabled: savingCust,
            },
            {
              id: 'save',
              label: savingCust ? 'Guardando...' : 'Guardar y Seleccionar',
              variant: 'primary',
              onClick: () => void handleCreateCustomer(),
              disabled: savingCust || !newCustName.trim(),
              loading: savingCust,
            },
          ]}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.5rem' }}>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--shell-muted)' }}>
              Ingresa los datos de la marca fabricante, distribuidora o empresa contratante para asociarla a este lote de reparación.
            </p>

            {newCustError && (
              <div className="ecu-form-error-banner" role="alert">
                <span className="material-symbols-outlined">error</span>
                <span>{newCustError}</span>
              </div>
            )}

            <TextBox
              id="new-cust-name"
              label="Nombre Comercial / Razón Social *"
              labelPosition="outlined"
              variant="outline"
              value={newCustName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewCustName(e.target.value)}
              placeholder="Razón social"
              required
              fullWidth
            />

            <div className="ecu-form-grid-2">
              <TextBox
                id="new-cust-taxid"
                label="RUC / Cédula"
                labelPosition="outlined"
                variant="outline"
                value={newCustTaxId}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewCustTaxId(e.target.value)}
                placeholder="Identificación"
                fullWidth
              />

              <TextBox
                id="new-cust-person"
                label="Persona de Contacto"
                labelPosition="outlined"
                variant="outline"
                value={newCustPerson}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewCustPerson(e.target.value)}
                placeholder="Contacto"
                fullWidth
              />
            </div>

            <div className="ecu-form-grid-2">
              <TextBox
                id="new-cust-email"
                type="email"
                label="Correo Electrónico"
                labelPosition="outlined"
                variant="outline"
                value={newCustEmail}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewCustEmail(e.target.value)}
                placeholder="correo@empresa.com"
                fullWidth
              />

              <TextBox
                id="new-cust-phone"
                label="Teléfono"
                labelPosition="outlined"
                variant="outline"
                value={newCustPhone}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewCustPhone(e.target.value)}
                placeholder="0991234567"
                fullWidth
              />
            </div>

            <TextBox
              id="new-cust-address"
              label="Dirección"
              labelPosition="outlined"
              variant="outline"
              value={newCustAddress}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewCustAddress(e.target.value)}
              placeholder="Dirección"
              fullWidth
            />

            <TextBox
              id="new-cust-notes"
              label="Notas"
              labelPosition="outlined"
              variant="outline"
              value={newCustNotes}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewCustNotes(e.target.value)}
              placeholder="Opcional"
              fullWidth
            />
          </div>
        </Popup>
      </div>
    </TenantSessionGate>
  )
}
