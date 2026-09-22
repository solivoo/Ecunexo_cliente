import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, CheckButton, DateBox, Select, TextBox, useToast } from 'glubox'
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCode,
  FileSpreadsheet,
  FileText,
  Info,
  Package,
  Pencil,
  Plus,
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
  getOrCreateSupplier,
  listExpenseTypes,
  parseSriPurchaseXml,
} from '@/services/purchasesApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import { computeInvoiceTotalsFromLines, computeLineValues } from '@/utils/purchaseCalculations'
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
  isEdited?: boolean
}

export const SRI_PAYMENT_METHODS = [
  { value: '01', label: '01 — Sin utilización del sistema financiero (Efectivo)' },
  { value: '20', label: '20 — Otros con utilización del sistema financiero (Transferencia/Cheque)' },
  { value: '16', label: '16 — Tarjeta de débito' },
  { value: '19', label: '19 — Tarjeta de crédito' },
  { value: '17', label: '17 — Dinero electrónico' },
  { value: '18', label: '18 — Tarjeta prepago' },
  { value: '21', label: '21 — Endoso de títulos' },
]

export const SRI_TAX_RATES = [
  { value: '15', label: '15%' },
  { value: '5', label: '5%' },
  { value: '0', label: '0%' },
]


/**
 * Detecta automáticamente si el proveedor es de servicios o encomiendas
 * (Courier/Servientrega, telecomunicaciones, cloud, servicios profesionales)
 * y asigna el tipo de gasto SRI más adecuado.
 */
function detectDefaultExpenseType(
  supplierName: string,
  supplierRuc: string,
  types: ExpenseTypeDto[]
): string {
  if (types.length === 0) return ''

  const upper = `${supplierName} ${supplierRuc}`.toUpperCase()

  // 1. Courier, encomiendas, envíos y fletes
  const isCourier =
    upper.includes('SERVIENTREGA') ||
    upper.includes('LAAR') ||
    upper.includes('URBANO') ||
    upper.includes('COURIER') ||
    upper.includes('FLETE') ||
    upper.includes('ENCOMIENDA') ||
    upper.includes('TRANSPORTE') ||
    upper.includes('DHL') ||
    upper.includes('FEDEX')

  if (isCourier) {
    const flete = types.find(
      (e) =>
        e.code.toUpperCase() === 'FLETE' ||
        e.name.toUpperCase().includes('TRANSPORTE') ||
        e.name.toUpperCase().includes('FLETE') ||
        e.name.toUpperCase().includes('ENCOMIENDA')
    )
    if (flete) return flete.id
  }

  // 2. Telecomunicaciones, publicidad y software
  const isTechOrTelco =
    upper.includes('CNT') ||
    upper.includes('CLARO') ||
    upper.includes('CONECEL') ||
    upper.includes('MOVISTAR') ||
    upper.includes('OTECEL') ||
    upper.includes('GOOGLE') ||
    upper.includes('META') ||
    upper.includes('AMAZON') ||
    upper.includes('MICROSOFT')

  if (isTechOrTelco) {
    const tech = types.find(
      (e) =>
        e.code.toUpperCase() === 'PUB' ||
        e.name.toUpperCase().includes('PUBLICIDAD') ||
        e.name.toUpperCase().includes('SERVICIOS')
    )
    if (tech) return tech.id
  }

  // 3. Arriendos
  if (upper.includes('ARRIENDO') || upper.includes('INMOBILIARIA')) {
    const arr = types.find(
      (e) => e.code.toUpperCase() === 'ARRIENDO' || e.name.toUpperCase().includes('ARRIENDO')
    )
    if (arr) return arr.id
  }

  // 4. Por defecto, buscar BIEN si existe, sino el primer elemento
  const bien = types.find((e) => e.code.toUpperCase() === 'BIEN')
  return bien?.id ?? types[0]?.id ?? ''
}

export function ImportPurchasesPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)

  const canManage =
    useHasPermission('purchases.documents.manage') ||
    useHasPermission('purchases.manage')

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Catalogs
  const [expenseTypes, setExpenseTypes] = useState<ExpenseTypeDto[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseListItemDto[]>([])
  const [catalogItems, setCatalogItems] = useState<CatalogItemListItemDto[]>([])

  // Queue state
  const [queue, setQueue] = useState<QueuedInvoice[]>([])
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'queue' | 'detail'>('queue')

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
      setCatalogItems(catalogData.filter((c) => !c.isMatrixParent))
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

  // Active invoice getter
  const activeInvoice = useMemo(() => {
    return queue.find((q) => q.id === activeInvoiceId) ?? queue[0] ?? null
  }, [queue, activeInvoiceId])

  // Active expense type & service indicator
  const activeExpenseType = useMemo(() => {
    if (!activeInvoice) return null
    return expenseTypes.find((e) => e.id === activeInvoice.selectedExpenseTypeId) ?? null
  }, [activeInvoice, expenseTypes])

  const isActiveService = useMemo(() => {
    return activeExpenseType ? !activeExpenseType.affectsInventory : false
  }, [activeExpenseType])

  // Active invoice index in queue for pagination
  const activeInvoiceIndex = useMemo(() => {
    if (!activeInvoice) return -1
    return queue.findIndex((q) => q.id === activeInvoice.id)
  }, [queue, activeInvoice])

  // Helper para verificar si una factura ya está en cola por clave de acceso o RUC + número
  const isDuplicateInvoice = (
    list: QueuedInvoice[],
    authNumber: string | null | undefined,
    supplierTaxId: string,
    invoiceNumber: string
  ): boolean => {
    const cleanAuth = authNumber?.trim()
    const cleanTaxId = supplierTaxId?.trim()
    const cleanInvoice = invoiceNumber?.trim()

    return list.some((item) => {
      const itemAuth = item.parsedData.authorizationNumber?.trim()
      const sameAuth = Boolean(
        cleanAuth &&
        cleanAuth.length >= 10 &&
        itemAuth &&
        itemAuth.length >= 10 &&
        itemAuth === cleanAuth
      )

      const itemTaxId = item.parsedData.supplier.taxId?.trim()
      const itemInvoice = item.parsedData.invoiceNumber?.trim()
      const sameSupplierAndNumber = Boolean(
        cleanTaxId &&
        cleanInvoice &&
        itemTaxId &&
        itemInvoice &&
        itemTaxId === cleanTaxId &&
        itemInvoice === cleanInvoice
      )

      return sameAuth || sameSupplierAndNumber
    })
  }

  // Process files (Multiple XMLs)
  const handleFilesSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !tenantId) return

    setIsProcessingFiles(true)
    const fileList = Array.from(files)
    setProcessingProgress({ current: 0, total: fileList.length })

    const newInvoices: QueuedInvoice[] = []
    const errors: string[] = []
    const skippedQueueDuplicates: string[] = []
    const skippedDbDuplicates: string[] = []

    const defaultWhId = warehouses[0]?.id ?? ''

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      setProcessingProgress({ current: i + 1, total: fileList.length })

      try {
        const text = await file.text()
        const parsed = await parseSriPurchaseXml(tenantId, text)

        // 1. Evitar cargar XML repetido en la cola o en el mismo lote
        const isDupInCurrentQueue = isDuplicateInvoice(
          queue,
          parsed.authorizationNumber,
          parsed.supplier.taxId,
          parsed.invoiceNumber
        )
        const isDupInBatch = isDuplicateInvoice(
          newInvoices,
          parsed.authorizationNumber,
          parsed.supplier.taxId,
          parsed.invoiceNumber
        )

        if (isDupInCurrentQueue || isDupInBatch) {
          skippedQueueDuplicates.push(parsed.invoiceNumber || file.name)
          continue
        }

        // 2. Detección de factura ya registrada previamente en el sistema (en base de datos)
        const isAlreadyRegisteredInDb = Boolean(parsed.isAlreadyRegistered)
        if (isAlreadyRegisteredInDb) {
          skippedDbDuplicates.push(parsed.invoiceNumber)
        }

        // 3. Detección inteligente de tipo de gasto (Predeterminado del proveedor o heurística)
        const expId =
          parsed.supplier.defaultExpenseTypeId ||
          detectDefaultExpenseType(
            parsed.supplier.businessName,
            parsed.supplier.taxId,
            expenseTypes
          )
        const expObj = expenseTypes.find((et) => et.id === expId)
        const isService = expObj ? !expObj.affectsInventory : false

        const initialLines: EditableQueuedLineItem[] = parsed.lines.map((l) => ({
          ...l,
          selectedCatalogItemId: isService ? '' : (l.matchedCatalogItemId ?? ''),
          selectedWarehouseId: isService ? '' : defaultWhId,
          affectsStock: isService ? false : (l.canAffectInventory ?? true),
        }))

        newInvoices.push({
          id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          fileName: file.name,
          sourceType: 'xml',
          parsedData: parsed,
          selectedExpenseTypeId: expId,
          sriSustentoCode: expObj?.sriSustentoCode || '01',
          defaultWarehouseId: isService ? '' : defaultWhId,
          lines: initialLines,
          notes: '',
          selected: !isAlreadyRegisteredInDb, // Desmarcar por defecto si ya está en BD
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

      let summaryText = `Se agregaron ${newInvoices.length} factura(s) a la cola.`
      if (skippedQueueDuplicates.length > 0) {
        summaryText += ` ${skippedQueueDuplicates.length} repetida(s) en cola omitidas.`
      }
      if (skippedDbDuplicates.length > 0) {
        summaryText += ` ${skippedDbDuplicates.length} ya registrada(s) en sistema.`
      }

      toast.show({
        title: 'Comprobantes Cargados',
        message: summaryText,
        variant: 'success',
      })
    } else if (skippedQueueDuplicates.length > 0) {
      toast.show({
        title: 'Comprobantes Omitidos por Duplicidad',
        message: `Se omitieron ${skippedQueueDuplicates.length} XML(s) ya presentes en la cola:\n${skippedQueueDuplicates.slice(0, 3).join(', ')}${skippedQueueDuplicates.length > 3 ? '...' : ''}`,
        variant: 'warning',
      })
    }

    if (errors.length > 0) {
      toast.show({
        title: 'Errores en archivo(s)',
        message: errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n...y ${errors.length - 3} más` : ''),
        variant: 'error',
      })
    }

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

      // Validar duplicado en cola
      const isDup = isDuplicateInvoice(
        queue,
        parsed.authorizationNumber,
        parsed.supplier.taxId,
        parsed.invoiceNumber
      )
      if (isDup) {
        toast.show({
          title: 'Factura duplicada',
          message: `La factura N° ${parsed.invoiceNumber} ya se encuentra cargada en la cola de importación.`,
          variant: 'warning',
        })
        return
      }

      const defaultWhId = warehouses[0]?.id ?? ''
      const isAlreadyRegisteredInDb = Boolean(parsed.isAlreadyRegistered)

      const expId =
        parsed.supplier.defaultExpenseTypeId ||
        detectDefaultExpenseType(
          parsed.supplier.businessName,
          parsed.supplier.taxId,
          expenseTypes
        )
      const expObj = expenseTypes.find((et) => et.id === expId)
      const isService = expObj ? !expObj.affectsInventory : false

      const initialLines: EditableQueuedLineItem[] = parsed.lines.map((l) => ({
        ...l,
        selectedCatalogItemId: isService ? '' : (l.matchedCatalogItemId ?? ''),
        selectedWarehouseId: isService ? '' : defaultWhId,
        affectsStock: isService ? false : (l.canAffectInventory ?? true),
      }))

      const newInv: QueuedInvoice = {
        id: `queue-${Date.now()}`,
        fileName: `XML_${parsed.invoiceNumber || 'Manual'}.xml`,
        sourceType: 'xml',
        parsedData: parsed,
        selectedExpenseTypeId: expId,
        sriSustentoCode: expObj?.sriSustentoCode || '01',
        defaultWarehouseId: isService ? '' : defaultWhId,
        lines: initialLines,
        notes: '',
        selected: !isAlreadyRegisteredInDb,
      }

      setQueue((prev) => [...prev, newInv])
      setActiveInvoiceId(newInv.id)
      setPasteModalOpen(false)
      setPastedXmlText('')
      toast.show({
        title: 'XML Procesado',
        message: isAlreadyRegisteredInDb
          ? `Factura N° ${parsed.invoiceNumber} cargada (AVISO: Ya registrada en el sistema).`
          : `Factura N° ${parsed.invoiceNumber} incorporada a la cola.`,
        variant: isAlreadyRegisteredInDb ? 'warning' : 'success',
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

    const sub0 = parseFloat(manualSubtotalZero) || 0
    const subTax = parseFloat(manualSubtotalTaxed) || 0
    const rate = parseFloat(manualTaxRate) || 15
    const taxAmt = Math.round(subTax * (rate / 100) * 100) / 100
    const total = sub0 + subTax + taxAmt

    const expId = detectDefaultExpenseType(cleanName, cleanRuc, expenseTypes)
    const expObj = expenseTypes.find((et) => et.id === expId)
    const isService = expObj ? !expObj.affectsInventory : false
    const defaultWhId = warehouses[0]?.id ?? ''

    const fakeParsed: ParseSriPurchaseXmlResponse = {
      supplier: {
        taxId: cleanRuc,
        businessName: cleanName,
        tradeName: null,
        address: null,
        isRegistered: false,
        existingSupplierId: null,
      },
      invoiceNumber: cleanInv,
      authorizationNumber: cleanAuth || '',
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
      rawXml: '',
      lines: [
        {
          itemCode: 'MANUAL',
          description: `Compra física registrada manualmente - ${cleanName}`,
          quantity: 1,
          unitPrice: sub0 + subTax,
          discount: 0,
          subtotal: sub0 + subTax,
          taxRate: rate,
          taxAmount: taxAmt,
          total: total,
          matchedCatalogItemId: null,
          matchedCatalogItemName: null,
          canAffectInventory: !isService,
        },
      ],
      validationReport: {
        environment: '1',
        isAccessKeyValid: true,
        isAuthorizedBySri: false,
        isMathConsistent: true,
        calculatedTotal: total,
        declaredTotal: total,
        mathDiscrepancy: 0,
        taxRateStatus: 'Standard',
        overallStatus: 'warning',
        alerts: [
          {
            code: 'MANUAL_PHYSICAL',
            title: 'Factura Física Preimpresa',
            message: 'Comprobante registrado manualmente. Conserve el documento físico en su archivo tributario.',
            severity: 'info',
            recommendation: 'Verifique que la autorización de imprenta esté vigente.',
          },
        ],
      },
    }

    const newInv: QueuedInvoice = {
      id: `queue-manual-${Date.now()}`,
      fileName: `Fisica_${cleanInv}.manual`,
      sourceType: 'manual_physical',
      parsedData: fakeParsed,
      selectedExpenseTypeId: expId,
      sriSustentoCode: expObj?.sriSustentoCode || '01',
      defaultWarehouseId: isService ? '' : defaultWhId,
      lines: [
        {
          ...fakeParsed.lines[0],
          selectedCatalogItemId: '',
          selectedWarehouseId: isService ? '' : defaultWhId,
          affectsStock: !isService,
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

  // Queue manipulation
  const handleRemoveInvoice = (id: string) => {
    setQueue((prev) => {
      const next = prev.filter((q) => q.id !== id)
      if (activeInvoiceId === id) {
        const nextActive = next[0]?.id ?? null
        setActiveInvoiceId(nextActive)
        if (!nextActive) {
          setViewMode('queue')
        }
      }
      return next
    })
  }

  const handleClearQueue = () => {
    if (queue.length === 0) return
    if (window.confirm('¿Desea vaciar todas las facturas cargadas en la cola de importación?')) {
      setQueue([])
      setActiveInvoiceId(null)
      setViewMode('queue')
    }
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

  // Cuando se cambia el tipo de gasto, si es SERVICIO, se desactivan automáticamente los inventarios
  const handleExpenseTypeChange = (expId: string, invoiceId?: string) => {
    const targetId = invoiceId ?? activeInvoice?.id
    if (!targetId) return

    const selectedType = expenseTypes.find((e) => e.id === expId)
    const isService = selectedType ? !selectedType.affectsInventory : false
    const defaultWhId = warehouses[0]?.id ?? ''

    setQueue((prev) =>
      prev.map((inv) => {
        if (inv.id !== targetId) return inv

        const updatedLines = inv.lines.map((l) => ({
          ...l,
          affectsStock: isService ? false : Boolean(l.selectedCatalogItemId),
          selectedWarehouseId: isService ? '' : (l.selectedWarehouseId || defaultWhId),
        }))

        return {
          ...inv,
          selectedExpenseTypeId: expId,
          sriSustentoCode: selectedType?.sriSustentoCode || inv.sriSustentoCode,
          defaultWarehouseId: isService ? '' : (inv.defaultWarehouseId || defaultWhId),
          lines: updatedLines,
        }
      })
    )
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
      }
      return { ...inv, lines: newLines }
    })
  }

  const handleLineAffectsStockChange = (lineIdx: number, affectsStock: boolean) => {
    updateActiveInvoice((inv) => {
      const defaultWhId = warehouses[0]?.id ?? ''
      const newLines = [...inv.lines]
      newLines[lineIdx] = {
        ...newLines[lineIdx],
        affectsStock,
        selectedWarehouseId: affectsStock
          ? (newLines[lineIdx].selectedWarehouseId || inv.defaultWarehouseId || defaultWhId)
          : '',
      }
      return { ...inv, lines: newLines }
    })
  }

  const handleSetAllLinesStock = (affectsStock: boolean) => {
    updateActiveInvoice((inv) => {
      const defaultWhId = warehouses[0]?.id ?? ''
      return {
        ...inv,
        lines: inv.lines.map((l) => ({
          ...l,
          affectsStock,
          selectedWarehouseId: affectsStock
            ? (l.selectedWarehouseId || inv.defaultWarehouseId || defaultWhId)
            : '',
        })),
      }
    })
  }

  // Actualizar datos del encabezado o proveedor de la factura activa
  const handleUpdateInvoiceHeader = (
    field:
      | 'invoiceNumber'
      | 'issueDate'
      | 'authorizationNumber'
      | 'supplierTaxId'
      | 'supplierBusinessName'
      | 'supplierTradeName'
      | 'supplierAddress'
      | 'paymentMethodCode'
      | 'creditDays',
    value: string | number
  ) => {
    updateActiveInvoice((inv) => {
      const parsed = { ...inv.parsedData }
      const supp = { ...parsed.supplier }

      if (field === 'invoiceNumber') {
        parsed.invoiceNumber = String(value)
      } else if (field === 'issueDate') {
        parsed.issueDate = String(value)
      } else if (field === 'authorizationNumber') {
        parsed.authorizationNumber = String(value)
      } else if (field === 'supplierTaxId') {
        supp.taxId = String(value)
      } else if (field === 'supplierBusinessName') {
        supp.businessName = String(value)
      } else if (field === 'supplierTradeName') {
        supp.tradeName = String(value)
      } else if (field === 'supplierAddress') {
        supp.address = String(value)
      } else if (field === 'paymentMethodCode') {
        parsed.paymentMethodCode = String(value)
      } else if (field === 'creditDays') {
        parsed.creditDays = Number(value) || 0
      }

      parsed.supplier = supp
      return {
        ...inv,
        parsedData: parsed,
        isEdited: true,
      }
    })
  }

  // Actualizar un campo de una línea y recalcular automáticamente totales en tiempo real
  const handleUpdateLine = (
    lineIdx: number,
    field: 'itemCode' | 'description' | 'quantity' | 'unitPrice' | 'discount' | 'taxRate',
    val: string | number
  ) => {
    updateActiveInvoice((inv) => {
      const newLines = [...inv.lines]
      const curr = { ...newLines[lineIdx] }

      if (field === 'itemCode') curr.itemCode = String(val)
      else if (field === 'description') curr.description = String(val)
      else if (field === 'quantity') curr.quantity = parseFloat(String(val)) || 0
      else if (field === 'unitPrice') curr.unitPrice = parseFloat(String(val)) || 0
      else if (field === 'discount') curr.discount = parseFloat(String(val)) || 0
      else if (field === 'taxRate') curr.taxRate = parseFloat(String(val)) || 0

      const { subtotal, taxAmount, total } = computeLineValues(
        curr.quantity,
        curr.unitPrice,
        curr.discount,
        curr.taxRate
      )
      curr.subtotal = subtotal
      curr.taxAmount = taxAmount
      curr.total = total
      newLines[lineIdx] = curr

      const totals = computeInvoiceTotalsFromLines(newLines)

      return {
        ...inv,
        lines: newLines,
        parsedData: {
          ...inv.parsedData,
          ...totals,
          validationReport: inv.parsedData.validationReport
            ? {
                ...inv.parsedData.validationReport,
                calculatedTotal: totals.totalAmount,
                declaredTotal: totals.totalAmount,
                mathDiscrepancy: 0,
                isMathConsistent: true,
              }
            : null,
        },
        isEdited: true,
      }
    })
  }

  // Agregar nueva línea editable a la factura activa
  const handleAddLine = () => {
    updateActiveInvoice((inv) => {
      const isService = activeExpenseType ? !activeExpenseType.affectsInventory : false
      const defaultWhId = warehouses[0]?.id ?? ''

      const newLine: EditableQueuedLineItem = {
        itemCode: '',
        description: 'Nuevo producto / servicio',
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        subtotal: 0,
        taxRate: 15,
        taxAmount: 0,
        total: 0,
        matchedCatalogItemId: null,
        matchedCatalogItemName: null,
        selectedCatalogItemId: '',
        selectedWarehouseId: isService ? '' : (inv.defaultWarehouseId || defaultWhId),
        affectsStock: !isService,
        canAffectInventory: !isService,
      }

      const newLines = [...inv.lines, newLine]
      const totals = computeInvoiceTotalsFromLines(newLines)

      return {
        ...inv,
        lines: newLines,
        parsedData: {
          ...inv.parsedData,
          ...totals,
        },
        isEdited: true,
      }
    })
  }

  // Eliminar línea de la factura activa
  const handleDeleteLine = (lineIdx: number) => {
    updateActiveInvoice((inv) => {
      if (inv.lines.length <= 1) {
        toast.show({
          title: 'Línea requerida',
          message: 'La factura debe tener al menos un ítem registrado.',
          variant: 'warning',
        })
        return inv
      }

      const newLines = inv.lines.filter((_, idx) => idx !== lineIdx)
      const totals = computeInvoiceTotalsFromLines(newLines)

      return {
        ...inv,
        lines: newLines,
        parsedData: {
          ...inv.parsedData,
          ...totals,
        },
        isEdited: true,
      }
    })
  }

  // Determina si la factura activa tiene ítems que afectan existencias en bodega
  const activeInvoiceHasStock = useMemo(() => {
    if (!activeInvoice) return false
    if (isActiveService) return false
    return activeInvoice.lines.some((l) => l.affectsStock)
  }, [activeInvoice, isActiveService])

  // Filtra alertas redundantes del SRI para evitar saturación de información que repite lo mismo
  const relevantAlerts = useMemo(() => {
    const all = activeInvoice?.parsedData.validationReport?.alerts ?? []
    return all.filter(
      (a) =>
        a.severity === 'danger' ||
        a.severity === 'warning' ||
        a.code === 'DUPLICATE_PURCHASE_REGISTERED' ||
        a.code === 'MANUAL_PHYSICAL'
    )
  }, [activeInvoice])

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
    const resolvedSuppliersCache = new Map<string, string>()

    for (let i = 0; i < targets.length; i++) {
      const inv = targets[i]
      const taxId = inv.parsedData.supplier.taxId?.trim() || ''
      setSaveProgress(`Procesando factura ${i + 1} de ${targets.length}: ${inv.parsedData.invoiceNumber}...`)

      try {
        // 1. Crear o resolver proveedor evitando duplicidad
        let supplierId = (taxId ? resolvedSuppliersCache.get(taxId) : null) || inv.parsedData.supplier.existingSupplierId
        if (!supplierId) {
          const suppRes = await getOrCreateSupplier(tenantId, {
            taxId: inv.parsedData.supplier.taxId,
            businessName: inv.parsedData.supplier.businessName,
            tradeName: inv.parsedData.supplier.tradeName,
            address: inv.parsedData.supplier.address,
            identificationType: (inv.parsedData.supplier.taxId.length === 13 ? 1 : 2) as SupplierIdentificationType,
            returnExistingIfExists: true,
          })
          supplierId = suppRes.id
          if (taxId) {
            resolvedSuppliersCache.set(taxId, supplierId)
          }

          // Actualizar en el estado de la cola todas las facturas que tengan este mismo taxId
          if (taxId) {
            setQueue((prev) =>
              prev.map((q) => {
                if (q.parsedData.supplier.taxId?.trim() === taxId) {
                  return {
                    ...q,
                    parsedData: {
                      ...q.parsedData,
                      supplier: {
                        ...q.parsedData.supplier,
                        existingSupplierId: supplierId,
                        isRegistered: true,
                      },
                    },
                  }
                }
                return q
              })
            )
          }
        } else if (taxId) {
          resolvedSuppliersCache.set(taxId, supplierId)
        }

        // 2. Preparar payload de compra
        // Si el tipo de gasto es Servicio, forzar affectsInventory = false y warehouseId = null
        const expObj = expenseTypes.find((e) => e.id === inv.selectedExpenseTypeId)
        const isService = expObj ? !expObj.affectsInventory : false

        const purchaseItems: CreatePurchaseItemPayload[] = inv.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
          taxRate: l.taxRate,
          itemCode: l.itemCode || null,
          catalogItemId: l.selectedCatalogItemId || null,
          warehouseId: (!isService && l.affectsStock && l.selectedWarehouseId) ? l.selectedWarehouseId : null,
          affectsInventory: isService ? false : l.affectsStock,
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
        successIds.push(inv.id)
        registeredIds.push(res.purchaseId)
      } catch (err) {
        errors.push(`Factura ${inv.parsedData.invoiceNumber}: ${readApiError(err, 'Error al registrar en sistema.')}`)
      }
    }

    setSavingBatch(false)
    setSaveProgress(null)

    // Quitar de la cola las registradas con éxito
    if (successIds.length > 0) {
      setQueue((prev) => {
        const next = prev.filter((q) => !successIds.includes(q.id))
        if (activeInvoiceId && successIds.includes(activeInvoiceId)) {
          setActiveInvoiceId(next[0]?.id ?? null)
          if (next.length === 0) {
            setViewMode('queue')
          }
        }
        return next
      })

      toast.show({
        title: 'Importación Exitosa',
        message: `Se registraron ${successIds.length} factura(s) en el sistema correctamente.`,
        variant: 'success',
      })

      // Si se registró todo el lote con éxito, redirigir a Compras
      if (errors.length === 0 && (onlyActive || successIds.length === queue.length)) {
        navigate('/compras/documentos')
        return
      }
    }

    if (errors.length > 0) {
      toast.show({
        title: 'Errores en registro',
        message: errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n...y ${errors.length - 3} más` : ''),
        variant: 'error',
      })
    }
  }

  // Navegar al detalle de una factura específica
  const handleOpenDetail = (invoiceId: string) => {
    setActiveInvoiceId(invoiceId)
    setViewMode('detail')
  }

  // Navegar a la factura anterior o siguiente
  const handleNavigateInvoice = (direction: 'prev' | 'next') => {
    if (activeInvoiceIndex === -1) return
    const nextIdx = direction === 'prev' ? activeInvoiceIndex - 1 : activeInvoiceIndex + 1
    if (nextIdx >= 0 && nextIdx < queue.length) {
      setActiveInvoiceId(queue[nextIdx].id)
    }
  }

  return (
    <TenantSessionGate
      title="Importación y Auditoría SRI de Compras"
      lead="Audita comprobantes electrónicos con el algoritmo Módulo 11, clasifica compras de bienes o servicios y sincroniza con tu inventario."
    >
      <div className="ecu-dashboard-layout ecu-dashboard-layout--fluid ecu-import-purchases-page">
        {/* Page Header */}
        <PageHeader
          title="Importación y Auditoría SRI de Compras"
          badge={
            <StatusBadge tone="primary" withDot>
              Lotes & XMLs SRI
            </StatusBadge>
          }
          actions={
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/compras/documentos')}
              disabled={savingBatch || isProcessingFiles}
            >
              <ArrowLeft size={16} />
              Volver a Compras
            </Button>
          }
        />

        {/* Input de archivos oculto para selección de XMLs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xml,text/xml"
          style={{ display: 'none' }}
          onChange={(e) => void handleFilesSelected(e)}
        />

        {/* =========================================================================
            MODO 1: COLA VACÍA — Muestra Dropzone Inicial Prominente
           ========================================================================= */}
        {queue.length === 0 ? (
          <div>
            <SectionCard
              title="Carga de Comprobantes (Individual o por Lote)"
              subtitle="Soporta múltiples archivos XML oficiales del SRI, respuestas de autorización y registro de facturas físicas preimpresas."
            >
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
                <UploadCloud size={48} className="ecu-import-dropzone__icon" />
                <h4 className="ecu-import-dropzone__title">
                  {isProcessingFiles
                    ? `Interpretando XMLs (${processingProgress?.current ?? 0} de ${processingProgress?.total ?? 0})...`
                    : 'Arrastra aquí tus archivos XML o haz clic para seleccionarlos'}
                </h4>
                <p className="ecu-import-dropzone__subtitle">
                  Puedes seleccionar múltiples archivos XML simultáneamente (bienes, fletes de Servientrega, servicios, etc.). El sistema clasificará automáticamente la naturaleza del gasto y auditará la clave de acceso ante el SRI.
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

            <div style={{ marginTop: '1.5rem' }}>
              <EmptyState
                icon="receipt_long"
                title="No hay facturas cargadas en la cola de importación"
                description="Arrastra tus XMLs arriba para iniciar la auditoría SRI y el registro consolidado de compras."
              />
            </div>
          </div>
        ) : viewMode === 'queue' ? (
          /* =========================================================================
             MODO 2: VISTA DE COLA / GRID DE FACTURAS CARGADAS (Ancho Completo)
             ========================================================================= */
          <div>
            {/* Toolbar Superior de Importación */}
            <div className="ecu-import-toolbar">
              <div className="ecu-import-toolbar__group">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingFiles || savingBatch}
                >
                  <UploadCloud size={16} />
                  + Cargar más XMLs
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPasteModalOpen(true)}
                  disabled={isProcessingFiles || savingBatch}
                >
                  <FileCode size={16} />
                  Pegar XML
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManualPhysicalOpen(true)}
                  disabled={isProcessingFiles || savingBatch}
                >
                  <FileText size={16} />
                  + Factura Física
                </Button>
              </div>

              <div className="ecu-import-toolbar__group">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearQueue}
                  disabled={savingBatch || isProcessingFiles}
                >
                  <Trash2 size={16} />
                  Vaciar Cola ({queue.length})
                </Button>
              </div>
            </div>

            {/* KPI Strip del Lote */}
            <div className="ecu-stat-grid" aria-label="Resumen de facturas en cola">
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
                label="Importe Total del Lote"
                value={`$${stats.totalBatchAmount.toFixed(2)}`}
                toneColor="#8b5cf6"
                icon={<Building2 size={20} />}
                footerText={`${stats.selectedCount} de ${stats.total} seleccionadas`}
              />
            </div>

            {/* Grid / Tabla Principal de Facturas Cargadas */}
            <SectionCard
              title={`Facturas Cargadas en el Lote (${queue.length})`}
              subtitle="Revisa el estado de auditoría del SRI, clasifica entre Bienes (Stock) o Servicios (Gasto) y gestiona el lote."
              action={
                <CheckButton
                  checked={queue.length > 0 && queue.every((q) => q.selected)}
                  onChange={(chk) => handleToggleSelectAll(chk)}
                >
                  <span style={{ fontSize: '0.85rem' }}>Seleccionar todas</span>
                </CheckButton>
              }
            >
              <div className="ecu-import-queue-table-container" style={{ maxHeight: 'none' }}>
                <table className="ecu-import-queue-table">
                  <thead>
                    <tr>
                      <th style={{ width: '44px', textAlign: 'center' }}>Sel.</th>
                      <th>Factura N°</th>
                      <th>Proveedor</th>
                      <th>Emisión</th>
                      <th>Naturaleza</th>
                      <th>Tipo de Gasto SRI (Tabla 5)</th>
                      <th style={{ textAlign: 'right' }}>Total Factura</th>
                      <th style={{ textAlign: 'center' }}>Auditoría SRI</th>
                      <th className="ecu-col-actions-header" style={{ width: '160px', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((inv) => {
                      const report = inv.parsedData.validationReport
                      const status = report?.overallStatus ?? 'valid'
                      const isAlreadyReg = Boolean(inv.parsedData.isAlreadyRegistered)
                      const invExpenseType = expenseTypes.find((e) => e.id === inv.selectedExpenseTypeId)
                      const isService = invExpenseType ? !invExpenseType.affectsInventory : false

                      return (
                        <tr key={inv.id} className="ecu-import-queue-row">
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={inv.selected}
                              disabled={isAlreadyReg}
                              title={isAlreadyReg ? 'Factura ya registrada previamente en el sistema' : 'Seleccionar factura para importación'}
                              onChange={(e) => handleToggleSelectInvoice(inv.id, e.target.checked)}
                            />
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontWeight: 600,
                                  fontSize: '0.9rem',
                                  color: 'var(--glb-text)',
                                  cursor: 'pointer',
                                  textDecoration: 'underline dotted',
                                }}
                                onClick={() => handleOpenDetail(inv.id)}
                                title="Haz clic para editar los datos de esta factura"
                              >
                                {inv.parsedData.invoiceNumber}
                              </span>
                              {inv.isEdited ? (
                                <span className="ecu-tag ecu-tag--synced-warehouse" title="Comprobante editado manualmente">
                                  Editada
                                </span>
                              ) : null}
                              {isAlreadyReg ? (
                                <span className="ecu-tag ecu-tag--registered-sys" title="Ya registrada en la base de datos">
                                  Ya en Sistema
                                </span>
                              ) : null}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
                              {inv.fileName}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 500, fontSize: '0.88rem' }}>
                              {inv.parsedData.supplier.businessName}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted)', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                              <span>RUC: {inv.parsedData.supplier.taxId}</span>
                              {inv.parsedData.supplier.isRegistered ? (
                                <span className="ecu-tag ecu-tag--registered">Registrado</span>
                              ) : (
                                <span className="ecu-tag ecu-tag--new">Nuevo Proveedor</span>
                              )}
                            </div>
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>{inv.parsedData.issueDate}</td>
                          <td>
                            {isService ? (
                              <span className="ecu-tag ecu-tag--service" title="Gasto Operativo / Servicio — No ingresa a bodega ni genera stock">
                                <Briefcase size={12} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
                                Servicio (Gasto)
                              </span>
                            ) : (
                              <span className="ecu-tag ecu-tag--goods" title="Compra de Bienes — Ingresa a bodega e incrementa stock en kárdex">
                                <Package size={12} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
                                Bienes (Stock)
                              </span>
                            )}
                          </td>
                          <td style={{ minWidth: '220px' }}>
                            <Select
                              size="sm"
                              variant="outline"
                              value={inv.selectedExpenseTypeId}
                              options={expenseTypes.map((et) => ({
                                value: et.id,
                                label: `${et.code} — ${et.name}`,
                              }))}
                              onChange={(val) => handleExpenseTypeChange(val, inv.id)}
                              fullWidth
                            />
                          </td>
                          <td style={{ fontWeight: 700, fontSize: '0.95rem', textAlign: 'right', color: 'var(--shell-primary, #3b82f6)' }}>
                            ${inv.parsedData.totalAmount.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {isAlreadyReg ? (
                              <span className="ecu-audit-badge ecu-audit-badge--danger" title="Factura ya registrada previamente en el sistema">
                                <XCircle size={13} />
                                Ya Registrada
                              </span>
                            ) : status === 'valid' ? (
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
                          <td className="ecu-col-actions-cell" style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenDetail(inv.id)}
                                title="Editar datos del comprobante, proveedor e ítems"
                              >
                                <Pencil size={14} />
                                Editar Factura
                              </Button>
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

            {/* Barra Inferior Flotante de Registro del Lote */}
            {queue.length > 0 && canManage ? (
              <div className="ecu-import-batch-bar">
                <div className="ecu-import-batch-bar__info">
                  <CheckCircle2 size={20} style={{ color: '#10b981' }} />
                  <div className="ecu-import-batch-bar__text">
                    <strong>{stats.selectedCount}</strong> de <strong>{stats.total}</strong> facturas seleccionadas para importar (Monto: <strong>${stats.totalBatchAmount.toFixed(2)}</strong>)
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
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
                      : `Registrar Facturas Seleccionadas (${stats.selectedCount})`}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          /* =========================================================================
             MODO 3: VISTA DE DETALLE, AUDITORÍA Y CONFIGURACIÓN INDIVIDUAL
             ========================================================================= */
          activeInvoice && (
            <div>
              {/* Barra de Navegación del Comprobante Activo */}
              <div className="ecu-detail-nav-bar">
                <div className="ecu-detail-nav-bar__left">
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setViewMode('queue')}
                  >
                    <ArrowLeft size={16} />
                    ← Volver a la Cola de Facturas ({queue.length})
                  </Button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--glb-text)' }}>
                      Factura N° {activeInvoice.parsedData.invoiceNumber}
                    </span>
                    {isActiveService ? (
                      <span className="ecu-tag ecu-tag--service">
                        <Briefcase size={12} style={{ display: 'inline', marginRight: '3px' }} />
                        Servicio / Gasto Operativo
                      </span>
                    ) : (
                      <span className="ecu-tag ecu-tag--goods">
                        <Package size={12} style={{ display: 'inline', marginRight: '3px' }} />
                        Bienes / Mercadería
                      </span>
                    )}
                  </div>
                </div>

                {/* Paginador rápido entre facturas de la cola */}
                <div className="ecu-detail-nav-bar__pagination">
                  <span className="ecu-detail-nav-bar__counter">
                    Factura {activeInvoiceIndex + 1} de {queue.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activeInvoiceIndex <= 0}
                    onClick={() => handleNavigateInvoice('prev')}
                    title="Factura anterior"
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activeInvoiceIndex >= queue.length - 1}
                    onClick={() => handleNavigateInvoice('next')}
                    title="Siguiente factura"
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>

              {/* 1. Datos Principales del Comprobante y Proveedor (Editables) */}
              <div style={{ marginBottom: '1.25rem' }}>
                <SectionCard
                  title="Datos del Comprobante y Proveedor"
                  subtitle="Ajusta o corrige los datos del comprobante, información del proveedor y condiciones comerciales."
                  action={
                    activeInvoice.isEdited ? (
                      <StatusBadge tone="primary" withDot>
                        Modificada manualmente
                      </StatusBadge>
                    ) : undefined
                  }
                >
                  <div className="ecu-edit-invoice-grid">
                    <TextBox
                      label="Nº de Factura *"
                      labelPosition="outlined"
                      variant="outline"
                      value={activeInvoice.parsedData.invoiceNumber}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        handleUpdateInvoiceHeader('invoiceNumber', e.target.value)
                      }
                      placeholder="001-001-000000123"
                      fullWidth
                    />
                    <TextBox
                      type="date"
                      label="Fecha de Emisión *"
                      labelPosition="outlined"
                      variant="outline"
                      value={activeInvoice.parsedData.issueDate}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        handleUpdateInvoiceHeader('issueDate', e.target.value)
                      }
                      fullWidth
                    />
                    <TextBox
                      label="Clave de Acceso SRI"
                      labelPosition="outlined"
                      variant="outline"
                      value={activeInvoice.parsedData.authorizationNumber}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        handleUpdateInvoiceHeader('authorizationNumber', e.target.value)
                      }
                      placeholder="49 dígitos o autorización física..."
                      fullWidth
                    />
                    <TextBox
                      label="RUC / Cédula Proveedor *"
                      labelPosition="outlined"
                      variant="outline"
                      value={activeInvoice.parsedData.supplier.taxId}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        handleUpdateInvoiceHeader('supplierTaxId', e.target.value)
                      }
                      placeholder="RUC 13 dígitos o Cédula..."
                      fullWidth
                    />
                    <TextBox
                      label="Razón Social Proveedor *"
                      labelPosition="outlined"
                      variant="outline"
                      value={activeInvoice.parsedData.supplier.businessName}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        handleUpdateInvoiceHeader('supplierBusinessName', e.target.value)
                      }
                      placeholder="Razón social del emisor..."
                      fullWidth
                    />
                    <TextBox
                      label="Nombre Comercial"
                      labelPosition="outlined"
                      variant="outline"
                      value={activeInvoice.parsedData.supplier.tradeName ?? ''}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        handleUpdateInvoiceHeader('supplierTradeName', e.target.value)
                      }
                      placeholder="Nombre comercial (opcional)..."
                      fullWidth
                    />
                    <TextBox
                      label="Dirección Matriz"
                      labelPosition="outlined"
                      variant="outline"
                      value={activeInvoice.parsedData.supplier.address ?? ''}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        handleUpdateInvoiceHeader('supplierAddress', e.target.value)
                      }
                      placeholder="Dirección fiscal matriz..."
                      fullWidth
                    />
                    <Select
                      label="Forma de Pago SRI"
                      labelPosition="outlined"
                      variant="outline"
                      value={activeInvoice.parsedData.paymentMethodCode || '01'}
                      options={SRI_PAYMENT_METHODS}
                      onChange={(val) => handleUpdateInvoiceHeader('paymentMethodCode', val)}
                      fullWidth
                    />
                    <TextBox
                      type="number"
                      label="Plazo / Días de Crédito"
                      labelPosition="outlined"
                      variant="outline"
                      value={String(activeInvoice.parsedData.creditDays || 0)}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        handleUpdateInvoiceHeader('creditDays', e.target.value)
                      }
                      fullWidth
                    />
                  </div>
                </SectionCard>
              </div>

              {/* 2. Auditoría Preventiva SRI */}
              <div style={{ marginBottom: '1.25rem' }}>
                <SectionCard
                  title={`Auditoría SRI: Factura ${activeInvoice.parsedData.invoiceNumber}`}
                  subtitle={`Proveedor: ${activeInvoice.parsedData.supplier.businessName} (RUC: ${activeInvoice.parsedData.supplier.taxId})`}
                >
                  <div className="ecu-audit-summary-grid">
                    <div className="ecu-audit-metric">
                      <span className="ecu-audit-metric__label">Clave de Acceso SRI</span>
                      <span className="ecu-audit-metric__value" style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                        {activeInvoice.parsedData.authorizationNumber || 'Factura Física (Sin clave electrónica)'}
                      </span>
                    </div>
                    <div className="ecu-audit-metric">
                      <span className="ecu-audit-metric__label">Estado Autorización</span>
                      <span className="ecu-audit-metric__value">
                        {activeInvoice.parsedData.validationReport?.isAuthorizedBySri ? (
                          <span style={{ color: '#10b981', fontWeight: 600 }}>● Autorizado Oficialmente SRI</span>
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

                  {/* Alertas Relevantes del SRI (Omite redundancias informativas y muestra solo inconsistencias reales o avisos clave) */}
                  {relevantAlerts.length > 0 ? (
                    <div className="ecu-audit-alerts-list">
                      {relevantAlerts.map((alert, idx) => (
                        <div
                          key={idx}
                          className={`ecu-audit-alert ecu-audit-alert--${alert.severity}`}
                        >
                          <div className="ecu-audit-alert__icon">
                            {alert.severity === 'danger' ? (
                              <XCircle size={18} />
                            ) : alert.severity === 'warning' ? (
                              <AlertTriangle size={18} />
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
                  ) : (
                    <div className="ecu-audit-clean-banner">
                      <CheckCircle2 size={16} />
                      <span>
                        <strong>Auditoría SRI Aprobada:</strong> Comprobante íntegro ante el SRI, clave Módulo 11 válida y cuadre matemático exacto.
                      </span>
                    </div>
                  )}
                </SectionCard>
              </div>

              {/* 2. Parámetros Tributarios y Asignación de Bodega */}
              <div style={{ marginBottom: '1.25rem' }}>
                <SectionCard
                  title="Parámetros Tributarios y Destino"
                  subtitle="Configura el sustento de crédito tributario y destino físico de esta factura."
                >
                  <div
                    className="ecu-customer-form__grid"
                    style={{
                      gridTemplateColumns: activeInvoiceHasStock ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
                      gap: '0.875rem',
                    }}
                  >
                    <Select
                      label="Tipo de Gasto SRI (Tabla 5) *"
                      labelPosition="outlined"
                      variant="outline"
                      value={activeInvoice.selectedExpenseTypeId}
                      options={expenseTypes.map((et) => ({
                        value: et.id,
                        label: `${et.code} — ${et.name} ${!et.affectsInventory ? '(Servicio)' : '(Bienes)'}`,
                      }))}
                      onChange={(val) => handleExpenseTypeChange(val)}
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

                    {/* Si no tiene stock, no se muestra el select de bodega */}
                    {activeInvoiceHasStock ? (
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
                    ) : null}
                  </div>

                  {!activeInvoiceHasStock ? (
                    <div className="ecu-service-notice">
                      <Briefcase size={18} className="ecu-service-notice__icon" />
                      <span>
                        <strong>Sin Ingreso a Bodega:</strong> Esta compra se registrará como costo/gasto contable directo sin generar existencias físicas en bodega ni requerir movimientos de kárdex. Pasará directamente al estado <strong>Facturado</strong> al registrarse.
                      </span>
                    </div>
                  ) : null}

                  <div style={{ marginTop: '0.875rem' }}>
                    <TextBox
                      label="Notas u Observaciones de la Compra (Opcional)"
                      labelPosition="outlined"
                      variant="outline"
                      placeholder="Ej. Guía de remisión N° ..., encomienda Servientrega, o detalles operativos..."
                      value={activeInvoice.notes}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        updateActiveInvoice((inv) => ({ ...inv, notes: e.target.value }))
                      }
                      fullWidth
                    />
                  </div>
                </SectionCard>
              </div>

              {/* 3. Detalle de Líneas de la Factura y Sinergia con Bodega */}
              <SectionCard
                title={`Detalle de Ítems (${activeInvoice.lines.length}) & Homologación de Catálogo`}
                subtitle={
                  !activeInvoiceHasStock
                    ? 'Líneas registradas como costo/gasto operativo directo sin control de inventario.'
                    : 'Clasifica qué productos ingresan a stock y cuáles corresponden a insumos o gastos operativos.'
                }
              >
                {/* Barra de acciones masivas y agregar ítems */}
                <div className="ecu-line-actions-strip">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleAddLine}
                    >
                      <Plus size={14} />
                      + Agregar Ítem a la Factura
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isActiveService}
                      onClick={() => handleSetAllLinesStock(true)}
                    >
                      <Package size={13} />
                      Marcar todo como Mercadería (Stock)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetAllLinesStock(false)}
                    >
                      <Briefcase size={13} />
                      Marcar todo como Gasto / Costo
                    </Button>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--glb-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Info size={14} style={{ color: 'var(--shell-primary, #3b82f6)' }} />
                    <span>
                      <strong>Sinergia con Bodega:</strong> Los ítems de mercadería que no homologues aquí quedarán listos para recepción física en almacén.
                    </span>
                  </div>
                </div>

                <div className="ecu-import-items-table-container">
                  <table className="ecu-import-items-table">
                    <thead>
                      <tr>
                        <th style={{ width: '90px' }}>Cód. SRI</th>
                        <th style={{ minWidth: '220px' }}>Descripción</th>
                        <th style={{ width: '70px', textAlign: 'right' }}>Cant.</th>
                        <th style={{ width: '85px', textAlign: 'right' }}>P. Unit</th>
                        <th style={{ width: '75px', textAlign: 'right' }}>Desc.</th>
                        <th style={{ width: '75px', textAlign: 'center' }}>IVA</th>
                        <th style={{ width: '85px', textAlign: 'right' }}>Total</th>
                        <th style={{ width: '140px' }}>Destino</th>
                        <th style={{ minWidth: '220px' }}>Homologación Catálogo</th>
                        <th style={{ width: '36px', textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeInvoice.lines.map((line, idx) => (
                        <tr key={idx}>
                          <td>
                            <input
                              type="text"
                              className="ecu-table-input"
                              placeholder="Cód..."
                              value={line.itemCode || ''}
                              onChange={(e) => handleUpdateLine(idx, 'itemCode', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="ecu-table-input"
                              placeholder="Descripción del ítem..."
                              value={line.description}
                              onChange={(e) => handleUpdateLine(idx, 'description', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="ecu-table-input ecu-table-input--number"
                              min="0"
                              step="any"
                              value={line.quantity}
                              onChange={(e) => handleUpdateLine(idx, 'quantity', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="ecu-table-input ecu-table-input--number"
                              min="0"
                              step="any"
                              value={line.unitPrice}
                              onChange={(e) => handleUpdateLine(idx, 'unitPrice', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="ecu-table-input ecu-table-input--number"
                              min="0"
                              step="any"
                              value={line.discount}
                              onChange={(e) => handleUpdateLine(idx, 'discount', e.target.value)}
                            />
                          </td>
                          <td>
                            <select
                              className="ecu-table-input"
                              value={String(line.taxRate)}
                              onChange={(e) => handleUpdateLine(idx, 'taxRate', e.target.value)}
                            >
                              {SRI_TAX_RATES.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ fontWeight: 700, textAlign: 'right', color: 'var(--glb-text)' }}>
                            ${line.total.toFixed(2)}
                          </td>
                          <td>
                            <Select
                              size="sm"
                              variant="outline"
                              disabled={isActiveService}
                              value={line.affectsStock ? 'stock' : 'expense'}
                              options={[
                                { value: 'stock', label: '📦 Stock' },
                                { value: 'expense', label: '💼 Gasto' },
                              ]}
                              onChange={(val) => handleLineAffectsStockChange(idx, val === 'stock')}
                              fullWidth
                            />
                          </td>
                          <td>
                            {!line.affectsStock ? (
                              <span className="ecu-tag ecu-tag--service" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                                💼 Costo / Gasto Directo
                              </span>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <Select
                                  size="sm"
                                  variant="outline"
                                  value={line.selectedCatalogItemId}
                                  options={[
                                    {
                                      value: '',
                                      label: '⏳ Dejar para recepción física en Bodega',
                                    },
                                    ...catalogItems.map((ci) => ({
                                      value: ci.id,
                                      label: `${ci.sku || ci.id.slice(0, 6)} · ${ci.name}`,
                                    })),
                                  ]}
                                  onChange={(val) => handleLineCatalogChange(idx, val)}
                                  fullWidth
                                />
                                {line.selectedCatalogItemId ? (
                                  <span className="ecu-tag ecu-tag--synced-warehouse" style={{ width: 'fit-content' }}>
                                    ✓ Vinculado a producto
                                  </span>
                                ) : (
                                  <span
                                    className="ecu-tag ecu-tag--pending-warehouse"
                                    style={{ width: 'fit-content' }}
                                    title="El personal de bodega lo vinculará al recepcionar el lote físico"
                                  >
                                    ⏳ Pendiente Recepción en Bodega
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="ecu-grid-btn ecu-grid-btn--danger"
                              title="Eliminar este ítem"
                              onClick={() => handleDeleteLine(idx)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Resumen de Totales */}
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
                    <span>Descuento Total:</span>
                    <strong>${activeInvoice.parsedData.totalDiscount.toFixed(2)}</strong>
                  </div>
                  <div className="ecu-import-totals-item">
                    <span>IVA Liquidado:</span>
                    <strong>${activeInvoice.parsedData.taxAmount.toFixed(2)}</strong>
                  </div>
                  <div className="ecu-import-totals-item ecu-import-totals-item--total">
                    <span>Total Factura:</span>
                    <strong>${activeInvoice.parsedData.totalAmount.toFixed(2)}</strong>
                  </div>
                </div>

                {/* Botones de Acción de esta Factura */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setViewMode('queue')}
                  >
                    <ArrowLeft size={16} />
                    Volver a la Cola de Facturas
                  </Button>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
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
                </div>
              </SectionCard>
            </div>
          )
        )}

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
      </div>
    </TenantSessionGate>
  )
}
