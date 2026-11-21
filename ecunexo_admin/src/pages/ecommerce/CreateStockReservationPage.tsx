import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  DataGrid,
  NumberBox,
  Select,
  TextBox,
  useToast,
  type ColumnDef,
} from 'glubox'
import { ArrowLeft, Boxes, PackageCheck, Plus, Trash2, Upload } from 'lucide-react'
import { PageHeader, SectionCard, StatCard, StatusBadge } from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { buildLineDescriptionFromCatalogItem } from '@/lib/catalogAttributes'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import { InvoiceStockCatalogModal } from '@/pages/facturacion/InvoiceStockCatalogModal'
import { listCustomers } from '@/services/customersApi'
import { listStock, listWarehouses } from '@/services/inventoryApi'
import { resolvePrice } from '@/services/pricingApi'
import {
  addStockReservationPayment,
  createStockReservation,
} from '@/services/stockReservationApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { CatalogItemListItemDto } from '@/types/catalogApi'
import type { CustomerDto } from '@/types/customersApi'
import type { StockListItemDto, WarehouseListItemDto } from '@/types/inventoryApi'

type DraftLineRow = {
  catalogItemId: string
  sku: string
  name: string
  available: number
  quantity: number
  unitPrice: number
  taxRate: number
  lineTotal: number
  actions?: unknown
} & Record<string, unknown>

const lineGridMessages = createSpanishDataGridMessages('ítem', 'ítems')

const paymentMethodOptions = [
  { value: '2', label: 'Transferencia / Depósito' },
  { value: '3', label: 'Efectivo' },
  { value: '1', label: 'Tarjeta' },
  { value: '4', label: 'Pasarela online' },
  { value: '99', label: 'Otro' },
]

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function CreateStockReservationPage() {
  const tenantId = useAppSelector(selectTenantId)
  const navigate = useNavigate()
  const toast = useToast()
  const canManage = useHasPermission('ecommerce.orders.manage')

  const [warehouses, setWarehouses] = useState<WarehouseListItemDto[]>([])
  const [customers, setCustomers] = useState<CustomerDto[]>([])
  const [warehouseStocks, setWarehouseStocks] = useState<StockListItemDto[]>([])
  const [creating, setCreating] = useState(false)
  const [stockModalOpen, setStockModalOpen] = useState(false)

  // Cliente y vigencia
  const [warehouseId, setWarehouseId] = useState('')
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing')
  const [customerId, setCustomerId] = useState('')
  const [newCustomerIdType, setNewCustomerIdType] = useState('2')
  const [newCustomerTaxId, setNewCustomerTaxId] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const [newCustomerAddress, setNewCustomerAddress] = useState('')
  const [newCustomerCity, setNewCustomerCity] = useState('')
  const [expiresDate, setExpiresDate] = useState('')
  const [notes, setNotes] = useState('')

  // Grid único de SKUs a reservar
  const [draftLines, setDraftLines] = useState<DraftLineRow[]>([])

  // Aporte inicial opcional
  const [initialPayAmount, setInitialPayAmount] = useState('')
  const [initialPayMethod, setInitialPayMethod] = useState('2')
  const [initialPayRef, setInitialPayRef] = useState('')
  const [initialPayNotes, setInitialPayNotes] = useState('')
  const [initialPayFile, setInitialPayFile] = useState<File | null>(null)

  const loadMasterData = useCallback(async () => {
    if (!tenantId) return
    try {
      const [whList, custList] = await Promise.all([
        listWarehouses(tenantId),
        listCustomers(tenantId),
      ])
      const operationalWarehouses = whList.filter((w) => w.systemRole !== 1)
      setWarehouses(operationalWarehouses)
      setCustomers(custList)
      if (operationalWarehouses.length > 0 && !warehouseId) {
        const main = operationalWarehouses.find((w) => w.isMain) ?? operationalWarehouses[0]
        setWarehouseId(main.id)
      }
    } catch (err) {
      toast.show({
        title: 'Error cargando datos',
        message: readApiError(err, 'No se pudieron cargar bodegas o clientes.'),
        variant: 'error',
      })
    }
  }, [tenantId, warehouseId, toast])

  useEffect(() => {
    void loadMasterData()
  }, [loadMasterData])

  useEffect(() => {
    if (!tenantId || !warehouseId) return
    let cancelled = false
    listStock(tenantId, { warehouseId })
      .then((list) => {
        if (!cancelled) setWarehouseStocks(list)
      })
      .catch(() => {
        if (!cancelled) setWarehouseStocks([])
      })
    return () => {
      cancelled = true
    }
  }, [tenantId, warehouseId])

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customers, customerId]
  )

  const stockByItem = useMemo(() => {
    const map = new Map<string, StockListItemDto>()
    for (const s of warehouseStocks) {
      map.set(s.catalogItemId, s)
    }
    return map
  }, [warehouseStocks])

  const getAvailableFor = useCallback(
    (catalogItemId: string): number => {
      const st = stockByItem.get(catalogItemId)
      if (!st) return 0
      if (st.availableQuantity !== undefined) return Math.max(0, st.availableQuantity)
      return Math.max(0, st.quantity - (st.reservedQuantity ?? 0))
    },
    [stockByItem]
  )

  const resolveAndApplyPvp = useCallback(
    async (catalogItemId: string, quantity: number, fallbackPrice: number) => {
      if (!tenantId) return
      try {
        const resolved = await resolvePrice(tenantId, {
          catalogItemId,
          quantity,
          date: todayIsoDate(),
          priceListId: selectedCustomer?.priceListId || undefined,
        })
        const pvp = resolved.unitPrice > 0 ? resolved.unitPrice : fallbackPrice
        const taxRate = resolved.taxRate > 0 && resolved.taxRate <= 1 ? resolved.taxRate * 100 : resolved.taxRate || 15
        setDraftLines((prev) =>
          prev.map((l) =>
            l.catalogItemId === catalogItemId
              ? {
                  ...l,
                  unitPrice: Number(pvp.toFixed(4)),
                  taxRate: Number(taxRate.toFixed(2)),
                  lineTotal: Number((l.quantity * pvp * (1 + taxRate / 100)).toFixed(2)),
                }
              : l
          )
        )
      } catch {
        // Mantiene el precio actual/base si no hay lista configurada
      }
    },
    [tenantId, selectedCustomer]
  )

  const handleSelectProductFromCatalog = useCallback(
    (product: CatalogItemListItemDto, quantity: number) => {
      const avail = getAvailableFor(product.id)
      if (avail <= 0) {
        toast.show({
          title: 'Sin stock disponible',
          message: `El SKU ${product.sku ?? product.name} no tiene unidades disponibles en la bodega.`,
          variant: 'warning',
        })
        return
      }

      const fallbackPrice = Number(product.basePrice ?? 0)
      const labelName = buildLineDescriptionFromCatalogItem(product) || product.name
      let nextQty = Math.min(avail, Math.max(1, quantity))

      setDraftLines((prev) => {
        const existing = prev.find((l) => l.catalogItemId === product.id)
        if (existing) {
          nextQty = Math.min(avail, existing.quantity + Math.max(1, quantity))
          return prev.map((l) =>
            l.catalogItemId === product.id
              ? {
                  ...l,
                  available: avail,
                  quantity: nextQty,
                  lineTotal: Number((nextQty * l.unitPrice * (1 + l.taxRate / 100)).toFixed(2)),
                }
              : l
          )
        }
        const taxRate = 15
        return [
          ...prev,
          {
            catalogItemId: product.id,
            sku: product.sku ?? 'SIN-SKU',
            name: labelName,
            available: avail,
            quantity: nextQty,
            unitPrice: fallbackPrice,
            taxRate,
            lineTotal: Number((nextQty * fallbackPrice * (1 + taxRate / 100)).toFixed(2)),
          },
        ]
      })

      void resolveAndApplyPvp(product.id, nextQty, fallbackPrice)
    },
    [getAvailableFor, resolveAndApplyPvp, toast]
  )

  const updateLine = useCallback(
    (catalogItemId: string, patch: Partial<Pick<DraftLineRow, 'quantity' | 'unitPrice' | 'taxRate'>>) => {
      let resolvedQty: number | null = null
      let fallbackPrice = 0
      setDraftLines((prev) =>
        prev.map((l) => {
          if (l.catalogItemId !== catalogItemId) return l
          const nextQty =
            patch.quantity !== undefined ? Math.max(1, Math.min(l.available, patch.quantity)) : l.quantity
          const nextPrice = patch.unitPrice !== undefined ? Math.max(0, patch.unitPrice) : l.unitPrice
          const nextTax = patch.taxRate !== undefined ? Math.min(100, Math.max(0, patch.taxRate)) : l.taxRate
          if (patch.quantity !== undefined) {
            resolvedQty = nextQty
            fallbackPrice = l.unitPrice
          }
          return {
            ...l,
            quantity: nextQty,
            unitPrice: nextPrice,
            taxRate: nextTax,
            lineTotal: Number((nextQty * nextPrice * (1 + nextTax / 100)).toFixed(2)),
          }
        })
      )
      if (resolvedQty !== null) {
        void resolveAndApplyPvp(catalogItemId, resolvedQty, fallbackPrice)
      }
    },
    [resolveAndApplyPvp]
  )

  const handleRemoveLine = useCallback((catalogItemId: string) => {
    setDraftLines((prev) => prev.filter((l) => l.catalogItemId !== catalogItemId))
  }, [])

  const totals = useMemo(() => {
    const units = draftLines.reduce((acc, l) => acc + l.quantity, 0)
    const subtotal = draftLines.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0)
    const tax = draftLines.reduce((acc, l) => acc + l.quantity * l.unitPrice * (l.taxRate / 100), 0)
    const total = Number((subtotal + tax).toFixed(2))
    const initialPaid = Math.max(0, Number(initialPayAmount) || 0)
    const balance = Math.max(0, Number((total - initialPaid).toFixed(2)))
    return {
      units,
      subtotal: Number(subtotal.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      total,
      initialPaid,
      balance,
    }
  }, [draftLines, initialPayAmount])

  const handleSubmit = async () => {
    if (!tenantId || !warehouseId) {
      toast.show({ title: 'Bodega requerida', message: 'No hay una bodega operativa disponible.', variant: 'warning' })
      return
    }
    if (customerMode === 'existing' && !customerId) {
      toast.show({ title: 'Cliente requerido', message: 'Selecciona un cliente o crea uno nuevo.', variant: 'warning' })
      return
    }
    if (customerMode === 'new' && !newCustomerName.trim()) {
      toast.show({ title: 'Nombre requerido', message: 'Ingresa el nombre o razón social del cliente.', variant: 'warning' })
      return
    }
    if (draftLines.length === 0) {
      toast.show({ title: 'Sin SKUs', message: 'Agrega al menos un SKU desde el catálogo.', variant: 'warning' })
      return
    }

    setCreating(true)
    try {
      const expiresAtUtc = expiresDate ? new Date(`${expiresDate}T23:59:59Z`).toISOString() : null
      const created = await createStockReservation(tenantId, {
        warehouseId,
        customerId: customerMode === 'existing' ? customerId : null,
        newCustomer:
          customerMode === 'new'
            ? {
                name: newCustomerName.trim(),
                taxId: newCustomerTaxId.trim() || null,
                phone: newCustomerPhone.trim() || null,
                email: newCustomerEmail.trim() || null,
                address: newCustomerAddress.trim() || null,
                city: newCustomerCity.trim() || null,
                identificationType: Number(newCustomerIdType) || 2,
              }
            : null,
        items: draftLines.map((l) => ({
          catalogItemId: l.catalogItemId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate,
        })),
        expiresAtUtc,
        notes: notes.trim() || null,
      })

      const payVal = Number(initialPayAmount)
      if (payVal > 0) {
        try {
          await addStockReservationPayment(tenantId, created.id, {
            amount: payVal,
            paymentMethod: Number(initialPayMethod) || 2,
            reference: initialPayRef,
            notes: initialPayNotes,
            file: initialPayFile,
          })
        } catch (payErr) {
          toast.show({
            title: 'Reserva creada (aporte pendiente)',
            message: readApiError(payErr, 'La reserva se creó, pero no se pudo registrar el aporte inicial.'),
            variant: 'warning',
          })
          navigate('/ecommerce/reservas')
          return
        }
      }

      toast.show({
        title: 'Reserva creada',
        message:
          payVal > 0
            ? `Reserva ${created.reservationNumber} creada con aporte inicial de $${payVal.toFixed(2)}.`
            : `Reserva ${created.reservationNumber} creada con ${created.items.length} SKU(s) reservados.`,
        variant: 'success',
      })
      navigate('/ecommerce/reservas')
    } catch (err) {
      toast.show({
        title: 'Error al crear reserva',
        message: readApiError(err, 'Verifica el stock disponible.'),
        variant: 'error',
      })
    } finally {
      setCreating(false)
    }
  }

  const lineColumns: ColumnDef<DraftLineRow>[] = useMemo(
    () => [
      { key: 'sku', header: 'SKU', width: 140 },
      { key: 'name', header: 'Producto / Variante', minWidth: 220 },
      {
        key: 'available',
        header: 'Disp.',
        width: 85,
        renderCell: (_v, row) => <strong style={{ color: 'var(--shell-success, #22c55e)' }}>{row.available}</strong>,
      },
      {
        key: 'quantity',
        header: 'Cantidad',
        width: 115,
        renderCell: (_v, row) => (
          <NumberBox
            size="sm"
            variant="outline"
            min={1}
            max={row.available}
            value={row.quantity}
            onChange={(e) => updateLine(row.catalogItemId, { quantity: Number(e.target.value) || 1 })}
            fullWidth
          />
        ),
      },
      {
        key: 'unitPrice',
        header: 'PVP ($)',
        width: 130,
        renderCell: (_v, row) => (
          <NumberBox
            size="sm"
            variant="outline"
            min={0}
            step={0.01}
            value={row.unitPrice}
            onChange={(e) => updateLine(row.catalogItemId, { unitPrice: Number(e.target.value) || 0 })}
            fullWidth
          />
        ),
      },
      {
        key: 'taxRate',
        header: 'IVA (%)',
        width: 95,
        renderCell: (_v, row) => (
          <NumberBox
            size="sm"
            variant="outline"
            min={0}
            max={100}
            value={row.taxRate}
            onChange={(e) => updateLine(row.catalogItemId, { taxRate: Number(e.target.value) || 0 })}
            fullWidth
          />
        ),
      },
      {
        key: 'lineTotal',
        header: 'Total Línea',
        width: 120,
        renderCell: (_v, row) => <strong>${row.lineTotal.toFixed(2)}</strong>,
      },
      {
        key: 'actions',
        header: 'Acciones',
        width: 90,
        sticky: 'right',
        renderCell: (_v, row) => (
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleRemoveLine(row.catalogItemId)}
          >
            <Trash2 size={14} />
          </Button>
        ),
      },
    ],
    [updateLine, handleRemoveLine]
  )

  return (
    <TenantSessionGate
      title="Nueva Reserva de Stock"
      lead="Selecciona el cliente, busca los SKUs con PVP y stock disponible, y registra opcionalmente un aporte inicial."
    >
      <div className="ecu-dashboard-layout ecu-section-page ecu-dashboard-layout--fluid">
        <PageHeader
          title="Crear Reserva de Stock"
          badge={<StatusBadge tone="primary">Ecommerce · Reservas</StatusBadge>}
          info="Aparta SKUs del inventario disponible (Físico − Reservado) con PVP resuelto por lista de precios."
          actions={
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button
                variant="outline"
                iconLeft={<ArrowLeft size={16} />}
                onClick={() => navigate('/ecommerce/reservas')}
              >
                Volver a Reservas
              </Button>
              {canManage && (
                <Button
                  variant="primary"
                  iconLeft={<PackageCheck size={16} />}
                  disabled={creating || draftLines.length === 0}
                  onClick={() => void handleSubmit()}
                >
                  {creating ? 'Reservando...' : `Confirmar Reserva ($${totals.total.toFixed(2)})`}
                </Button>
              )}
            </div>
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de la reserva">
          <StatCard label="SKUs · Unidades" value={`${draftLines.length} · ${totals.units} u.`} />
          <StatCard label="Subtotal" value={`$${totals.subtotal.toFixed(2)}`} />
          <StatCard label="IVA" value={`$${totals.tax.toFixed(2)}`} />
          <StatCard label="Total Reserva" value={`$${totals.total.toFixed(2)}`} toneColor="var(--shell-success)" />
          <StatCard
            label="Saldo tras aporte"
            value={`$${totals.balance.toFixed(2)}`}
            toneColor={totals.balance > 0 ? 'var(--shell-warning)' : 'var(--shell-success)'}
          />
        </div>

        <SectionCard
          title={warehouses.length > 1 ? 'Bodega, Cliente y Vigencia' : 'Cliente y Vigencia'}
          info={
            warehouses.length > 1
              ? 'Elige la bodega operativa, selecciona o crea el cliente y define la fecha límite de la reserva.'
              : 'Selecciona un cliente existente o crea uno nuevo con (+), y opcionalmente fija fecha límite.'
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem', alignItems: 'center' }}>
              {warehouses.length > 1 && (
                <Select
                  label="Bodega de Reserva"
                  labelPosition="outlined"
                  variant="outline"
                  value={warehouseId}
                  onChange={(val) => {
                    setWarehouseId(val)
                    setDraftLines([])
                  }}
                  options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                  fullWidth
                />
              )}

              {customerMode === 'existing' ? (
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <Select
                      label="Cliente"
                      labelPosition="outlined"
                      variant="outline"
                      value={customerId}
                      onChange={(val) => setCustomerId(val)}
                      options={customers.map((c) => ({
                        value: c.id,
                        label: `${c.name}${c.taxId ? ` (${c.taxId})` : ''}`,
                      }))}
                      fullWidth
                    />
                  </div>
                  <button
                    type="button"
                    title="Crear cliente nuevo"
                    aria-label="Crear cliente nuevo"
                    onClick={() => setCustomerMode('new')}
                    style={{
                      width: '40px',
                      height: '40px',
                      minWidth: '40px',
                      borderRadius: '9999px',
                      border: '1px solid var(--shell-border, #334155)',
                      background: 'var(--shell-primary, #60a5fa)',
                      color: 'var(--shell-on-primary, #0f172a)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 0,
                      flexShrink: 0,
                    }}
                  >
                    <Plus size={18} strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <Button variant="outline" onClick={() => setCustomerMode('existing')}>
                    ← Elegir cliente existente
                  </Button>
                </div>
              )}

              <TextBox
                label="Válida hasta (opcional)"
                labelPosition="outlined"
                variant="outline"
                type="date"
                value={expiresDate}
                onChange={(e) => setExpiresDate(e.target.value)}
                fullWidth
              />
            </div>

            {customerMode === 'existing' && selectedCustomer && (
              <div
                style={{
                  display: 'flex',
                  gap: '1.25rem',
                  flexWrap: 'wrap',
                  fontSize: '0.85rem',
                  opacity: 0.85,
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--shell-border, #334155)',
                }}
              >
                <span><strong>ID:</strong> {selectedCustomer.taxId || '—'}</span>
                <span><strong>Tel:</strong> {selectedCustomer.contactPhone || '—'}</span>
                <span><strong>Correo:</strong> {selectedCustomer.contactEmail || '—'}</span>
                {selectedCustomer.city && <span><strong>Ciudad:</strong> {selectedCustomer.city}</span>}
              </div>
            )}

            {customerMode === 'new' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
                <Select
                  label="Tipo identificación"
                  labelPosition="outlined"
                  variant="outline"
                  value={newCustomerIdType}
                  onChange={(v) => setNewCustomerIdType(v)}
                  options={[
                    { value: '2', label: 'Cédula' },
                    { value: '1', label: 'RUC' },
                    { value: '3', label: 'Pasaporte' },
                  ]}
                  fullWidth
                />
                <TextBox
                  label="Cédula / RUC / Pasaporte"
                  labelPosition="outlined"
                  variant="outline"
                  value={newCustomerTaxId}
                  onChange={(e) => setNewCustomerTaxId(e.target.value)}
                  fullWidth
                />
                <TextBox
                  label="Nombre / Razón social"
                  labelPosition="outlined"
                  variant="outline"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  fullWidth
                />
                <TextBox
                  label="Teléfono"
                  labelPosition="outlined"
                  variant="outline"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  fullWidth
                />
                <TextBox
                  label="Correo"
                  labelPosition="outlined"
                  variant="outline"
                  value={newCustomerEmail}
                  onChange={(e) => setNewCustomerEmail(e.target.value)}
                  fullWidth
                />
                <TextBox
                  label="Dirección (SRI)"
                  labelPosition="outlined"
                  variant="outline"
                  value={newCustomerAddress}
                  onChange={(e) => setNewCustomerAddress(e.target.value)}
                  fullWidth
                />
                <TextBox
                  label="Ciudad"
                  labelPosition="outlined"
                  variant="outline"
                  value={newCustomerCity}
                  onChange={(e) => setNewCustomerCity(e.target.value)}
                  fullWidth
                />
              </div>
            )}

            <TextBox
              label="Notas internas de la reserva (opcional)"
              labelPosition="outlined"
              variant="outline"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Detalle de SKUs a Reservar"
          info="Usa el buscador de catálogo con stock y PVP (igual que en Facturación) para agregar los productos a reservar."
          action={
            <Button
              variant="primary"
              iconLeft={<Boxes size={16} />}
              onClick={() => setStockModalOpen(true)}
            >
              Buscar en catálogo (Stock y PVP)
            </Button>
          }
        >
          <DataGrid
            dataSource={draftLines}
            columns={lineColumns}
            keyExpr="catalogItemId"
            messages={lineGridMessages}
          />
        </SectionCard>

        <SectionCard
          title="Aporte Inicial con Comprobante (Opcional)"
          info="Si el cliente ya realizó un abono al apartar, regístralo aquí junto con su comprobante para descontarlo de inmediato."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
              <NumberBox
                label="Monto del aporte ($)"
                labelPosition="outlined"
                variant="outline"
                min={0}
                step={0.01}
                value={initialPayAmount ? Number(initialPayAmount) : undefined}
                onChange={(e) => setInitialPayAmount(e.target.value)}
                fullWidth
              />
              <Select
                label="Método de pago"
                labelPosition="outlined"
                variant="outline"
                value={initialPayMethod}
                onChange={(v) => setInitialPayMethod(v)}
                options={paymentMethodOptions}
                fullWidth
              />
              <TextBox
                label="Referencia / N° Comprobante"
                labelPosition="outlined"
                variant="outline"
                value={initialPayRef}
                onChange={(e) => setInitialPayRef(e.target.value)}
                fullWidth
              />
              <TextBox
                label="Nota del aporte"
                labelPosition="outlined"
                variant="outline"
                value={initialPayNotes}
                onChange={(e) => setInitialPayNotes(e.target.value)}
                fullWidth
              />
            </div>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', width: 'fit-content' }}>
              <Upload size={15} />
              <span>{initialPayFile ? initialPayFile.name : 'Adjuntar comprobante (JPG, PNG, WEBP o PDF)'}</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                style={{ display: 'none' }}
                onChange={(e) => setInitialPayFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </SectionCard>

        <InvoiceStockCatalogModal
          open={stockModalOpen}
          onClose={() => setStockModalOpen(false)}
          tenantId={tenantId}
          onSelectProduct={(product, quantity) => handleSelectProductFromCatalog(product, quantity)}
        />
      </div>
    </TenantSessionGate>
  )
}
