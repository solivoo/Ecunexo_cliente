import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, CheckButton, DateBox, Select, TextBox, useToast } from 'glubox'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Eye,
  FileCode,
  FileSpreadsheet,
  FileText,
  Info,
  Trash2,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import { EmptyState, PageHeader, SectionCard, StatCard, StatusBadge } from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { listCatalogItems } from '@/services/catalogApi'
import { listWarehouses } from '@/services/inventoryApi'
import {
  createPurchase,
  createSupplier,
  listExpenseTypes,
  parseSriPurchaseXml,
} from '@/services/purchasesApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { CatalogItemListItemDto } from '@/types/catalogApi'
import type { WarehouseListItemDto } from '@/types/inventoryApi'
import type {
  CreatePurchaseItemPayload,
  CreatePurchasePayload,
  ExpenseTypeDto,
  ParseSriPurchaseXmlResponse,
  ParsedLineWithMatchDto,
  SupplierIdentificationType,
} from '@/types/purchasesApi'
import '@/pages/repairs/ecu-customer-form.css'
import './importPurchases.css'

const SUSTENTO_OPTIONS = [
  { value: '01', label: '01 — Crédito Tributario IVA (Bienes y Servicios)' },
  { value: '02', label: '02 — Costo o Gasto para Impuesto a la Renta' },
  { value: '03', label: '03 — Activo Fijo (Crédito Tributario)' },
  { value: '04', label: '04 — Liquidación de Compra (Sector Agropecuario)' },
  { value: '05', label: '05 — Liquidación de Compra por Reembolso' },
  { value: '06', label: '06 — Costo o Gasto con Devolución de IVA' },
  { value: '07', label: '07 — Gastos de Viaje y Hospedaje' },
  { value: '08', label: '08 — Arrendamiento Mercantil' },
]

export interface EditableQueuedLineItem extends ParsedLineWithMatchDto {
  selectedCatalogItemId: string
  selectedWarehouseId: string
  affectsStock: boolean
}

export interface QueuedInvoice {
  id: string
  fileName: string
  sourceType: 'xml' | 'manual_physical'
  parsedData: ParseSriPurchaseXmlResponse
  selectedExpenseTypeId: string
  sriSustentoCode: string
  defaultWarehouseId: string
  lines: EditableQueuedLineItem[]
  notes: string
  selected: boolean
}

export function ImportPurchasesPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)

  const canManage =
    useHasPermission('purchases.documents.manage') ||
    useHasPermission('purchases.manage')

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Catalog dependencies
  const [expenseTypes, setExpenseTypes] = useState<ExpenseTypeDto[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseListItemDto[]>([])
  const [catalogItems, setCatalogItems] = useState<CatalogItemListItemDto[]>([])

  // Queue state
  const [queue, setQueue] = useState<QueuedInvoice[]>([])
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null)

  // Upload/Processing state
  const [isProcessingFiles, setIsProcessingFiles] = useState(false)
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number } | null>(null)
  const [savingBatch, setSavingBatch] = useState(false)
  const [saveProgress, setSaveProgress] = useState<string | null>(null)

  // Direct paste XML mode
  const [pasteModalOpen, setPasteModalOpen] = useState(false)
  const [pastedXmlText, setPastedXmlText] = useState('')

  // Physical manual invoice modal mode
  const [manualPhysicalOpen, setManualPhysicalOpen] = useState(false)
  const [manualSupplierRuc, setManualSupplierRuc] = useState('')
  const [manualSupplierName, setManualSupplierName] = useState('')
  const [manualInvoiceNumber, setManualInvoiceNumber] = useState('')
  const [manualAuthNumber, setManualAuthNumber] = useState('')
  const [manualIssueDate, setManualIssueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [manualSubtotalZero, setManualSubtotalZero] = useState('0.00')
  const [manualSubtotalTaxed, setManualSubtotalTaxed] = useState('0.00')
  const [manualTaxRate, setManualTaxRate] = useState('15')
  const [manualNotes, setManualNotes] = useState('')

  // Load catalogs
  const loadCatalogs = useCallback(async () => {
    if (!tenantId) return
    try {
      const [expenseTypesData, warehousesData, catalogData] = await Promise.all([
        listExpenseTypes(tenantId, true),
        listWarehouses(tenantId),
        listCatalogItems(tenantId),
      ])
      setExpenseTypes(expenseTypesData)
      setWarehouses(warehousesData)
      setCatalogItems(catalogData)
    } catch (err) {
      toast.show({
        title: 'Error de catálogos',
        message: readApiError(err, 'No se pudieron cargar bodegas o catálogos para compras.'),
        variant: 'error',
      })
    }
  }, [tenantId, toast])

  useEffect(() => {
    void loadCatalogs()
  }, [loadCatalogs])

  // Process files (Multiple XMLs)
  const handleFilesSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !tenantId) return

    setIsProcessingFiles(true)
    const fileList = Array.from(files)
    setProcessingProgress({ current: 0, total: fileList.length })

    const newInvoices: QueuedInvoice[] = []
    const errors: string[] = []

    const defaultExpId = expenseTypes[0]?.id ?? ''
    const defaultWhId = warehouses[0]?.id ?? ''

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      setProcessingProgress({ current: i + 1, total: fileList.length })

      try {
        const text = await file.text()
        const parsed = await parseSriPurchaseXml(tenantId, text)

        const initialLines: EditableQueuedLineItem[] = parsed.lines.map((l) => ({
          ...l,
          selectedCatalogItemId: l.matchedCatalogItemId ?? '',
          selectedWarehouseId: defaultWhId,
          affectsStock: l.canAffectInventory ?? true,
        }))

        newInvoices.push({
          id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          fileName: file.name,
          sourceType: 'xml',
          parsedData: parsed,
          selectedExpenseTypeId: defaultExpId,
          sriSustentoCode: '01',
          defaultWarehouseId: defaultWhId,
          lines: initialLines,
          notes: '',
          selected: true,
        })
      } catch (err) {
        errors.push(`${file.name}: ${readApiError(err, 'Error al interpretar comprobante SRI.')}`)
      }
    }

    if (newInvoices.length > 0) {
      setQueue((prev) => [...prev, ...newInvoices])
      if (!activeInvoiceId) {
        setActiveInvoiceId(newInvoices[0].id)
      }
      toast.show({
        title: 'Comprobantes Cargados',
        message: `Se agregaron ${newInvoices.length} factura(s) a la cola de importación.`,
        variant: 'success',
      })
    }

    if (errors.length > 0) {
      toast.show({
        title: 'Errores en archivo(s)',
        message: errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n...y ${errors.length - 3} más` : ''),
        variant: 'error',
      })
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setIsProcessingFiles(false)
    setProcessingProgress(null)
  }

  // Handle direct XML paste
  const handleProcessPastedXml = async () => {
    if (!pastedXmlText.trim() || !tenantId) return
    setIsProcessingFiles(true)

    try {
      const parsed = await parseSriPurchaseXml(tenantId, pastedXmlText.trim())
      const defaultExpId = expenseTypes[0]?.id ?? ''
      const defaultWhId = warehouses[0]?.id ?? ''

      const initialLines: EditableQueuedLineItem[] = parsed.lines.map((l) => ({
        ...l,
        selectedCatalogItemId: l.matchedCatalogItemId ?? '',
        selectedWarehouseId: defaultWhId,
        affectsStock: l.canAffectInventory ?? true,
      }))

      const newInv: QueuedInvoice = {
        id: `queue-${Date.now()}`,
        fileName: `XML_${parsed.invoiceNumber || 'Manual'}.xml`,
        sourceType: 'xml',
        parsedData: parsed,
        selectedExpenseTypeId: defaultExpId,
        sriSustentoCode: '01',
        defaultWarehouseId: defaultWhId,
        lines: initialLines,
        notes: '',
        selected: true,
      }

      setQueue((prev) => [...prev, newInv])
      setActiveInvoiceId(newInv.id)
      setPasteModalOpen(false)
      setPastedXmlText('')
      toast.show({
        title: 'XML Procesado',
        message: `Factura N° ${parsed.invoiceNumber} incorporada a la cola.`,
        variant: 'success',
      })
    } catch (err) {
      toast.show({
        title: 'Error al interpretar XML',
        message: readApiError(err, 'El XML pegado no es un comprobante válido del SRI.'),
        variant: 'error',
      })
    } finally {
      setIsProcessingFiles(false)
    }
  }

  // Handle manual physical invoice submission
  const handleAddManualPhysical = () => {
    const cleanRuc = manualSupplierRuc.trim()
    const cleanName = manualSupplierName.trim()
    const cleanInv = manualInvoiceNumber.trim()
    const cleanAuth = manualAuthNumber.trim()

    if (!cleanRuc || (cleanRuc.length !== 10 && cleanRuc.length !== 13)) {
      toast.show({
        title: 'RUC / Cédula inválido',
        message: 'Ingrese una cédula de 10 dígitos o RUC de 13 dígitos para el proveedor.',
        variant: 'warning',
      })
      return
    }

    if (!cleanName) {
      toast.show({
        title: 'Razón Social requerida',
        message: 'Ingrese la razón social o nombre comercial del proveedor.',
        variant: 'warning',
      })
      return
    }

    if (!cleanInv) {
      toast.show({
        title: 'Número de Factura requerido',
        message: 'Ingrese el secuencial de factura física (ej. 001-001-000000123).',
        variant: 'warning',
      })
      return
    }

    if (cleanAuth && cleanAuth.length !== 10 && cleanAuth.length !== 49) {
      toast.show({
        title: 'Autorización SRI inválida',
        message: 'Para facturas físicas preimpresas, la autorización del SRI consta de 10 dígitos numéricos de imprenta.',
        variant: 'warning',
      })
      return
    }

    const sub0 = parseFloat(manualSubtotalZero) || 0
    const subTax = parseFloat(manualSubtotalTaxed) || 0
    const rate = parseFloat(manualTaxRate) || 15
    const taxAmt = Math.round(subTax * (rate / 100) * 100) / 100
    const total = Math.round((sub0 + subTax + taxAmt) * 100) / 100

    const defaultExpId = expenseTypes[0]?.id ?? ''
    const defaultWhId = warehouses[0]?.id ?? ''

    const manualParsed: ParseSriPurchaseXmlResponse = {
      supplier: {
        existingSupplierId: null,
        taxId: cleanRuc,
        businessName: cleanName,
        tradeName: cleanName,
        address: 'Dirección del emisor (Factura Física)',
        isRegistered: false,
      },
      invoiceNumber: cleanInv,
      authorizationNumber: cleanAuth,
      issueDate: manualIssueDate,
      documentType: '01',
      subtotalZero: sub0,
      subtotalTaxed: subTax,
      subtotalNoSubject: 0,
      subtotalExempt: 0,
      taxRate: rate,
      taxAmount: taxAmt,
      totalDiscount: 0,
      totalAmount: total,
      paymentMethodCode: '01',
      creditDays: 0,
      lines: [
        {
          itemCode: 'FISICO-01',
          description: `Gasto / Compra física s/f ${cleanInv}`,
          quantity: 1,
          unitPrice: sub0 + subTax,
          discount: 0,
          subtotal: sub0 + subTax,
          taxRate: rate,
          taxAmount: taxAmt,
          total: total,
          matchedCatalogItemId: null,
          matchedCatalogItemName: null,
          canAffectInventory: false,
        },
      ],
      rawXml: '',
      validationReport: {
        overallStatus: 'warning',
        isAuthorizedBySri: false,
        sriStatus: 'FACTURA_FISICA_PREIMPRESA',
        sriAuthorizationDate: null,
        environment: 'FISICA',
        isAccessKeyValid: false,
        isMathConsistent: true,
        calculatedTotal: total,
        declaredTotal: total,
        mathDiscrepancy: 0,
        taxRateStatus: rate === 15 ? 'VIGENTE_15' : 'REDUCIDA_CONSTRUCCION_5',
        alerts: [
          {
            severity: 'info',
            code: 'PHYSICAL_INVOICE',
            title: 'Factura Física Preimpresa / Nota de Venta',
            message: `Registrada manualmente con Autorización de Imprenta SRI N° ${cleanAuth || 'N/A'}.`,
            recommendation: 'Asegúrese de archivar el documento físico preimpreso durante 7 años conforme el Código Tributario.',
          },
        ],
      },
    }

    const newInv: QueuedInvoice = {
      id: `queue-${Date.now()}`,
      fileName: `Factura_Fisica_${cleanInv}.pdf`,
      sourceType: 'manual_physical',
      parsedData: manualParsed,
      selectedExpenseTypeId: defaultExpId,
      sriSustentoCode: '01',
      defaultWarehouseId: defaultWhId,
      lines: [
        {
          ...manualParsed.lines[0],
          selectedCatalogItemId: '',
          selectedWarehouseId: defaultWhId,
          affectsStock: false,
        },
      ],
      notes: manualNotes,
      selected: true,
    }

    setQueue((prev) => [...prev, newInv])
    setActiveInvoiceId(newInv.id)
    setManualPhysicalOpen(false)
    setManualSupplierRuc('')
    setManualSupplierName('')
    setManualInvoiceNumber('')
    setManualAuthNumber('')
    setManualNotes('')
    toast.show({
      title: 'Factura física agregada',
      message: `Comprobante N° ${cleanInv} listo para registrar.`,
      variant: 'success',
    })
  }

  // Active invoice getter
  const activeInvoice = useMemo(() => {
    return queue.find((q) => q.id === activeInvoiceId) ?? queue[0] ?? null
  }, [queue, activeInvoiceId])

  // Queue manipulation
  const handleRemoveInvoice = (id: string) => {
    setQueue((prev) => {
      const next = prev.filter((q) => q.id !== id)
      if (activeInvoiceId === id) {
        setActiveInvoiceId(next[0]?.id ?? null)
      }
      return next
    })
  }

  const handleToggleSelectInvoice = (id: string, selected: boolean) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, selected } : q)))
  }

  const handleToggleSelectAll = (selected: boolean) => {
    setQueue((prev) => prev.map((q) => ({ ...q, selected })))
  }

  // Updates for active invoice parameters
  const updateActiveInvoice = (updater: (inv: QueuedInvoice) => QueuedInvoice) => {
    if (!activeInvoice) return
    setQueue((prev) => prev.map((q) => (q.id === activeInvoice.id ? updater(q) : q)))
  }

  const handleExpenseTypeChange = (expId: string) => {
    updateActiveInvoice((inv) => ({ ...inv, selectedExpenseTypeId: expId }))
  }

  const handleSustentoChange = (sustento: string) => {
    updateActiveInvoice((inv) => ({ ...inv, sriSustentoCode: sustento }))
  }

  const handleDefaultWarehouseChange = (whId: string) => {
    updateActiveInvoice((inv) => ({
      ...inv,
      defaultWarehouseId: whId,
      lines: inv.lines.map((l) => ({
        ...l,
        selectedWarehouseId: l.selectedWarehouseId || whId,
      })),
    }))
  }

  const handleLineCatalogChange = (lineIdx: number, catItemId: string) => {
    updateActiveInvoice((inv) => {
      const newLines = [...inv.lines]
      newLines[lineIdx] = {
        ...newLines[lineIdx],
        selectedCatalogItemId: catItemId,
        affectsStock: Boolean(catItemId),
      }
      return { ...inv, lines: newLines }
    })
  }

  const handleLineAffectsStockChange = (lineIdx: number, affectsStock: boolean) => {
    updateActiveInvoice((inv) => {
      const newLines = [...inv.lines]
      newLines[lineIdx] = { ...newLines[lineIdx], affectsStock }
      return { ...inv, lines: newLines }
    })
  }

  // KPIs
  const stats = useMemo(() => {
    const total = queue.length
    let valids = 0
    let warnings = 0
    let dangers = 0
    let totalBatchAmount = 0

    for (const inv of queue) {
      totalBatchAmount += inv.parsedData.totalAmount
      const overall = inv.parsedData.validationReport?.overallStatus ?? 'valid'
      if (overall === 'danger') dangers++
      else if (overall === 'warning') warnings++
      else valids++
    }

    return {
      total,
      valids,
      warnings,
      dangers,
      totalBatchAmount,
      selectedCount: queue.filter((q) => q.selected).length,
    }
  }, [queue])

  // Register invoices into system
  const handleRegisterInvoices = async (onlyActive = false) => {
    if (!tenantId) return

    const targets = onlyActive
      ? (activeInvoice ? [activeInvoice] : [])
      : queue.filter((q) => q.selected)

    if (targets.length === 0) {
      toast.show({
        title: 'Sin comprobantes seleccionados',
        message: 'Marque al menos una factura en la cola para registrar.',
        variant: 'warning',
      })
      return
    }

    // Check for blocking errors
    const criticalInvoices = targets.filter(
      (t) => t.parsedData.validationReport?.overallStatus === 'danger'
    )
    if (criticalInvoices.length > 0) {
      const confirmProceed = window.confirm(
        `Hay ${criticalInvoices.length} factura(s) con inconsistencias críticas del SRI (ej. total descuadrado o clave inválida). ¿Desea omitir las inconsistentes y registrar solo las aprobadas?`
      )
      if (!confirmProceed) return
    }

    setSavingBatch(true)
    const successIds: string[] = []
    const registeredIds: string[] = []
    const errors: string[] = []

    for (let i = 0; i < targets.length; i++) {
      const inv = targets[i]
      setSaveProgress(`Procesando factura ${i + 1} de ${targets.length}: ${inv.parsedData.invoiceNumber}...`)

      try {
        // 1. Crear o resolver proveedor
        let supplierId = inv.parsedData.supplier.existingSupplierId
        if (!supplierId) {
          const suppRes = await createSupplier(tenantId, {
            taxId: inv.parsedData.supplier.taxId,
            businessName: inv.parsedData.supplier.businessName,
            tradeName: inv.parsedData.supplier.tradeName,
            address: inv.parsedData.supplier.address,
            identificationType: (inv.parsedData.supplier.taxId.length === 13 ? 1 : 2) as SupplierIdentificationType,
          })
          supplierId = suppRes.id
        }

        // 2. Preparar payload de compra
        const purchaseItems: CreatePurchaseItemPayload[] = inv.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
          taxRate: l.taxRate,
          itemCode: l.itemCode || null,
          catalogItemId: l.selectedCatalogItemId || null,
          warehouseId: l.affectsStock && l.selectedWarehouseId ? l.selectedWarehouseId : null,
          affectsInventory: l.affectsStock,
        }))

        const payload: CreatePurchasePayload = {
          supplierId,
          invoiceNumber: inv.parsedData.invoiceNumber,
          issueDate: inv.parsedData.issueDate,
          documentType: inv.parsedData.documentType,
          authorizationNumber: inv.parsedData.authorizationNumber || null,
          expenseTypeId: inv.selectedExpenseTypeId || null,
          sriSustentoCode: inv.sriSustentoCode,
          subtotalZero: inv.parsedData.subtotalZero,
          subtotalTaxed: inv.parsedData.subtotalTaxed,
          subtotalNoSubject: inv.parsedData.subtotalNoSubject,
          subtotalExempt: inv.parsedData.subtotalExempt,
          taxRate: inv.parsedData.taxRate,
          taxAmount: inv.parsedData.taxAmount,
          totalDiscount: inv.parsedData.totalDiscount,
          totalAmount: inv.parsedData.totalAmount,
          paymentMethodCode: inv.parsedData.paymentMethodCode || '01',
          creditDays: inv.parsedData.creditDays,
          rawXml: inv.parsedData.rawXml || null,
          notes: inv.notes.trim() || null,
          items: purchaseItems,
        }

        const res = await createPurchase(tenantId, payload)
        registeredIds.push(res.purchaseId)
        successIds.push(inv.id)
      } catch (err) {
        errors.push(`${inv.parsedData.invoiceNumber}: ${readApiError(err, 'Error al guardar')}`)
      }
    }

    setSavingBatch(false)
    setSaveProgress(null)

    // Remove registered invoices from queue
    setQueue((prev) => prev.filter((q) => !successIds.includes(q.id)))

    if (successIds.length > 0) {
      toast.show({
        title: 'Importación Completada',
        message: `Se registraron exitosamente ${successIds.length} factura(s) de compra en el sistema.`,
        variant: 'success',
      })

      // If all were registered, redirect back to purchases list
      if (errors.length === 0) {
        navigate('/compras/documentos')
      }
    }

    if (errors.length > 0) {
      toast.show({
        title: 'Observaciones al registrar',
        message: errors.join('\n'),
        variant: 'error',
      })
    }
  }

  return (
    <TenantSessionGate
      title="Importar Facturas SRI"
      lead="Recepción y validación preventiva de comprobantes electrónicos y físicos de compra."
    >
      <div className="ecu-import-purchases-page">
        <PageHeader
          title="Recepción e Importación de Facturas SRI"
          badge={
            <StatusBadge tone="primary" withDot>
              Módulo Compras · Lote & Validación
            </StatusBadge>
          }
          subtitle="Carga de comprobantes electrónicos del SRI y facturas físicas con validación preventiva de autorización, tarifas vigentes y consistencia matemática antes del ingreso al sistema."
          actions={
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate('/compras/documentos')}
                disabled={savingBatch || isProcessingFiles}
              >
                <ArrowLeft size={16} />
                Volver a Compras
              </Button>
              {queue.length > 0 && canManage ? (
                <Button
                  variant="primary"
                  size="md"
                  disabled={savingBatch || isProcessingFiles || stats.selectedCount === 0}
                  loading={savingBatch}
                  onClick={() => void handleRegisterInvoices(false)}
                >
                  <CheckCircle2 size={16} />
                  {savingBatch
                    ? saveProgress || 'Registrando...'
                    : `Registrar Facturas Aprobadas (${stats.selectedCount})`}
                </Button>
              ) : null}
            </div>
          }
        />

        {/* KPI Strip */}
        <div className="ecu-kpi-strip" style={{ marginBottom: '1.25rem' }}>
          <StatCard
            label="Comprobantes en Cola"
            value={stats.total}
            toneColor="#4f46e5"
            icon={<FileSpreadsheet size={20} />}
            footerText="Listas para auditoría e importación"
          />
          <StatCard
            label="Válidas SRI (Aprobadas)"
            value={stats.valids}
            toneColor="#10b981"
            icon={<CheckCircle2 size={20} />}
            footerText="Autorizadas sin inconsistencias"
          />
          <StatCard
            label="Advertencias / Contingencia"
            value={stats.warnings}
            toneColor="#f59e0b"
            icon={<AlertTriangle size={20} />}
            footerText="SRI offline o sin contenedor oficial"
          />
          <StatCard
            label="Importe Total Lote"
            value={`$${stats.totalBatchAmount.toFixed(2)}`}
            toneColor="#8b5cf6"
            icon={<Building2 size={20} />}
            footerText={`${stats.selectedCount} de ${stats.total} seleccionadas`}
          />
        </div>

        {/* Dropzone & Carga de Comprobantes */}
        <div style={{ marginBottom: '1.25rem' }}>
          <SectionCard
            title="Carga de Comprobantes (Individual o por Lote)"
            subtitle="Soporta múltiples archivos XML oficiales del SRI, respuestas de autorización y registro de facturas físicas preimpresas."
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".xml,text/xml"
              style={{ display: 'none' }}
              onChange={(e) => void handleFilesSelected(e)}
            />

            <div
              className="ecu-import-dropzone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  const fakeEvent = {
                    target: { files: e.dataTransfer.files },
                  } as unknown as ChangeEvent<HTMLInputElement>
                  void handleFilesSelected(fakeEvent)
                }
              }}
            >
              <UploadCloud size={42} className="ecu-import-dropzone__icon" />
              <h4 className="ecu-import-dropzone__title">
                {isProcessingFiles
                  ? `Interpretando XMLs (${processingProgress?.current ?? 0} de ${processingProgress?.total ?? 0})...`
                  : 'Arrastra aquí tus archivos XML o haz clic para seleccionarlos'}
              </h4>
              <p className="ecu-import-dropzone__subtitle">
                Puedes seleccionar varios archivos XML simultáneamente. El sistema verificará de forma preventiva la firma, autorización SRI y cálculo de bases.
              </p>
              <div className="ecu-import-dropzone__actions" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingFiles || savingBatch}
                >
                  <UploadCloud size={16} />
                  Seleccionar archivos XML
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPasteModalOpen(true)}
                  disabled={isProcessingFiles || savingBatch}
                >
                  <FileCode size={16} />
                  Pegar XML en texto
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManualPhysicalOpen(true)}
                  disabled={isProcessingFiles || savingBatch}
                >
                  <FileText size={16} />
                  Agregar Factura Física Preimpresa
                </Button>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Modal Pegar XML */}
        {pasteModalOpen ? (
          <div className="ecu-modal-backdrop" onClick={() => setPasteModalOpen(false)}>
            <div className="ecu-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '40rem' }}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem' }}>Pegar Contenido XML del SRI</h3>
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--glb-muted)' }}>
                Pega el XML completo del comprobante electrónico (Factura 01 o RespuestaAutorizacion).
              </p>
              <textarea
                value={pastedXmlText}
                onChange={(e) => setPastedXmlText(e.target.value)}
                placeholder="<factura id=... o <autorizacion>..."
                rows={10}
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--shell-border)',
                  background: 'var(--glb-surface)',
                  color: 'var(--glb-text)',
                  marginBottom: '1rem',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <Button variant="outline" size="sm" onClick={() => setPasteModalOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!pastedXmlText.trim() || isProcessingFiles}
                  loading={isProcessingFiles}
                  onClick={() => void handleProcessPastedXml()}
                >
                  Procesar XML
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Modal Factura Física Manual */}
        {manualPhysicalOpen ? (
          <div className="ecu-modal-backdrop" onClick={() => setManualPhysicalOpen(false)}>
            <div className="ecu-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '44rem' }}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem' }}>Registrar Factura Física Preimpresa</h3>
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--glb-muted)' }}>
                Ingreso de comprobantes físicos preimpresos (proveedores sin facturación electrónica o notas de venta).
              </p>
              <div className="ecu-customer-form__grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.875rem' }}>
                <TextBox
                  label="RUC o Cédula Proveedor *"
                  labelPosition="outlined"
                  variant="outline"
                  placeholder="Ej. 1790016919001"
                  value={manualSupplierRuc}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setManualSupplierRuc(e.target.value)}
                  fullWidth
                />
                <TextBox
                  label="Razón Social Proveedor *"
                  labelPosition="outlined"
                  variant="outline"
                  placeholder="Ej. Comercializadora Andina Cía. Ltda."
                  value={manualSupplierName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setManualSupplierName(e.target.value)}
                  fullWidth
                />
                <TextBox
                  label="N° Factura Física (15 dígitos) *"
                  labelPosition="outlined"
                  variant="outline"
                  placeholder="001-001-000000123"
                  value={manualInvoiceNumber}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setManualInvoiceNumber(e.target.value)}
                  fullWidth
                />
                <TextBox
                  label="N° Autorización SRI (10 dígitos)"
                  labelPosition="outlined"
                  variant="outline"
                  placeholder="1123456789"
                  value={manualAuthNumber}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setManualAuthNumber(e.target.value)}
                  fullWidth
                />
                <DateBox
                  label="Fecha de Emisión *"
                  labelPosition="outlined"
                  variant="outline"
                  size="md"
                  value={manualIssueDate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setManualIssueDate(e.target.value)}
                  fullWidth
                />
                <Select
                  label="Tarifa IVA"
                  labelPosition="outlined"
                  variant="outline"
                  value={manualTaxRate}
                  options={[
                    { value: '15', label: '15% — Tarifa General Vigente' },
                    { value: '5', label: '5% — Materiales Construcción' },
                    { value: '0', label: '0% — Tarifa Cero / Exento' },
                  ]}
                  onChange={(v) => setManualTaxRate(v)}
                  fullWidth
                />
                <TextBox
                  label="Subtotal 0% IVA"
                  labelPosition="outlined"
                  variant="outline"
                  type="number"
                  value={manualSubtotalZero}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setManualSubtotalZero(e.target.value)}
                  fullWidth
                />
                <TextBox
                  label="Subtotal Gravado IVA"
                  labelPosition="outlined"
                  variant="outline"
                  type="number"
                  value={manualSubtotalTaxed}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setManualSubtotalTaxed(e.target.value)}
                  fullWidth
                />
              </div>
              <div style={{ marginTop: '0.875rem' }}>
                <TextBox
                  label="Notas u Observaciones"
                  labelPosition="outlined"
                  variant="outline"
                  placeholder="Observaciones de compra o justificación física..."
                  value={manualNotes}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setManualNotes(e.target.value)}
                  fullWidth
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                <Button variant="outline" size="sm" onClick={() => setManualPhysicalOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" onClick={handleAddManualPhysical}>
                  Agregar a la Cola
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Cola de Facturas y Panel Principal */}
        {queue.length === 0 ? (
          <EmptyState
            icon="receipt_long"
            title="No hay facturas en la cola de importación"
            description="Arrastra uno o varios archivos XML del SRI en el recuadro superior o agrega una factura física preimpresa para auditar y registrar tus compras."
          />
        ) : (
          <div className="ecu-import-layout">
            {/* Left Column: Grid / Cola de Facturas */}
            <div className="ecu-import-layout__queue">
              <SectionCard
                title={`Cola de Facturas (${queue.length})`}
                subtitle="Comprobantes cargados en el lote actual."
                action={
                  <CheckButton
                    checked={queue.length > 0 && queue.every((q) => q.selected)}
                    onChange={(chk) => handleToggleSelectAll(chk)}
                  >
                    <span style={{ fontSize: '0.8rem' }}>Marcar todas</span>
                  </CheckButton>
                }
              >
                <div className="ecu-import-queue-table-container">
                  <table className="ecu-import-queue-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>Sel.</th>
                        <th>Factura N°</th>
                        <th>Proveedor</th>
                        <th>Fecha</th>
                        <th>Total</th>
                        <th>Auditoría SRI</th>
                        <th style={{ width: '90px' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.map((inv) => {
                        const isSelected = inv.id === activeInvoice?.id
                        const report = inv.parsedData.validationReport
                        const status = report?.overallStatus ?? 'valid'

                        return (
                          <tr
                            key={inv.id}
                            className={`ecu-import-queue-row ${isSelected ? 'ecu-import-queue-row--active' : ''}`}
                            onClick={() => setActiveInvoiceId(inv.id)}
                          >
                            <td onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={inv.selected}
                                onChange={(e) => handleToggleSelectInvoice(inv.id, e.target.checked)}
                              />
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                                {inv.parsedData.invoiceNumber}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
                                {inv.fileName}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>
                                {inv.parsedData.supplier.businessName}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
                                {inv.parsedData.supplier.taxId}
                                {inv.parsedData.supplier.isRegistered ? (
                                  <span className="ecu-tag ecu-tag--registered">Registrado</span>
                                ) : (
                                  <span className="ecu-tag ecu-tag--new">Nuevo</span>
                                )}
                              </div>
                            </td>
                            <td style={{ fontSize: '0.8rem' }}>{inv.parsedData.issueDate}</td>
                            <td style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--glb-text)' }}>
                              ${inv.parsedData.totalAmount.toFixed(2)}
                            </td>
                            <td>
                              {status === 'valid' ? (
                                <span className="ecu-audit-badge ecu-audit-badge--valid" title="Comprobante SRI Válido y Autorizado">
                                  <CheckCircle2 size={13} />
                                  Válida SRI
                                </span>
                              ) : status === 'warning' ? (
                                <span className="ecu-audit-badge ecu-audit-badge--warning" title="Advertencia o Contingencia SRI">
                                  <AlertTriangle size={13} />
                                  Advertencia
                                </span>
                              ) : (
                                <span className="ecu-audit-badge ecu-audit-badge--danger" title="Inconsistencia Crítica SRI">
                                  <XCircle size={13} />
                                  Inconsistente
                                </span>
                              )}
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button
                                  type="button"
                                  className="ecu-grid-btn"
                                  title="Inspeccionar factura"
                                  onClick={() => setActiveInvoiceId(inv.id)}
                                >
                                  <Eye size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="ecu-grid-btn ecu-grid-btn--danger"
                                  title="Quitar de la cola"
                                  onClick={() => handleRemoveInvoice(inv.id)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>

            {/* Right Column: Inspección y Homologación de Factura Activa */}
            {activeInvoice ? (
              <div className="ecu-import-layout__detail">
                {/* Auditoría Preventiva SRI Card */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <SectionCard
                    title={`Auditoría SRI: Factura ${activeInvoice.parsedData.invoiceNumber}`}
                    subtitle={`Proveedor: ${activeInvoice.parsedData.supplier.businessName} (${activeInvoice.parsedData.supplier.taxId})`}
                  >
                    <div className="ecu-audit-summary-grid">
                      <div className="ecu-audit-metric">
                        <span className="ecu-audit-metric__label">Clave de Acceso SRI</span>
                        <span className="ecu-audit-metric__value" style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                          {activeInvoice.parsedData.authorizationNumber || 'Factura Física (Sin clave)'}
                        </span>
                      </div>
                      <div className="ecu-audit-metric">
                        <span className="ecu-audit-metric__label">Estado Autorización</span>
                        <span className="ecu-audit-metric__value">
                          {activeInvoice.parsedData.validationReport?.isAuthorizedBySri ? (
                            <span style={{ color: '#10b981', fontWeight: 600 }}>● Autorizado Oficialmente</span>
                          ) : activeInvoice.sourceType === 'manual_physical' ? (
                            <span style={{ color: '#3b82f6', fontWeight: 600 }}>● Factura Física Preimpresa</span>
                          ) : (
                            <span style={{ color: '#f59e0b', fontWeight: 600 }}>● Sin Constancia Oficial (Contingencia)</span>
                          )}
                        </span>
                      </div>
                      <div className="ecu-audit-metric">
                        <span className="ecu-audit-metric__label">Consistencia Matemática</span>
                        <span className="ecu-audit-metric__value">
                          {activeInvoice.parsedData.validationReport?.isMathConsistent ? (
                            <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Cuadrado Exacto ($0.00 dif.)</span>
                          ) : (
                            <span style={{ color: '#ef4444', fontWeight: 600 }}>
                              ✗ Descuadre: ${activeInvoice.parsedData.validationReport?.mathDiscrepancy.toFixed(2)}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="ecu-audit-metric">
                        <span className="ecu-audit-metric__label">Tarifa IVA Detectada</span>
                        <span className="ecu-audit-metric__value">
                          {activeInvoice.parsedData.taxRate === 15 ? (
                            <span style={{ color: '#10b981', fontWeight: 600 }}>15% (General Vigente)</span>
                          ) : activeInvoice.parsedData.taxRate === 5 ? (
                            <span style={{ color: '#3b82f6', fontWeight: 600 }}>5% (Construcción)</span>
                          ) : activeInvoice.parsedData.taxRate === 0 ? (
                            <span>0% (Tarifa Cero)</span>
                          ) : (
                            <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                              {activeInvoice.parsedData.taxRate}% (Verificar vigencia)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Alertas Preventivas */}
                    {activeInvoice.parsedData.validationReport?.alerts &&
                    activeInvoice.parsedData.validationReport.alerts.length > 0 ? (
                      <div className="ecu-audit-alerts-list">
                        {activeInvoice.parsedData.validationReport.alerts.map((alert, idx) => (
                          <div
                            key={idx}
                            className={`ecu-audit-alert ecu-audit-alert--${alert.severity}`}
                          >
                            <div className="ecu-audit-alert__icon">
                              {alert.severity === 'danger' ? (
                                <XCircle size={18} />
                              ) : alert.severity === 'warning' ? (
                                <AlertTriangle size={18} />
                              ) : alert.severity === 'success' ? (
                                <CheckCircle2 size={18} />
                              ) : (
                                <Info size={18} />
                              )}
                            </div>
                            <div className="ecu-audit-alert__content">
                              <div className="ecu-audit-alert__title">{alert.title}</div>
                              <div className="ecu-audit-alert__message">{alert.message}</div>
                              {alert.recommendation ? (
                                <div className="ecu-audit-alert__rec">
                                  💡 <strong>Acción preventiva recomendada:</strong> {alert.recommendation}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </SectionCard>
                </div>

                {/* Parámetros de Compra y Homologación */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <SectionCard
                    title="Parámetros Tributarios y Asignación de Bodega"
                    subtitle="Configura el sustento de crédito tributario y destino físico para esta factura."
                  >
                    <div className="ecu-customer-form__grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem' }}>
                      <Select
                        label="Tipo de Gasto SRI (Tabla 5) *"
                        labelPosition="outlined"
                        variant="outline"
                        value={activeInvoice.selectedExpenseTypeId}
                        options={expenseTypes.map((et) => ({
                          value: et.id,
                          label: `${et.code} - ${et.name}`,
                        }))}
                        onChange={handleExpenseTypeChange}
                        fullWidth
                      />

                      <Select
                        label="Sustento Tributario SRI *"
                        labelPosition="outlined"
                        variant="outline"
                        value={activeInvoice.sriSustentoCode}
                        options={SUSTENTO_OPTIONS}
                        onChange={handleSustentoChange}
                        fullWidth
                      />

                      <Select
                        label="Bodega Predeterminada *"
                        labelPosition="outlined"
                        variant="outline"
                        value={activeInvoice.defaultWarehouseId}
                        options={warehouses.map((w) => ({
                          value: w.id,
                          label: `${w.name} (${w.code})`,
                        }))}
                        onChange={handleDefaultWarehouseChange}
                        fullWidth
                      />
                    </div>

                    <div style={{ marginTop: '0.875rem' }}>
                      <TextBox
                        label="Notas u Observaciones de la Compra (Opcional)"
                        labelPosition="outlined"
                        variant="outline"
                        placeholder="Ej. Compra para campaña de inventario o proveedor de logística..."
                        value={activeInvoice.notes}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          updateActiveInvoice((inv) => ({ ...inv, notes: e.target.value }))
                        }
                        fullWidth
                      />
                    </div>
                  </SectionCard>
                </div>

                {/* Detalle de Ítems & Homologación de Catálogo */}
                <SectionCard
                  title={`Detalle de Ítems (${activeInvoice.lines.length}) & Homologación de Catálogo`}
                  subtitle="Asigna cada ítem del comprobante a un producto de tu inventario o déjalo como gasto deducible."
                >
                  <div className="ecu-import-items-table-container">
                    <table className="ecu-import-items-table">
                      <thead>
                        <tr>
                          <th>Cód. SRI</th>
                          <th>Descripción Proveedor</th>
                          <th>Cant.</th>
                          <th>P. Unit</th>
                          <th>IVA</th>
                          <th>Total</th>
                          <th style={{ minWidth: '220px' }}>Homologación Catálogo</th>
                          <th style={{ width: '80px', textAlign: 'center' }}>Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeInvoice.lines.map((line, idx) => (
                          <tr key={idx}>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                              {line.itemCode || '—'}
                            </td>
                            <td>
                              <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{line.description}</div>
                            </td>
                            <td style={{ fontWeight: 600 }}>{line.quantity}</td>
                            <td>${line.unitPrice.toFixed(2)}</td>
                            <td>{line.taxRate}%</td>
                            <td style={{ fontWeight: 600 }}>${line.total.toFixed(2)}</td>
                            <td>
                              <Select
                                size="sm"
                                variant="outline"
                                value={line.selectedCatalogItemId}
                                options={[
                                  { value: '', label: '— Sin vincular (Solo Gasto) —' },
                                  ...catalogItems.map((ci) => ({
                                    value: ci.id,
                                    label: `${ci.sku || ci.id.slice(0, 6)} · ${ci.name}`,
                                  })),
                                ]}
                                onChange={(val) => handleLineCatalogChange(idx, val)}
                                fullWidth
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={line.affectsStock}
                                disabled={!line.selectedCatalogItemId}
                                onChange={(e) => handleLineAffectsStockChange(idx, e.target.checked)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totales Resumen */}
                  <div className="ecu-import-totals-strip">
                    <div className="ecu-import-totals-item">
                      <span>Subtotal 0%:</span>
                      <strong>${activeInvoice.parsedData.subtotalZero.toFixed(2)}</strong>
                    </div>
                    <div className="ecu-import-totals-item">
                      <span>Subtotal Gravado ({activeInvoice.parsedData.taxRate}%):</span>
                      <strong>${activeInvoice.parsedData.subtotalTaxed.toFixed(2)}</strong>
                    </div>
                    <div className="ecu-import-totals-item">
                      <span>IVA:</span>
                      <strong>${activeInvoice.parsedData.taxAmount.toFixed(2)}</strong>
                    </div>
                    <div className="ecu-import-totals-item ecu-import-totals-item--total">
                      <span>Total Factura:</span>
                      <strong>${activeInvoice.parsedData.totalAmount.toFixed(2)}</strong>
                    </div>
                  </div>

                  {/* Acciones de la factura activa */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                    <Button
                      variant="outline"
                      size="md"
                      onClick={() => handleRemoveInvoice(activeInvoice.id)}
                    >
                      <Trash2 size={16} />
                      Quitar de la Cola
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      loading={savingBatch}
                      disabled={savingBatch}
                      onClick={() => void handleRegisterInvoices(true)}
                    >
                      <CheckCircle2 size={16} />
                      Registrar Factura en el Sistema
                    </Button>
                  </div>
                </SectionCard>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </TenantSessionGate>
  )
}
