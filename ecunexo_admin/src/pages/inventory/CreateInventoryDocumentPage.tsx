import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, NumberBox, Popup, Select, TextArea, TextBox, useToast } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { AlertTriangle, Boxes, Download, FileSpreadsheet, Layers, Plus, ScanBarcode, Trash2 } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { createCatalogItem, listCatalogItems } from '@/services/catalogApi'
import { approveInventoryDocument, createInventoryDocument, listWarehouses } from '@/services/inventoryApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import { CatalogItemKind, CatalogItemStatus, type CatalogItemListItemDto } from '@/types/catalogApi'
import {
  InventoryDocumentType,
  InventoryReceiptOrigin,
  type WarehouseListItemDto,
} from '@/types/inventoryApi'
import { InventoryItemSelectModal } from './InventoryItemSelectModal'
import {
  buildInventoryLinesTemplateBlob,
  downloadBlob,
  parseInventoryLinesWorkbook,
} from './inventoryDocumentExcel'
import './inventoryItemSelectModal.css'

const PURCHASE_INVOICE = /^\d{3}-\d{3}-\d{9}$/

type LineDraft = { catalogItemId: string; quantity: string; unitCost: string }

function initialDocumentType(params: URLSearchParams): string {
  const tipo = params.get('tipo')
  if (tipo === '1') return String(InventoryDocumentType.Issue)
  if (tipo === '2') return String(InventoryDocumentType.Transfer)
  if (tipo === '3') return String(InventoryDocumentType.Adjustment)
  return String(InventoryDocumentType.Receipt)
}

export function CreateInventoryDocumentPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const tenantId = useAppSelector(selectTenantId)
  const canCreate = useHasPermission('inventory.documents.create')
  const canApprove = useHasPermission('inventory.documents.approve')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warehouses, setWarehouses] = useState<WarehouseListItemDto[]>([])
  const [fullCatalog, setFullCatalog] = useState<CatalogItemListItemDto[]>([])
  const [items, setItems] = useState<{ id: string; name: string; sku: string | null }[]>([])
  const [documentType, setDocumentType] = useState(() => initialDocumentType(params))
  const [warehouseId, setWarehouseId] = useState('')
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('')
  const [notes, setNotes] = useState('')
  const [receiptOrigin, setReceiptOrigin] = useState(String(InventoryReceiptOrigin.Opening))
  const [sourceDocumentNumber, setSourceDocumentNumber] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([{ catalogItemId: '', quantity: '1', unitCost: '' }])

  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false)
  const [selectModalMode, setSelectModalMode] = useState<'search' | 'matrix'>('search')
  const [scannedBarcode, setScannedBarcode] = useState('')
  const [isZeroCostModalOpen, setIsZeroCostModalOpen] = useState(false)
  const [zeroCostLines, setZeroCostLines] = useState<
    { catalogItemId: string; quantity: number; unitCost: number | null }[]
  >([])
  const pendingApproveAfterCreateRef = useRef(false)
  const excelFileInputRef = useRef<HTMLInputElement>(null)
  const [excelBusy, setExcelBusy] = useState(false)

  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false)
  const [quickBusy, setQuickBusy] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickSku, setQuickSku] = useState('')
  const [quickDescription, setQuickDescription] = useState('')
  const [quickBasePrice, setQuickBasePrice] = useState('')
  const [quickQuantity, setQuickQuantity] = useState('1')
  const [quickUnitCost, setQuickUnitCost] = useState('')

  const isTransfer = Number(documentType) === InventoryDocumentType.Transfer
  const isAdjustment = Number(documentType) === InventoryDocumentType.Adjustment
  const isReceipt = Number(documentType) === InventoryDocumentType.Receipt
  const isPurchaseReceipt =
    isReceipt && Number(receiptOrigin) === InventoryReceiptOrigin.Purchase

  const receiptCostTotal = lines.reduce((sum, l) => {
    const qty = Number(l.quantity.replace(',', '.')) || 0
    const cost = Number(l.unitCost.replace(',', '.')) || 0
    return sum + qty * cost
  }, 0)

  useEffect(() => {
    if (!tenantId || !canCreate) return
    let cancelled = false
    void (async () => {
      try {
        const [wh, catalog] = await Promise.all([
          listWarehouses(tenantId),
          listCatalogItems(tenantId, CatalogItemKind.Physical, CatalogItemStatus.Active),
        ])
        if (cancelled) return
        const operational = wh.filter((w) => w.systemRole !== 1)
        setWarehouses(operational)
        setFullCatalog(catalog)
        setWarehouseId((current) => current || operational[0]?.id || '')
        setDestinationWarehouseId((current) => current || operational[1]?.id || operational[0]?.id || '')
        setItems(
          catalog
            .filter((c) => c.status === CatalogItemStatus.Active && !c.isMatrixParent)
            .map((c) => ({ id: c.id, name: c.name, sku: c.sku }))
        )
      } catch {
        if (!cancelled) {
          setWarehouses([])
          setFullCatalog([])
          setItems([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canCreate, tenantId])

  const selectedWarehouseName = useMemo(() => {
    return warehouses.find((w) => w.id === warehouseId)?.name || 'Bodega'
  }, [warehouses, warehouseId])

  const openQuickCreateModal = useCallback((prefillText?: string) => {
    const clean = (prefillText ?? '').trim()
    const looksLikeSku = clean.length > 0 && !clean.includes(' ') && /^[A-Za-z0-9._-]+$/.test(clean)
    setQuickName(looksLikeSku ? '' : clean)
    setQuickSku(looksLikeSku ? clean.toUpperCase() : '')
    setQuickDescription('')
    setQuickBasePrice('')
    setQuickQuantity('1')
    setQuickUnitCost('')
    setIsQuickCreateOpen(true)
  }, [])

  const handleQuickCreateSubmit = useCallback(async () => {
    if (!tenantId) return
    const trimmedName = quickName.trim()
    const trimmedSku = quickSku.trim()
    if (!trimmedName) {
      toast.show({
        title: 'Nombre requerido',
        message: 'Ingresa el nombre del producto para crearlo en el catálogo.',
        variant: 'warning',
      })
      return
    }
    const parsedPrice =
      quickBasePrice.trim() !== '' ? Number(quickBasePrice.replace(',', '.')) : null
    if (parsedPrice != null && (Number.isNaN(parsedPrice) || parsedPrice < 0)) {
      toast.show({
        title: 'Precio inválido',
        message: 'El precio base de venta no puede ser negativo.',
        variant: 'warning',
      })
      return
    }

    setQuickBusy(true)
    try {
      const created = await createCatalogItem(tenantId, {
        kind: CatalogItemKind.Physical,
        name: trimmedName,
        sku: trimmedSku || null,
        description: quickDescription.trim() || null,
        basePrice: parsedPrice,
        customAttributesJson: '{}',
        familyId: null,
        hierarchyPathJson: null,
      })

      const newEntry = {
        id: created.itemId,
        name: trimmedName,
        sku: trimmedSku || null,
      }
      setItems((prev) => [newEntry, ...prev])
      setFullCatalog((prev) => [
        {
          id: created.itemId,
          kind: CatalogItemKind.Physical,
          name: trimmedName,
          description: quickDescription.trim() || null,
          sku: trimmedSku || null,
          basePrice: parsedPrice,
          status: CatalogItemStatus.Active,
          createdAt: new Date().toISOString(),
          isMatrixParent: false,
        },
        ...prev,
      ])

      const qtyStr = String(Math.max(1, Number(quickQuantity) || 1))
      const costStr = isReceipt ? quickUnitCost.trim() : ''

      setLines((prev) => {
        if (prev.length === 1 && !prev[0].catalogItemId) {
          return [{ catalogItemId: created.itemId, quantity: qtyStr, unitCost: costStr }]
        }
        return [...prev, { catalogItemId: created.itemId, quantity: qtyStr, unitCost: costStr }]
      })

      setIsQuickCreateOpen(false)
      toast.show({
        title: 'Producto creado y agregado',
        message: `«${trimmedName}» se guardó en el catálogo y se añadió a la tabla.`,
        variant: 'success',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'No se pudo crear el producto',
        message: readApiError(err, 'Verifica que el SKU no esté duplicado.'),
        variant: 'error',
      })
    } finally {
      setQuickBusy(false)
    }
  }, [
    isReceipt,
    quickBasePrice,
    quickDescription,
    quickName,
    quickQuantity,
    quickSku,
    quickUnitCost,
    tenantId,
    toast,
  ])

  const resolveCatalogItemByCode = useCallback(
    (code: string) => {
      const normalized = code.trim().toLowerCase()
      if (!normalized) return null
      return (
        fullCatalog.find((c) => {
          if (c.isMatrixParent || c.kind !== CatalogItemKind.Physical) return false
          if (c.sku && c.sku.toLowerCase() === normalized) return true
          if (c.customAttributesJson) {
            try {
              const attrs = JSON.parse(c.customAttributesJson) as Record<string, unknown>
              if (attrs && typeof attrs === 'object') {
                const barcode = attrs.barcode || attrs.codigo_barras || attrs.ean
                if (barcode && String(barcode).toLowerCase() === normalized) return true
              }
            } catch {
              // ignore
            }
          }
          return false
        }) ?? null
      )
    },
    [fullCatalog]
  )

  const handleScanSubmit = useCallback(() => {
    const code = scannedBarcode.trim()
    if (!code) return

    const matched = resolveCatalogItemByCode(code)

    if (!matched) {
      toast.show({
        title: 'No encontrado',
        message: `El código o SKU «${code}» no coincide con ningún ítem físico activo.`,
        variant: 'error',
      })
      return
    }

    setLines((prev) => {
      const updated = [...prev]
      if (updated.length === 1 && !updated[0].catalogItemId) {
        return [{ catalogItemId: matched.id, quantity: '1', unitCost: '' }]
      }
      const idx = updated.findIndex((l) => l.catalogItemId === matched.id)
      if (idx >= 0) {
        const cur = Number(updated[idx].quantity) || 0
        updated[idx] = { ...updated[idx], quantity: String(cur + 1) }
      } else {
        updated.push({ catalogItemId: matched.id, quantity: '1', unitCost: '' })
      }
      return updated
    })

    toast.show({
      title: 'Ítem agregado',
      message: `${matched.name} (${matched.sku || 'Sin SKU'})`,
      variant: 'success',
    })
    setScannedBarcode('')
  }, [scannedBarcode, resolveCatalogItemByCode, toast])

  const handleDownloadExcelTemplate = useCallback(async () => {
    try {
      setExcelBusy(true)
      const blob = await buildInventoryLinesTemplateBlob()
      downloadBlob(blob, 'Plantilla_Lineas_Inventario.xlsx')
    } catch (err: unknown) {
      toast.show({
        title: 'No se pudo generar la plantilla',
        message: err instanceof Error ? err.message : 'Error al crear el Excel.',
        variant: 'error',
      })
    } finally {
      setExcelBusy(false)
    }
  }, [toast])

  const handleExcelFileSelected = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        toast.show({
          title: 'Archivo inválido',
          message: 'Usa un libro Excel (.xlsx).',
          variant: 'error',
        })
        return
      }

      setExcelBusy(true)
      try {
        const result = await parseInventoryLinesWorkbook(
          file,
          (code) => {
            const item = resolveCatalogItemByCode(code)
            return item ? { id: item.id } : null
          },
          {
            allowZeroQuantity: isAdjustment,
            applyUnitCost: isReceipt,
          }
        )

        if (result.lines.length === 0) {
          const detail = [
            ...result.unmatchedCodes.slice(0, 5).map((c) => `SKU «${c}» no encontrado`),
            ...result.invalidRows.slice(0, 5),
          ].join(' · ')
          toast.show({
            title: 'Sin líneas válidas',
            message: detail || 'Ninguna fila pudo resolverse contra el catálogo.',
            variant: 'error',
          })
          return
        }

        setLines((prev) => {
          let updated = [...prev]
          if (updated.length === 1 && !updated[0].catalogItemId) {
            updated = []
          }
          for (const item of result.lines) {
            const existingIdx = updated.findIndex((l) => l.catalogItemId === item.catalogItemId)
            if (existingIdx >= 0) {
              const cur = Number(updated[existingIdx].quantity) || 0
              const add = Number(item.quantity) || 0
              updated[existingIdx] = {
                ...updated[existingIdx],
                quantity: String(cur + add),
                unitCost:
                  isReceipt && item.unitCost
                    ? item.unitCost
                    : updated[existingIdx].unitCost,
              }
            } else {
              updated.push({
                catalogItemId: item.catalogItemId,
                quantity: item.quantity,
                unitCost: isReceipt ? item.unitCost : '',
              })
            }
          }
          return updated.length > 0 ? updated : [{ catalogItemId: '', quantity: '1', unitCost: '' }]
        })

        const parts = [`${result.matchedCount} ítem(s) cargado(s)`]
        if (result.unmatchedCodes.length) {
          const sample = result.unmatchedCodes.slice(0, 4).join(', ')
          parts.push(
            `${result.unmatchedCodes.length} no encontrado(s)${sample ? `: ${sample}` : ''}`
          )
        }
        if (result.invalidRows.length) {
          parts.push(`${result.invalidRows.length} fila(s) inválida(s)`)
        }
        toast.show({
          title: 'Excel importado',
          message: parts.join(' · '),
          variant: result.unmatchedCodes.length || result.invalidRows.length ? 'warning' : 'success',
        })
      } catch (err: unknown) {
        toast.show({
          title: 'No se pudo importar',
          message: err instanceof Error ? err.message : 'Error al leer el Excel.',
          variant: 'error',
        })
      } finally {
        setExcelBusy(false)
      }
    },
    [isAdjustment, isReceipt, resolveCatalogItemByCode, toast]
  )

  const handleAddLinesFromModal = useCallback(
    (newItems: { catalogItemId: string; quantity: number }[]) => {
      setLines((prev) => {
        let updated = [...prev]
        if (updated.length === 1 && !updated[0].catalogItemId) {
          updated = []
        }
        for (const item of newItems) {
          const existingIdx = updated.findIndex((l) => l.catalogItemId === item.catalogItemId)
          if (existingIdx >= 0) {
            const cur = Number(updated[existingIdx].quantity) || 0
            updated[existingIdx] = {
              ...updated[existingIdx],
              quantity: String(cur + item.quantity),
            }
          } else {
            updated.push({
              catalogItemId: item.catalogItemId,
              quantity: String(item.quantity),
              unitCost: '',
            })
          }
        }
        return updated
      })

      toast.show({
        title: 'Artículos cargados',
        message: `Se agregaron ${newItems.length} ítem(s) al documento.`,
        variant: 'success',
      })
    },
    [toast]
  )

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ value: w.id, label: w.isMain ? `${w.name} (principal)` : w.name })),
    [warehouses]
  )
  const destinationOptions = useMemo(
    () =>
      warehouses
        .filter((w) => w.id !== warehouseId)
        .map((w) => ({ value: w.id, label: w.isMain ? `${w.name} (principal)` : w.name })),
    [warehouseId, warehouses]
  )
  const itemOptions = useMemo(
    () => items.map((i) => ({ value: i.id, label: i.sku ? `${i.name} (${i.sku})` : i.name })),
    [items]
  )

  const skuOf = useCallback(
    (catalogItemId: string) => items.find((i) => i.id === catalogItemId)?.sku?.trim() || '—',
    [items]
  )

  const nameOf = useCallback(
    (catalogItemId: string) => items.find((i) => i.id === catalogItemId)?.name || 'Artículo',
    [items]
  )

  const goToList = useCallback(() => {
    void navigate('/inventario/documentos')
  }, [navigate])

  const onDocumentTypeChange = useCallback(
    (value: string) => {
      setDocumentType(value)
      const next = new URLSearchParams(params)
      if (value === String(InventoryDocumentType.Receipt)) {
        next.delete('tipo')
      } else {
        next.set('tipo', value)
      }
      const search = next.toString()
      void navigate(
        { pathname: '/inventario/documentos/nuevo', search: search ? `?${search}` : '' },
        { replace: true }
      )
    },
    [navigate, params]
  )

  const onSubmit = useCallback(
    async (
      e?: FormEvent,
      opts?: { allowZeroCost?: boolean; approveAfterCreate?: boolean }
    ) => {
      e?.preventDefault()
      if (!tenantId) return
      const allowZeroCost = opts?.allowZeroCost ?? false
      const approveAfterCreate = opts?.approveAfterCreate ?? false
      setError(null)
      setBusy(true)
      try {
        if (!warehouseId) throw new Error('Elige una bodega operativa.')
        if (isTransfer && !destinationWarehouseId) {
          throw new Error('Elige la bodega destino.')
        }
        if (isTransfer && destinationWarehouseId === warehouseId) {
          throw new Error('Origen y destino deben ser distintos.')
        }
        if (isAdjustment && !notes.trim()) {
          throw new Error('El ajuste requiere una nota con el motivo del conteo.')
        }
        if (isReceipt && Number(receiptOrigin) === InventoryReceiptOrigin.Purchase) {
          const invoice = sourceDocumentNumber.trim()
          if (!PURCHASE_INVOICE.test(invoice)) {
            throw new Error('La factura de compra debe ser 001-001-000000123.')
          }
        }

        // Validación: en recepciones no se permite dejar el costo vacío por descuido
        if (isReceipt) {
          const emptyCostRow = lines.find((l) => l.catalogItemId && l.unitCost.trim() === '')
          if (emptyCostRow) {
            const itemName = nameOf(emptyCostRow.catalogItemId)
            const itemSku = skuOf(emptyCostRow.catalogItemId)
            const label = itemSku !== '—' ? `${itemName} (${itemSku})` : itemName
            throw new Error(
              `Debes especificar el costo unitario para «${label}». Si corresponde a una muestra o bonificación sin costo, ingresa 0.00.`
            )
          }
        }

        const parsed = lines
          .map((l) => ({
            catalogItemId: l.catalogItemId,
            quantity: Number(l.quantity.replace(',', '.')),
            unitCost: isReceipt && l.unitCost.trim() ? Number(l.unitCost.replace(',', '.')) : null,
          }))
          .filter((l) => l.catalogItemId)
        if (parsed.length === 0) throw new Error('Agrega al menos una línea con ítem.')
        if (parsed.some((l) => l.unitCost != null && (Number.isNaN(l.unitCost) || l.unitCost < 0))) {
          throw new Error('El costo unitario no puede ser negativo.')
        }
        if (
          parsed.some((l) =>
            Number.isNaN(l.quantity) || (isAdjustment ? l.quantity < 0 : l.quantity <= 0)
          )
        ) {
          throw new Error(
            isAdjustment
              ? 'Las cantidades contadas no pueden ser negativas.'
              : 'Las cantidades deben ser mayores que cero.'
          )
        }

        // Advertencia preventiva si hay artículos con costo $0.00 en recepción
        if (isReceipt && !allowZeroCost) {
          const zeroLines = parsed.filter((l) => l.unitCost === 0)
          if (zeroLines.length > 0) {
            pendingApproveAfterCreateRef.current = approveAfterCreate
            setZeroCostLines(zeroLines)
            setIsZeroCostModalOpen(true)
            setBusy(false)
            return
          }
        }

        const created = await createInventoryDocument(tenantId, {
          documentType: Number(documentType) as InventoryDocumentType,
          warehouseId,
          destinationWarehouseId: isTransfer ? destinationWarehouseId : null,
          notes: notes.trim() || null,
          receiptOrigin: isReceipt ? (Number(receiptOrigin) as InventoryReceiptOrigin) : null,
          sourceDocumentNumber:
            isReceipt && Number(receiptOrigin) === InventoryReceiptOrigin.Purchase
              ? sourceDocumentNumber.trim()
              : null,
          lines: parsed,
        })

        if (approveAfterCreate && canApprove) {
          await approveInventoryDocument(tenantId, created.documentId)
          toast.show({
            title: isTransfer ? 'Transferencia despachada' : 'Documento aprobado',
            message: isTransfer
              ? 'El stock quedó en tránsito. Confirma la llegada en Documentos → Por recibir.'
              : isAdjustment
                ? 'El saldo se ajustó al conteo físico.'
                : 'El kárdex y el stock ya están actualizados.',
            variant: 'success',
          })
          if (isTransfer) {
            void navigate('/inventario/documentos?cola=recibir', { replace: true })
            return
          }
          void navigate('/inventario/documentos', { replace: true })
          return
        }

        toast.show({
          title: canApprove ? 'Ingresado' : 'Borrador guardado',
          message: canApprove
            ? 'Quedó en la cola Por aprobar. Puedes aprobarlo desde Documentos.'
            : 'Quien tenga permiso de aprobar lo pasará a stock.',
          variant: 'success',
        })
        void navigate(
          canApprove
            ? '/inventario/documentos?cola=aprobar'
            : '/inventario/documentos?cola=borradores',
          { replace: true }
        )
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : readApiError(err, 'No se pudo guardar el documento.')
        setError(message)
        toast.show({ title: 'No se pudo guardar', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [
      canApprove,
      destinationWarehouseId,
      documentType,
      isAdjustment,
      isReceipt,
      isTransfer,
      lines,
      nameOf,
      navigate,
      notes,
      receiptOrigin,
      skuOf,
      sourceDocumentNumber,
      tenantId,
      toast,
      warehouseId,
    ]
  )

  if (!canCreate) {
    return (
      <TenantSessionGate title="Nuevo documento" lead="Recepción, egreso, transferencia o ajuste.">
        <div className="ecu-dashboard-layout ecu-section-page ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres inventory.documents.create para generar comprobantes de movimiento."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
          <SectionCard title="Permisos insuficientes">
            <p className="app-shell__muted" style={{ marginBottom: '1rem' }}>
              No posees permisos de emisión de documentos de inventario.
            </p>
            <Button type="button" variant="outline" onClick={goToList}>
              Volver al listado
            </Button>
          </SectionCard>
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Nuevo documento"
      lead="Movimiento físico de stock: recepción, egreso, transferencia o ajuste de inventario."
    >
      <div className="ecu-dashboard-layout ecu-section-page ecu-section-page">
        <PageHeader
          title="Nuevo Documento de Inventario"
          subtitle={
            isTransfer
              ? 'Transferencia entre bodegas. Al despachar, el stock pasa a «En tránsito» y se confirma al recibir en destino.'
              : isAdjustment
                ? 'Ajuste de inventario físico. Al aprobar, se corrige la diferencia positiva o negativa en el kárdex.'
                : isReceipt
                  ? 'Recepción de mercadería. Ingresa unidades al stock de la bodega seleccionada.'
                  : 'Egreso logístico. Disminuye existencias de la bodega de origen.'
          }
          badge={
            <StatusBadge tone="primary" withDot>
              Alta de Comprobante
            </StatusBadge>
          }
          actions={
            <EcuPageActions
              items={[
                {
                  id: 'list',
                  label: 'Documentos',
                  icon: 'file-text',
                  route: '/inventario/documentos',
                  disabled: false,
                },
              ]}
              variant="outline"
              triggerLabel="Acciones"
              renderIcon={renderSidebarIcon}
              onNavigate={(route: string) => navigate(route)}
            />
          }
        />

        <form
          onSubmit={(e) => void onSubmit(e, { approveAfterCreate: false })}
          noValidate
        >
          <SectionCard
            title="Cabecera del Movimiento"
            info="Define la naturaleza de la transacción, las bodegas involucradas y referencias comerciales"
          >
            {error ? (
              <div className="ecu-form-error-banner" role="alert">
                <span className="material-symbols-outlined">error</span>
                <span>{error}</span>
              </div>
            ) : null}

            <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
              <div className="ecu-companies-form__field">
                <Select
                  id="inv-type"
                  label="Tipo de comprobante"
                  labelPosition="outlined"
                  variant="outline"
                  options={[
                    { value: String(InventoryDocumentType.Receipt), label: 'Recepción (entrada)' },
                    { value: String(InventoryDocumentType.Issue), label: 'Egreso (salida)' },
                    { value: String(InventoryDocumentType.Transfer), label: 'Transferencia entre bodegas' },
                    { value: String(InventoryDocumentType.Adjustment), label: 'Ajuste físico (conteo)' },
                  ]}
                  value={documentType}
                  onChange={onDocumentTypeChange}
                  disabled={busy}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <Select
                  id="inv-wh"
                  label={isTransfer ? 'Bodega origen' : 'Bodega'}
                  labelPosition="outlined"
                  variant="outline"
                  options={warehouseOptions}
                  value={warehouseId}
                  onChange={setWarehouseId}
                  disabled={busy || warehouseOptions.length === 0}
                  fullWidth
                />
              </div>
              {isTransfer ? (
                <div className="ecu-companies-form__field">
                  <Select
                    id="inv-wh-dest"
                    label="Bodega destino"
                    labelPosition="outlined"
                    variant="outline"
                    options={destinationOptions}
                    value={destinationWarehouseId}
                    onChange={setDestinationWarehouseId}
                    disabled={busy || destinationOptions.length === 0}
                    fullWidth
                  />
                </div>
              ) : null}
              {isReceipt ? (
                <div className="ecu-companies-form__field">
                  <Select
                    id="inv-origin"
                    label="Origen de la recepción"
                    labelPosition="outlined"
                    variant="outline"
                    options={[
                      { value: String(InventoryReceiptOrigin.Opening), label: 'Inventario inicial' },
                      { value: String(InventoryReceiptOrigin.Purchase), label: 'Compra a proveedor' },
                      { value: String(InventoryReceiptOrigin.Return), label: 'Devolución de cliente' },
                      { value: String(InventoryReceiptOrigin.Other), label: 'Otro concepto' },
                    ]}
                    value={receiptOrigin}
                    onChange={setReceiptOrigin}
                    disabled={busy}
                    fullWidth
                  />
                </div>
              ) : null}
              {isPurchaseReceipt ? (
                <div className="ecu-companies-form__field">
                  <TextBox
                    id="inv-invoice"
                    label="Nº factura proveedor"
                    labelPosition="outlined"
                    variant="outline"
                    value={sourceDocumentNumber}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setSourceDocumentNumber(e.target.value)
                    }
                    placeholder="001-001-000000123"
                    required
                    disabled={busy}
                    fullWidth
                  />
                </div>
              ) : null}
            </div>

            <div className="ecu-companies-form__field" style={{ marginTop: '1rem' }}>
              <TextArea
                id="inv-notes"
                label={isAdjustment ? 'Motivo del ajuste (obligatorio)' : 'Observación / Referencia interna'}
                labelPosition="outlined"
                variant="outline"
                value={notes}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                placeholder={
                  isAdjustment
                    ? 'Indica la justificación del conteo físico o discrepancia…'
                    : 'Anotaciones opcionales para control operativo…'
                }
                rows={2}
                resize="vertical"
                required={isAdjustment}
                disabled={busy}
                fullWidth
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Detalle de Artículos"
            info="Indica los ítems físicos del catálogo y las cantidades correspondientes"
          >
            <div className="ecu-inv-quick-bar">
              <div className="ecu-inv-quick-bar__scanner">
                <TextBox
                  id="inv-quick-scan"
                  placeholder="Escanear"
                  variant="outline"
                  size="sm"
                  value={scannedBarcode}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setScannedBarcode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleScanSubmit()
                    }
                  }}
                  disabled={busy}
                  fullWidth
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleScanSubmit}
                  disabled={busy || !scannedBarcode.trim()}
                  title="Escanear o agregar SKU"
                  iconLeft={<ScanBarcode size={16} strokeWidth={1.75} aria-hidden />}
                >
                  Escanear
                </Button>
              </div>

              <div className="ecu-inv-quick-bar__buttons">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setSelectModalMode('search')
                    setIsSelectModalOpen(true)
                  }}
                  iconLeft={<Boxes size={16} strokeWidth={1.75} aria-hidden />}
                  title="Seleccionar productos del catálogo"
                >
                  Del catálogo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setSelectModalMode('matrix')
                    setIsSelectModalOpen(true)
                  }}
                  iconLeft={<Layers size={16} strokeWidth={1.75} aria-hidden />}
                  title="Cargar por Matriz / Modelo"
                >
                  Por matriz
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => openQuickCreateModal(scannedBarcode)}
                  iconLeft={<Plus size={16} strokeWidth={1.75} aria-hidden />}
                  title="Crear producto rápido"
                >
                  Crear producto
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || excelBusy}
                  onClick={() => void handleDownloadExcelTemplate()}
                  iconLeft={<Download size={16} strokeWidth={1.75} aria-hidden />}
                  title="Descargar plantilla Excel de líneas"
                >
                  Plantilla
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || excelBusy}
                  loading={excelBusy}
                  onClick={() => excelFileInputRef.current?.click()}
                  iconLeft={<FileSpreadsheet size={16} strokeWidth={1.75} aria-hidden />}
                  title="Importar líneas desde Excel (.xlsx)"
                >
                  Importar Excel
                </Button>
                <input
                  ref={excelFileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  hidden
                  onChange={(e) => void handleExcelFileSelected(e)}
                />
              </div>
            </div>

            <div className="ecu-doc-lines__wrap">
              <table className="ecu-doc-lines">
                <thead>
                  <tr>
                    <th scope="col" className="ecu-doc-lines__n">
                      #
                    </th>
                    <th scope="col" className="ecu-doc-lines__sku">
                      SKU
                    </th>
                    <th scope="col">Ítem físico</th>
                    <th scope="col" className="ecu-doc-lines__qty">
                      {isAdjustment ? 'Cantidad contada' : 'Cantidad'}
                    </th>
                    {isReceipt && (
                      <>
                        <th scope="col" className="ecu-doc-lines__qty" style={{ minWidth: '140px' }}>
                          Costo unitario (neto sin IVA)
                        </th>
                        <th scope="col" className="ecu-doc-lines__qty" style={{ minWidth: '110px', textAlign: 'right' }}>
                          Subtotal
                        </th>
                      </>
                    )}
                    <th scope="col" className="ecu-doc-lines__actions">
                      <span className="visually-hidden">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={`line-${index}`}>
                      <td className="ecu-doc-lines__n">{index + 1}</td>
                      <td className="ecu-doc-lines__sku">
                        {line.catalogItemId ? (
                          <code className="ecu-code">{skuOf(line.catalogItemId)}</code>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <Select
                          id={`inv-item-${index}`}
                          aria-label={`Ítem línea ${index + 1}`}
                          variant="outline"
                          size="sm"
                          options={itemOptions}
                          value={line.catalogItemId}
                          placeholder="Seleccionar ítem de la lista…"
                          onChange={(value: string) =>
                            setLines((prev) =>
                              prev.map((row, i) =>
                                i === index ? { ...row, catalogItemId: value } : row
                              )
                            )
                          }
                          disabled={busy}
                          fullWidth
                        />
                      </td>
                      <td className="ecu-doc-lines__qty">
                        <NumberBox
                          id={`inv-qty-${index}`}
                          aria-label={`Cantidad línea ${index + 1}`}
                          variant="outline"
                          size="sm"
                          min={0}
                          step={1}
                          showSpinButtons
                          value={Number(line.quantity) || 0}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setLines((prev) =>
                              prev.map((row, i) =>
                                i === index ? { ...row, quantity: e.target.value } : row
                              )
                            )
                          }
                          disabled={busy}
                          fullWidth
                        />
                      </td>
                      {isReceipt && (
                        <>
                          <td className="ecu-doc-lines__qty">
                            <NumberBox
                              id={`inv-cost-${index}`}
                              aria-label={`Costo unitario línea ${index + 1}`}
                              variant="outline"
                              size="sm"
                              min={0}
                              step={0.01}
                              value={line.unitCost === '' ? '' : Number(line.unitCost)}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                setLines((prev) =>
                                  prev.map((row, i) =>
                                    i === index ? { ...row, unitCost: e.target.value } : row
                                  )
                                )
                              }
                              placeholder="0.00 (sin IVA)"
                              disabled={busy}
                              fullWidth
                            />
                          </td>
                          <td
                            className="ecu-doc-lines__qty"
                            style={{
                              textAlign: 'right',
                              fontWeight: 600,
                              verticalAlign: 'middle',
                              color: 'var(--glb-text)',
                              paddingRight: '0.75rem',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            $
                            {(
                              (Number(line.quantity.replace(',', '.')) || 0) *
                              (Number(line.unitCost.replace(',', '.')) || 0)
                            ).toFixed(2)}
                          </td>
                        </>
                      )}
                      <td className="ecu-doc-lines__actions">
                        <button
                          type="button"
                          className="ecu-doc-lines__icon-btn"
                          disabled={busy || lines.length === 1}
                          aria-label={`Quitar línea ${index + 1}`}
                          onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                        >
                          <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ecu-doc-lines__foot" style={{ marginTop: '0.75rem' }}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() =>
                  setLines((prev) => [...prev, { catalogItemId: '', quantity: '1', unitCost: '' }])
                }
              >
                <Plus size={15} strokeWidth={2} aria-hidden />
                Agregar línea
              </Button>
              {isReceipt ? (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--glb-text-muted, #a1a1aa)' }}>
                    * Costo neto unitario antes de IVA. Si es muestra o regalo, ingresa 0.00.
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--glb-text)' }}>
                    Total unidades:{' '}
                    <strong>
                      {lines.reduce((sum, l) => sum + (Number(l.quantity.replace(',', '.')) || 0), 0)}
                    </strong>
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--glb-text)' }}>
                    Total costo: <strong>${receiptCostTotal.toFixed(2)}</strong>
                  </span>
                </div>
              ) : null}
            </div>

            <div
              className="ecu-companies-form__actions"
              style={{
                marginTop: '1.5rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--glb-surface-border, rgba(0, 0, 0, 0.08))',
              }}
            >
              {canApprove ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    loading={busy}
                    disabled={busy}
                    onClick={() => void onSubmit(undefined, { approveAfterCreate: false })}
                  >
                    Guardar
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    loading={busy}
                    disabled={busy}
                    onClick={() => void onSubmit(undefined, { approveAfterCreate: true })}
                  >
                    {isTransfer ? 'Despachar' : 'Aprobar'}
                  </Button>
                </>
              ) : (
                <Button type="submit" variant="primary" loading={busy} disabled={busy}>
                  Guardar
                </Button>
              )}
              <Button type="button" variant="outline" disabled={busy} onClick={goToList}>
                Cancelar
              </Button>
            </div>
          </SectionCard>
        </form>

        <InventoryItemSelectModal
          key={`${warehouseId}-${selectModalMode}-${isSelectModalOpen}`}
          open={isSelectModalOpen}
          tenantId={tenantId}
          warehouseId={warehouseId}
          warehouseName={selectedWarehouseName}
          initialMode={selectModalMode}
          onClose={() => setIsSelectModalOpen(false)}
          onAddLines={handleAddLinesFromModal}
          onRequestCreateItem={openQuickCreateModal}
        />

        {isQuickCreateOpen ? (
          <Popup
            open={isQuickCreateOpen}
            title="Crear producto rápido en catálogo"
            onClose={() => !quickBusy && setIsQuickCreateOpen(false)}
            width="min(92vw, 34rem)"
            actions={[
              {
                id: 'cancel-quick',
                label: 'Cancelar',
                variant: 'outline',
                onClick: () => setIsQuickCreateOpen(false),
                disabled: quickBusy,
              },
              {
                id: 'save-quick',
                label: 'Crear y agregar al documento',
                variant: 'primary',
                loading: quickBusy,
                disabled: quickBusy,
                onClick: () => void handleQuickCreateSubmit(),
              },
            ]}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--glb-text-muted, #888)' }}>
                Crea un producto físico estándar sin salir del documento. Se guardará activo en el catálogo y se agregará automáticamente como línea abajo.
              </p>
              <div className="ecu-companies-form__grid ecu-companies-form__grid--2">
                <div className="ecu-companies-form__field">
                  <TextBox
                    id="quick-item-name"
                    label="Nombre del producto *"
                    labelPosition="outlined"
                    variant="outline"
                    placeholder="Ej. Termo Acero 1L"
                    value={quickName}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setQuickName(e.target.value)}
                    disabled={quickBusy}
                    fullWidth
                  />
                </div>
                <div className="ecu-companies-form__field">
                  <TextBox
                    id="quick-item-sku"
                    label="SKU / Código"
                    labelPosition="outlined"
                    variant="outline"
                    placeholder="Ej. TERMO-1L"
                    value={quickSku}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setQuickSku(e.target.value)}
                    disabled={quickBusy}
                    fullWidth
                  />
                </div>
              </div>

              <div className="ecu-companies-form__field">
                <TextBox
                  id="quick-item-desc"
                  label="Descripción corta (opcional)"
                  labelPosition="outlined"
                  variant="outline"
                  placeholder="Detalle o presentación del artículo"
                  value={quickDescription}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setQuickDescription(e.target.value)}
                  disabled={quickBusy}
                  fullWidth
                />
              </div>

              <div className="ecu-companies-form__grid ecu-companies-form__grid--3">
                <div className="ecu-companies-form__field">
                  <NumberBox
                    id="quick-item-price"
                    label="Precio venta base ($)"
                    labelPosition="outlined"
                    variant="outline"
                    min={0}
                    step={0.01}
                    placeholder="Opcional"
                    value={quickBasePrice === '' ? '' : Number(quickBasePrice)}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setQuickBasePrice(e.target.value)}
                    disabled={quickBusy}
                    fullWidth
                  />
                </div>
                <div className="ecu-companies-form__field">
                  <NumberBox
                    id="quick-item-qty"
                    label="Cant. documento"
                    labelPosition="outlined"
                    variant="outline"
                    min={1}
                    step={1}
                    showSpinButtons
                    value={Number(quickQuantity) || 1}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setQuickQuantity(e.target.value)}
                    disabled={quickBusy}
                    fullWidth
                  />
                </div>
                {isReceipt ? (
                  <div className="ecu-companies-form__field">
                    <NumberBox
                      id="quick-item-cost"
                      label="Costo unit. compra ($)"
                      labelPosition="outlined"
                      variant="outline"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      value={quickUnitCost === '' ? '' : Number(quickUnitCost)}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setQuickUnitCost(e.target.value)}
                      disabled={quickBusy}
                      fullWidth
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </Popup>
        ) : null}

        {isZeroCostModalOpen ? (
          <Popup
            open={isZeroCostModalOpen}
            title="Confirmar Artículos con Costo $0.00"
            onClose={() => setIsZeroCostModalOpen(false)}
            width="min(92vw, 34rem)"
            actions={[
              {
                id: 'cancel-zero',
                label: 'Revisar costos',
                variant: 'outline',
                onClick: () => setIsZeroCostModalOpen(false),
                disabled: busy,
              },
              {
                id: 'confirm-zero',
                label: 'Confirmar e Ingresar',
                variant: 'primary',
                loading: busy,
                disabled: busy,
                onClick: () => {
                  setIsZeroCostModalOpen(false)
                  void onSubmit(undefined, {
                    allowZeroCost: true,
                    approveAfterCreate: pendingApproveAfterCreateRef.current,
                  })
                },
              },
            ]}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(234, 179, 8, 0.1)',
                  border: '1px solid rgba(234, 179, 8, 0.25)',
                  color: 'var(--glb-text)',
                }}
              >
                <AlertTriangle size={20} style={{ color: '#eab308', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.875rem', lineHeight: 1.45 }}>
                  <strong>Atención:</strong> Se detectaron artículos con costo unitario de <strong>$0.00</strong>. Esto significa que ingresarán al inventario sin valorización monetaria (no sumarán al valor en libros de la bodega).
                </div>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--glb-text-muted, #a1a1aa)', margin: 0 }}>
                Verifica si corresponden a bonificaciones, muestras gratis o artículos sin costo de adquisición:
              </p>

              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  maxHeight: '180px',
                  overflowY: 'auto',
                }}
              >
                {zeroCostLines.map((item, idx) => (
                  <li
                    key={`zero-item-${idx}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      backgroundColor: 'var(--glb-surface-card, rgba(255, 255, 255, 0.04))',
                      border: '1px solid var(--glb-surface-border, rgba(255, 255, 255, 0.08))',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600 }}>{nameOf(item.catalogItemId)}</span>
                      {skuOf(item.catalogItemId) !== '—' && (
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', opacity: 0.7 }}>
                          ({skuOf(item.catalogItemId)})
                        </span>
                      )}
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--shell-primary, #6366f1)' }}>
                      {item.quantity} un.
                    </span>
                  </li>
                ))}
              </ul>

              <p style={{ fontSize: '0.8rem', color: 'var(--glb-text-muted, #888)', margin: 0 }}>
                Si fue un descuido involuntario, presiona <strong>«Revisar costos»</strong> para colocar el precio neto real antes de continuar.
              </p>
            </div>
          </Popup>
        ) : null}
      </div>
    </TenantSessionGate>
  )
}
