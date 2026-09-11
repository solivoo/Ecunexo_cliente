import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DataGrid, Popup, Select, TextBox, useToast, type ColumnDef, type PageActionItem } from 'glubox'
import { EcuPageActions, PageHeader, SectionCard, StatusBadge } from '@/components/ui'
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Plus, RefreshCw, UploadCloud, XCircle } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import { validateEcuadorTaxId, validateEmail, validatePhone } from '@/lib/ecuadorTaxIdValidator'
import { createCustomer, getCustomerRepairRates, listCustomers } from '@/services/customersApi'
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
import type { BatchPreviewItemDto, BatchPreviewResponse } from '@/types/repairsApi'

type PreviewRow = BatchPreviewItemDto & Record<string, unknown>

const previewMessages = createSpanishDataGridMessages('equipo', 'equipos')

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
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Previsualización y validación previa de la plantilla
  const [previewResult, setPreviewResult] = useState<BatchPreviewResponse | null>(null)
  const [validatingFile, setValidatingFile] = useState(false)
  const [previewErrors, setPreviewErrors] = useState<string[]>([])
  const [errorModalOpen, setErrorModalOpen] = useState(false)
  const [excludedRowKeys, setExcludedRowKeys] = useState<number[]>([])

  const selectedItems = useMemo(() => {
    if (!previewResult?.items) return []
    const excludedSet = new Set(excludedRowKeys)
    return previewResult.items.filter((item) => !excludedSet.has(item.rowNumber))
  }, [previewResult?.items, excludedRowKeys])

  const selectedRowKeys = useMemo(() => {
    return selectedItems.map((item) => item.rowNumber)
  }, [selectedItems])

  const selectedCounts = useMemo(() => {
    let n1 = 0
    let n2 = 0
    let n3 = 0
    for (const item of selectedItems) {
      if (item.damageLevel === 1) n1++
      else if (item.damageLevel === 2) n2++
      else if (item.damageLevel === 3) n3++
    }
    return {
      total: selectedItems.length,
      n1,
      n2,
      n3,
    }
  }, [selectedItems])

  const missingRequirements = useMemo(() => {
    const list: string[] = []
    if (!selectedCustomerId) list.push('Seleccionar Cliente corporativo en Datos del Contrato')
    if (!batchNumber.trim()) list.push('Ingresar o generar Número de Lote')
    if (previewResult?.isValid && selectedCounts.total === 0) list.push('Seleccionar al menos un equipo en la tabla')
    return list
  }, [selectedCustomerId, batchNumber, previewResult, selectedCounts.total])

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging(10)

  const previewColumns = useMemo(
    (): ColumnDef<PreviewRow>[] => [
      {
        key: 'serialNumber',
        header: 'Nº Serie',
        width: 180,
        sortable: true,
        renderCell: (_v, row) => (
          <span style={{ fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>
            {row.serialNumber}
          </span>
        ),
      },
      {
        key: 'brand',
        header: 'Marca',
        width: 130,
        sortable: true,
        renderCell: (_v, row) => row.brand || '—',
      },
      {
        key: 'model',
        header: 'Modelo',
        width: 190,
        sortable: true,
        renderCell: (_v, row) => row.model || '—',
      },
      {
        key: 'productLine',
        header: 'Línea',
        width: 150,
        sortable: true,
        renderCell: (_v, row) => row.productLine || '—',
      },
      {
        key: 'damageLevel',
        header: 'Nivel de Daño',
        width: 170,
        sortable: true,
        renderCell: (_v, row) => (
          <StatusBadge
            tone={
              row.damageLevel === 1
                ? 'info'
                : row.damageLevel === 2
                ? 'warning'
                : row.damageLevel === 3
                ? 'danger'
                : 'neutral'
            }
          >
            {row.damageLevelName || `Nivel ${row.damageLevel}`}
          </StatusBadge>
        ),
      },
    ],
    []
  )

  const previewRows = useMemo(
    () => (previewResult?.items ?? []) as PreviewRow[],
    [previewResult?.items]
  )

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

  useEffect(() => {
    if (!tenantId || !selectedCustomerId) return
    let active = true

    void (async () => {
      try {
        const rates = await getCustomerRepairRates(tenantId, selectedCustomerId)
        if (!active) return
        if (rates.contractReference) setContractRef(rates.contractReference)
      } catch {
        // Sin tarifario maestro: el backend puede seguir importando; las tarifas se configuran en Clientes
      }
    })()

    return () => {
      active = false
    }
  }, [tenantId, selectedCustomerId])

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
    setPreviewErrors([])

    try {
      const formData = new FormData()
      formData.append('file', fileToValidate)
      if (selectedCustomerId) {
        formData.append('customerId', selectedCustomerId)
      }

      const preview = await previewRepairBatch(tenantId, formData)
      setPreviewResult(preview)

      if (!preview.isValid) {
        setExcludedRowKeys([])
        setPreviewErrors(preview.errors)
        setErrorModalOpen(true)
        toast.show({
          title: 'Errores detectados en la plantilla',
          message: `Se encontraron ${preview.errors.length} inconsistencias que impiden la importación. Revisa el detalle en el diálogo.`,
          variant: 'error',
        })
      } else {
        setExcludedRowKeys([])
        setErrorModalOpen(false)
        toast.show({
          title: 'Plantilla analizada con éxito',
          message: `${preview.totalRows} equipos listos para ser importados tras confirmación.`,
          variant: 'success',
        })
      }
    } catch (err: unknown) {
      const msg = readApiError(err, 'No se pudo analizar la estructura del archivo Excel.')
      setError(msg)
      setPreviewErrors([msg])
      setErrorModalOpen(true)
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

    if (selectedCounts.total === 0) {
      setError('Debes tener al menos un equipo seleccionado en el grid para importar.')
      return
    }

    setBusy(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('customerId', selectedCustomerId)
      formData.append('batchNumber', batchNumber.trim())
      if (contractRef.trim()) formData.append('contractReference', contractRef.trim())
      // Tarifas N1/N2/N3: las aplica el backend desde el maestro del cliente (snapshot en el lote)
      formData.append('file', file)

      if (excludedRowKeys.length > 0) {
        formData.append('excludedRowNumbers', excludedRowKeys.join(','))
        const excludedSerials = previewResult.items
          .filter((item) => excludedRowKeys.includes(item.rowNumber))
          .map((item) => item.serialNumber)
        formData.append('excludedSerialNumbers', excludedSerials.join(','))
      }

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
      <div className="ecu-dashboard-layout ecu-dashboard-layout--fluid">
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

        {error && (
          <div className="ecu-form-error-banner" role="alert">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="ecu-import-batch-form">
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
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: '0.75rem' }}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const year = new Date().getFullYear()
                        const rnd = Math.floor(100 + Math.random() * 900)
                        setBatchNumber(`LOTE-${year}-${rnd}`)
                      }}
                      style={{ padding: 0, height: 'auto', fontWeight: 600, color: 'var(--shell-primary)' }}
                    >
                      Generar código sugerido
                    </Button>
                  </div>
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
                <p className="ecu-modal-section-lead" style={{ marginTop: '0.65rem' }}>
                  Las tarifas N1/N2/N3 se toman del tarifario del cliente en{' '}
                  <button
                    type="button"
                    className="ecu-link-button"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--shell-primary)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: 'inherit',
                    }}
                    onClick={() => navigate('/clientes')}
                  >
                    Clientes
                  </button>
                  {' '}
                  (acción Tarifario en la grilla). Quedan guardadas como snapshot en este lote.
                </p>
              </div>
            </SectionCard>

            {/* Sección 2: Previsualización del Lote y Carga de Plantilla Excel en Cabecera */}
            <SectionCard
              title="Previsualización del Lote"
              subtitle="Planilla de Equipos (Excel) con validación automática y homologación por nivel"
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadTemplate}
                    disabled={downloadingTemplate}
                  >
                    <Download size={15} strokeWidth={2} aria-hidden />
                    {downloadingTemplate ? 'Generando...' : 'Descargar Plantilla Oficial'}
                  </Button>

                  <Button
                    type="button"
                    variant={file ? 'outline' : 'primary'}
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={validatingFile}
                  >
                    <UploadCloud size={15} strokeWidth={2} aria-hidden />
                    {file ? 'Reemplazar Plantilla' : 'Cargar Plantilla Excel'}
                  </Button>

                  {file && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        background: 'var(--glb-surface)',
                        border: '1px solid var(--shell-border)',
                        fontSize: '0.75rem',
                        fontFamily: 'ui-monospace, monospace',
                        color: 'var(--glb-text)',
                      }}
                      title={file.name}
                    >
                      <FileSpreadsheet size={13} style={{ color: 'var(--shell-primary)', flexShrink: 0 }} />
                      <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </span>
                      <span style={{ color: 'var(--shell-muted)' }}>({(file.size / 1024).toFixed(1)} KB)</span>
                    </span>
                  )}

                  {validatingFile && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--shell-primary)' }}>
                      <RefreshCw size={13} className="animate-spin" /> Analizando...
                    </span>
                  )}

                  {previewResult && !previewResult.isValid && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setErrorModalOpen(true)}
                      style={{ color: 'var(--glb-danger)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                    >
                      <XCircle size={15} strokeWidth={2} aria-hidden />
                      {previewResult.errors.length} {previewResult.errors.length === 1 ? 'Error' : 'Errores'} — Ver Detalle
                    </Button>
                  )}

                  {previewResult && previewResult.isValid && (
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <StatusBadge tone="info">N1: {selectedCounts.n1}</StatusBadge>
                      <StatusBadge tone="warning">N2: {selectedCounts.n2}</StatusBadge>
                      <StatusBadge tone="danger">N3: {selectedCounts.n3}</StatusBadge>
                      {selectedCounts.total < previewResult.totalRows && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)', marginLeft: '0.25rem' }}>
                          ({selectedCounts.total} de {previewResult.totalRows} seleccionados)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              }
            >
              {previewResult?.warnings && previewResult.warnings.length > 0 && (
                <div className="ecu-alert-box ecu-alert-box--warning" style={{ marginBottom: '0.875rem' }}>
                  <AlertTriangle size={18} strokeWidth={2} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Advertencias ({previewResult.warnings.length}):</strong>
                    <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem' }}>
                      {previewResult.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {previewRows.length > 0 ? (
                <DataGrid<PreviewRow>
                  className="ecu-repairs-grid"
                  columns={previewColumns}
                  dataSource={previewRows}
                  keyExpr="rowNumber"
                  selectionMode="multiple"
                  selectedRowIds={selectedRowKeys}
                  onSelectionChange={(selected: PreviewRow[]) => {
                    if (!previewResult?.items) return
                    const selectedIds = new Set(selected.map((r) => r.rowNumber))
                    const excluded = previewResult.items
                      .filter((i) => !selectedIds.has(i.rowNumber))
                      .map((i) => i.rowNumber)
                    setExcludedRowKeys(excluded)
                  }}
                  showSearch
                  searchPosition="left"
                  searchWidth={280}
                  searchPlaceholder="Buscar por serie, modelo o marca..."
                  paging={paging}
                  pageSizeOptions={pageSizeOptions}
                  onPageChange={onPageChange}
                  onPageSizeChange={onPageSizeChange}
                  messages={previewMessages}
                  fullWidth
                />
              ) : (
                <div
                  className={`ecu-dropzone ecu-dropzone--compact ${isDragging ? 'ecu-dropzone--active' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '2.5rem 1.5rem',
                    border: '2px dashed var(--shell-border)',
                    borderRadius: '8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: isDragging ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.625rem',
                    transition: 'border-color 0.15s ease, background 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      background: 'rgba(59, 130, 246, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--shell-primary)',
                    }}
                  >
                    <UploadCloud size={22} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--glb-text)' }}>
                      Arrastra aquí tu planilla Excel o haz clic para seleccionar
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted)', marginTop: '0.25rem' }}>
                      Formatos soportados: <code>.xlsx</code>, <code>.xls</code> — Hasta 500 equipos por lote
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Acciones de pie de página */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                paddingTop: '1.25rem',
                borderTop: '1px solid var(--shell-border)',
                flexWrap: 'wrap',
              }}
            >
              {previewResult?.isValid && missingRequirements.length > 0 ? (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.8125rem',
                    color: '#d97706',
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    padding: '0.45rem 0.85rem',
                    borderRadius: '8px',
                    maxWidth: '100%',
                  }}
                  role="status"
                  aria-live="polite"
                >
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span>
                    <strong>Requerido para confirmar:</strong> {missingRequirements.join(' • ')}
                  </span>
                </div>
              ) : (
                <div />
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/taller/lotes')}
                  disabled={busy}
                >
                  Cancelar
                </Button>
                {previewResult?.isValid ? (
                  <Button
                    type="submit"
                    variant="primary"
                    title={missingRequirements.length > 0 ? `Pendiente: ${missingRequirements.join(', ')}` : undefined}
                    disabled={
                      busy ||
                      !file ||
                      !selectedCustomerId ||
                      !batchNumber.trim() ||
                      validatingFile ||
                      !previewResult.isValid ||
                      selectedCounts.total === 0
                    }
                  >
                    <CheckCircle2 size={16} strokeWidth={2} aria-hidden />
                    {busy
                      ? 'Procesando e Importando...'
                      : validatingFile
                      ? 'Validando...'
                      : selectedCounts.total < previewResult.totalRows
                      ? `Confirmar e Importar Lote (${selectedCounts.total} de ${previewResult.totalRows} Equipos)`
                      : `Confirmar e Importar Lote (${previewResult.totalRows} Equipos)`}
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="primary"
                    title={missingRequirements.length > 0 ? `Pendiente: ${missingRequirements.join(', ')}` : undefined}
                    disabled={
                      busy ||
                      !file ||
                      !selectedCustomerId ||
                      !batchNumber.trim() ||
                      validatingFile ||
                      !previewResult ||
                      !previewResult.isValid
                    }
                  >
                    {busy
                      ? 'Procesando e Importando...'
                      : validatingFile
                      ? 'Validando...'
                      : 'Importar Lote'}
                  </Button>
                )}
              </div>
            </div>
          </form>

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
          <div className="ecu-modal-form">
            <p className="ecu-modal-section-lead">
              Ingresa los datos de la marca fabricante, distribuidora o empresa contratante para asociarla a este lote de reparación.
            </p>

            {newCustError && (
              <div className="ecu-form-error-banner" role="alert">
                <span className="material-symbols-outlined">error</span>
                <span>{newCustError}</span>
              </div>
            )}

            <div className="ecu-modal-form__field">
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
            </div>

            <div className="ecu-modal-form__grid">
              <div className="ecu-modal-form__field">
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
              </div>

              <div className="ecu-modal-form__field">
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
            </div>

            <div className="ecu-modal-form__grid">
              <div className="ecu-modal-form__field">
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
              </div>

              <div className="ecu-modal-form__field">
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
            </div>

            <div className="ecu-modal-form__field">
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
            </div>

            <div className="ecu-modal-form__field">
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
          </div>
        </Popup>

        {/* Modal Popup para Detalle de Errores en la Plantilla Excel */}
        <Popup
          open={errorModalOpen}
          title="Inconsistencias en la Plantilla Excel"
          onClose={() => setErrorModalOpen(false)}
          width="min(92vw, 38rem)"
          actions={[
            {
              id: 'download',
              label: 'Descargar Plantilla Oficial',
              variant: 'outline',
              onClick: () => void handleDownloadTemplate(),
              disabled: downloadingTemplate,
            },
            {
              id: 'close',
              label: 'Cerrar y Corregir',
              variant: 'primary',
              onClick: () => setErrorModalOpen(false),
            },
          ]}
        >
          <div className="ecu-modal-form">
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
                padding: '0.875rem 1rem',
                background: 'rgba(239, 68, 68, 0.08)',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.25)',
              }}
            >
              <XCircle size={20} style={{ color: 'var(--glb-danger)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--glb-danger)', fontSize: '0.875rem' }}>
                  Se detectaron {previewErrors.length} {previewErrors.length === 1 ? 'inconsistencia' : 'inconsistencias'} en {file?.name || 'la planilla'}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--glb-text)', marginTop: '0.25rem' }}>
                  El lote no puede ser importado hasta resolver las siguientes observaciones en el archivo Excel:
                </div>
              </div>
            </div>

            <div
              style={{
                maxHeight: '300px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                marginTop: '0.875rem',
                paddingRight: '0.25rem',
              }}
            >
              {previewErrors.map((err, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.625rem',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '6px',
                    background: 'var(--glb-surface)',
                    border: '1px solid var(--shell-border)',
                    fontSize: '0.8125rem',
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: 'var(--glb-danger)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span style={{ lineHeight: 1.4, color: 'var(--glb-text)' }}>{err}</span>
                </div>
              ))}
            </div>

            <p style={{ margin: '0.875rem 0 0 0', fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
              Tip: Verifica que las columnas <code>serial_number</code>, <code>model</code>, <code>brand</code> y <code>damage_level</code> (1, 2 o 3) no estén vacías y que no existan números de serie duplicados.
            </p>
          </div>
        </Popup>
      </div>
    </TenantSessionGate>
  )
}
