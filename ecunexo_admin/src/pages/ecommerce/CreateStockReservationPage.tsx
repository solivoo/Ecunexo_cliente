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
import { ArrowLeft, PackageCheck, Plus, Trash2, UserPlus } from 'lucide-react'
import { PageHeader, SectionCard, StatCard, StatusBadge } from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import { listCatalogItems } from '@/services/catalogApi'
import { listCustomers } from '@/services/customersApi'
import { listStock, listWarehouses } from '@/services/inventoryApi'
import { createStockReservation } from '@/services/stockReservationApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { CatalogItemListItemDto } from '@/types/catalogApi'
import type { CustomerDto } from '@/types/customersApi'
import type { StockListItemDto, WarehouseListItemDto } from '@/types/inventoryApi'

type CatalogSkuRow = {
  catalogItemId: string
  sku: string
  name: string
  available: number
  basePrice: number
  isAdded: boolean
  actions?: unknown
} & Record<string, unknown>

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

const skuGridMessages = createSpanishDataGridMessages('producto', 'productos')
const lineGridMessages = createSpanishDataGridMessages('línea', 'líneas')

export function CreateStockReservationPage() {
  const tenantId = useAppSelector(selectTenantId)
  const navigate = useNavigate()
  const toast = useToast()
  const canManage = useHasPermission('ecommerce.orders.manage')

  const [warehouses, setWarehouses] = useState<WarehouseListItemDto[]>([])
  const [customers, setCustomers] = useState<CustomerDto[]>([])
  const [catalogItems, setCatalogItems] = useState<CatalogItemListItemDto[]>([])
  const [warehouseStocks, setWarehouseStocks] = useState<StockListItemDto[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [creating, setCreating] = useState(false)

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
  const [notes, setNotes] = useState('')
  const [draftLines, setDraftLines] = useState<DraftLineRow[]>([])

  const loadMasterData = useCallback(async () => {
    if (!tenantId) return
    setLoadingCatalog(true)
    try {
      const [whList, custList, itemList] = await Promise.all([
        listWarehouses(tenantId),
        listCustomers(tenantId),
        listCatalogItems(tenantId, { onlyRoots: false }),
      ])
      setWarehouses(whList)
      setCustomers(custList)
      setCatalogItems(itemList)
      if (whList.length > 0 && !warehouseId) {
        const main = whList.find((w) => w.isMain) ?? whList[0]
        setWarehouseId(main.id)
      }
    } catch (err) {
      toast.show({
        title: 'Error cargando catálogos',
        message: readApiError(err, 'No se pudieron cargar bodegas, clientes o productos.'),
        variant: 'error',
      })
    } finally {
      setLoadingCatalog(false)
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

  const stockByItem = useMemo(() => {
    const map = new Map<string, StockListItemDto>()
    for (const s of warehouseStocks) {
      map.set(s.catalogItemId, s)
    }
    return map
  }, [warehouseStocks])

  const addedIds = useMemo(() => new Set(draftLines.map((l) => l.catalogItemId)), [draftLines])

  const availableSkuRows: CatalogSkuRow[] = useMemo(() => {
    return catalogItems
      .map((item) => {
        const st = stockByItem.get(item.id)
        const avail = st ? Math.max(0, st.quantity) : 0
        return {
          catalogItemId: item.id,
          sku: item.sku ?? 'SIN-SKU',
          name: item.name,
          available: avail,
          basePrice: Number(item.basePrice ?? 0),
          isAdded: addedIds.has(item.id),
        }
      })
      .filter((r) => r.available > 0)
  }, [catalogItems, stockByItem, addedIds])

  const handleAddSku = useCallback((row: CatalogSkuRow) => {
    setDraftLines((prev) => {
      const existing = prev.find((l) => l.catalogItemId === row.catalogItemId)
      if (existing) {
        const nextQty = Math.min(row.available, existing.quantity + 1)
        return prev.map((l) =>
          l.catalogItemId === row.catalogItemId
            ? {
                ...l,
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
          catalogItemId: row.catalogItemId,
          sku: row.sku,
          name: row.name,
          available: row.available,
          quantity: 1,
          unitPrice: row.basePrice,
          taxRate,
          lineTotal: Number((row.basePrice * (1 + taxRate / 100)).toFixed(2)),
        },
      ]
    })
  }, [])

  const updateLine = useCallback(
    (catalogItemId: string, patch: Partial<Pick<DraftLineRow, 'quantity' | 'unitPrice' | 'taxRate'>>) => {
      setDraftLines((prev) =>
        prev.map((l) => {
          if (l.catalogItemId !== catalogItemId) return l
          const nextQty = patch.quantity !== undefined ? Math.max(1, Math.min(l.available, patch.quantity)) : l.quantity
          const nextPrice = patch.unitPrice !== undefined ? Math.max(0, patch.unitPrice) : l.unitPrice
          const nextTax = patch.taxRate !== undefined ? Math.min(100, Math.max(0, patch.taxRate)) : l.taxRate
          return {
            ...l,
            quantity: nextQty,
            unitPrice: nextPrice,
            taxRate: nextTax,
            lineTotal: Number((nextQty * nextPrice * (1 + nextTax / 100)).toFixed(2)),
          }
        })
      )
    },
    []
  )

  const handleRemoveLine = useCallback((catalogItemId: string) => {
    setDraftLines((prev) => prev.filter((l) => l.catalogItemId !== catalogItemId))
  }, [])

  const totals = useMemo(() => {
    const subtotal = draftLines.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0)
    const tax = draftLines.reduce((acc, l) => acc + l.quantity * l.unitPrice * (l.taxRate / 100), 0)
    return {
      subtotal: Number(subtotal.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      total: Number((subtotal + tax).toFixed(2)),
    }
  }, [draftLines])

  const handleSubmit = async () => {
    if (!tenantId || !warehouseId) {
      toast.show({ title: 'Bodega requerida', message: 'Selecciona una bodega de reserva.', variant: 'warning' })
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
      toast.show({ title: 'Sin SKUs', message: 'Agrega al menos un SKU desde la tabla de stock disponible.', variant: 'warning' })
      return
    }

    setCreating(true)
    try {
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
        notes: notes.trim() || null,
      })

      toast.show({
        title: 'Reserva creada',
        message: `Reserva ${created.reservationNumber} creada con ${created.items.length} SKU(s) reservados.`,
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

  const skuColumns: ColumnDef<CatalogSkuRow>[] = useMemo(
    () => [
      { key: 'sku', header: 'SKU', width: 150 },
      { key: 'name', header: 'Producto', minWidth: 220 },
      { key: 'available', header: 'Stock Disp.', width: 110 },
      {
        key: 'basePrice',
        header: 'Precio Base',
        width: 115,
        renderCell: (_v, row) => `$${row.basePrice.toFixed(2)}`,
      },
      {
        key: 'actions',
        header: 'Acciones',
        width: 140,
        sticky: 'right',
        renderCell: (_v, row) => (
          <Button
            size="sm"
            variant={row.isAdded ? 'outline' : 'primary'}
            iconLeft={<Plus size={14} />}
            onClick={() => handleAddSku(row)}
          >
            {row.isAdded ? '+1 Unidad' : 'Reservar'}
          </Button>
        ),
      },
    ],
    [handleAddSku]
  )

  const lineColumns: ColumnDef<DraftLineRow>[] = useMemo(
    () => [
      { key: 'sku', header: 'SKU', width: 140 },
      { key: 'name', header: 'Producto', minWidth: 200 },
      { key: 'available', header: 'Máx. Disp.', width: 95 },
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
        header: 'Precio Unit. ($)',
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
        width: 115,
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
      lead="Selecciona el cliente, elige los SKUs disponibles en bodega y confirma la reserva."
    >
      <div className="ecu-dashboard-layout ecu-section-page ecu-dashboard-layout--fluid">
        <PageHeader
          title="Crear Reserva de Stock"
          badge={<StatusBadge tone="primary">Ecommerce · Reservas</StatusBadge>}
          info="Aparta SKUs del inventario para un cliente y habilita el registro de aportes parciales antes de facturar."
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.85rem' }}>
          <StatCard label="SKUs a reservar" value={draftLines.length} />
          <StatCard label="Subtotal" value={`$${totals.subtotal.toFixed(2)}`} />
          <StatCard label="IVA" value={`$${totals.tax.toFixed(2)}`} />
          <StatCard label="Total Reserva" value={`$${totals.total.toFixed(2)}`} />
        </div>

        <SectionCard
          title="1. Bodega y Cliente"
          info="Elige la bodega desde donde se bloqueará el stock y selecciona o registra al cliente."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem', alignItems: 'end' }}>
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

              {customerMode === 'existing' ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end' }}>
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
                  <Button
                    variant="outline"
                    iconLeft={<UserPlus size={15} />}
                    onClick={() => setCustomerMode('new')}
                  >
                    Nuevo cliente
                  </Button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <Button variant="outline" onClick={() => setCustomerMode('existing')}>
                    ← Elegir cliente existente
                  </Button>
                </div>
              )}
            </div>

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
          title={`2. SKUs Seleccionados para Reservar (${draftLines.length})`}
          info="Ajusta la cantidad, precio unitario o IVA de cada SKU antes de confirmar."
        >
          <DataGrid
            dataSource={draftLines}
            columns={lineColumns}
            keyExpr="catalogItemId"
            messages={lineGridMessages}
          />
        </SectionCard>

        <SectionCard
          title={`3. Catálogo con Stock Disponible en Bodega (${availableSkuRows.length})`}
          info="Busca por SKU o nombre del producto y haz clic en «Reservar» para agregarlo al grid."
        >
          <DataGrid
            dataSource={availableSkuRows}
            columns={skuColumns}
            keyExpr="catalogItemId"
            loading={loadingCatalog}
            showSearch
            messages={skuGridMessages}
          />
        </SectionCard>
      </div>
    </TenantSessionGate>
  )
}
