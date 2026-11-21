import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  DataGrid,
  NumberBox,
  Popup,
  Select,
  TextBox,
  useToast,
  type ColumnDef,
} from 'glubox'
import {
  CheckCircle2,
  Eye,
  FileText,
  PackageCheck,
  Plus,
  Receipt,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react'
import { PageHeader, SectionCard, StatCard, StatusBadge } from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import { listCatalogItems } from '@/services/catalogApi'
import { listCustomers } from '@/services/customersApi'
import { listStock, listWarehouses } from '@/services/inventoryApi'
import {
  addStockReservationPayment,
  cancelStockReservation,
  createStockReservation,
  getStockReservationPaymentProofUrl,
  listStockReservations,
} from '@/services/stockReservationApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { CatalogItemListItemDto } from '@/types/catalogApi'
import type { CustomerDto } from '@/types/customersApi'
import type { StockListItemDto, WarehouseListItemDto } from '@/types/inventoryApi'
import type {
  StockReservationDto,
  StockReservationStatus,
} from '@/types/stockReservationApi'

type ReservationRow = StockReservationDto & {
  actions?: unknown
} & Record<string, unknown>

type DraftLine = {
  catalogItemId: string
  sku: string
  name: string
  available: number
  quantity: number
  unitPrice: number
}

const gridMessages = createSpanishDataGridMessages('reserva', 'reservas')

const statusMeta: Record<
  StockReservationStatus,
  { label: string; tone: 'info' | 'warning' | 'success' | 'primary' | 'danger' }
> = {
  1: { label: 'Activa', tone: 'info' },
  2: { label: 'Abono parcial', tone: 'warning' },
  3: { label: 'Pagada', tone: 'success' },
  4: { label: 'Facturada', tone: 'primary' },
  5: { label: 'Anulada', tone: 'danger' },
}

const paymentMethodOptions = [
  { value: '2', label: 'Transferencia / Depósito' },
  { value: '3', label: 'Efectivo' },
  { value: '1', label: 'Tarjeta' },
  { value: '4', label: 'Pasarela online' },
  { value: '99', label: 'Otro' },
]

export function StockReservationsPage() {
  const tenantId = useAppSelector(selectTenantId)
  const navigate = useNavigate()
  const toast = useToast()
  const canManage = useHasPermission('ecommerce.orders.manage')
  const canInvoice = useHasPermission('facturacion.facturas.create')

  const [reservations, setReservations] = useState<ReservationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [warehouses, setWarehouses] = useState<WarehouseListItemDto[]>([])
  const [customers, setCustomers] = useState<CustomerDto[]>([])
  const [catalogItems, setCatalogItems] = useState<CatalogItemListItemDto[]>([])
  const [warehouseStocks, setWarehouseStocks] = useState<StockListItemDto[]>([])

  // Modal Crear Reserva
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [warehouseId, setWarehouseId] = useState('')
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing')
  const [customerId, setCustomerId] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerIdType, setNewCustomerIdType] = useState('2')
  const [newCustomerTaxId, setNewCustomerTaxId] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const [newCustomerAddress, setNewCustomerAddress] = useState('')
  const [newCustomerCity, setNewCustomerCity] = useState('')
  const [reservationNotes, setReservationNotes] = useState('')
  const [selectedSkuId, setSelectedSkuId] = useState('')
  const [draftLines, setDraftLines] = useState<DraftLine[]>([])

  // Modal Detalle / Abonos / Facturación
  const [selected, setSelected] = useState<StockReservationDto | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('2')
  const [payRef, setPayRef] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [payFile, setPayFile] = useState<File | null>(null)
  const [paying, setPaying] = useState(false)
  const [invoiceObsModalOpen, setInvoiceObsModalOpen] = useState(false)
  const [invoiceObservation, setInvoiceObservation] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const loadReservations = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const list = await listStockReservations(tenantId)
      setReservations(list.map((r) => ({ ...r })))
    } catch (err) {
      toast.show({
        title: 'Error cargando reservas',
        message: readApiError(err, 'No se pudieron obtener las reservas.'),
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, toast])

  const loadMasterData = useCallback(async () => {
    if (!tenantId) return
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
    } catch {
      // Se notifica al abrir creación si hace falta
    }
  }, [tenantId, warehouseId])

  useEffect(() => {
    void loadReservations()
    void loadMasterData()
  }, [loadReservations, loadMasterData])

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

  const availableSkuOptions = useMemo(() => {
    return catalogItems
      .map((item) => {
        const st = stockByItem.get(item.id)
        const avail = st ? Math.max(0, st.quantity) : 0
        return { item, avail }
      })
      .filter((x) => x.avail > 0)
      .map(({ item, avail }) => ({
        value: item.id,
        label: `${item.sku ?? 'SIN-SKU'} · ${item.name} (Disp: ${avail})`,
      }))
  }, [catalogItems, stockByItem])

  const handleAddDraftSku = () => {
    if (!selectedSkuId) return
    if (draftLines.some((l) => l.catalogItemId === selectedSkuId)) {
      toast.show({ title: 'SKU ya agregado', message: 'Ajusta la cantidad en la lista.', variant: 'info' })
      return
    }
    const item = catalogItems.find((i) => i.id === selectedSkuId)
    const st = stockByItem.get(selectedSkuId)
    const avail = st ? Math.max(0, st.quantity) : 0
    if (!item || avail <= 0) return

    setDraftLines((prev) => [
      ...prev,
      {
        catalogItemId: item.id,
        sku: item.sku ?? '',
        name: item.name,
        available: avail,
        quantity: 1,
        unitPrice: Number(item.basePrice ?? 0),
      },
    ])
    setSelectedSkuId('')
  }

  const handleCreateReservation = async () => {
    if (!tenantId || !warehouseId) {
      toast.show({ title: 'Bodega requerida', message: 'Selecciona una bodega.', variant: 'warning' })
      return
    }
    if (customerMode === 'existing' && !customerId) {
      toast.show({ title: 'Cliente requerido', message: 'Selecciona un cliente.', variant: 'warning' })
      return
    }
    if (customerMode === 'new' && !newCustomerName.trim()) {
      toast.show({ title: 'Nombre requerido', message: 'Ingresa el nombre del nuevo cliente.', variant: 'warning' })
      return
    }
    if (draftLines.length === 0) {
      toast.show({ title: 'SKUs requeridos', message: 'Agrega al menos un SKU con stock.', variant: 'warning' })
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
        })),
        notes: reservationNotes.trim() || null,
      })
      toast.show({
        title: 'Reserva creada',
        message: `Reserva ${created.reservationNumber} creada y stock reservado.`,
        variant: 'success',
      })
      setCreateOpen(false)
      setDraftLines([])
      setCustomerId('')
      setNewCustomerName('')
      setNewCustomerIdType('2')
      setNewCustomerTaxId('')
      setNewCustomerPhone('')
      setNewCustomerEmail('')
      setNewCustomerAddress('')
      setNewCustomerCity('')
      setReservationNotes('')
      setSelected(created)
      await Promise.all([loadReservations(), loadMasterData()])
    } catch (err) {
      toast.show({
        title: 'No se pudo crear la reserva',
        message: readApiError(err, 'Verifica el stock disponible.'),
        variant: 'error',
      })
    } finally {
      setCreating(false)
    }
  }

  const handleAddPayment = async () => {
    if (!tenantId || !selected) return
    const amount = Number(payAmount)
    if (!amount || amount <= 0) {
      toast.show({ title: 'Monto inválido', message: 'Ingresa un aporte mayor a $0.00.', variant: 'warning' })
      return
    }
    setPaying(true)
    try {
      const updated = await addStockReservationPayment(tenantId, selected.id, {
        amount,
        paymentMethod: Number(payMethod) || 2,
        reference: payRef,
        notes: payNotes,
        file: payFile,
      })
      setSelected(updated)
      setPayAmount('')
      setPayRef('')
      setPayNotes('')
      setPayFile(null)
      toast.show({
        title: 'Aporte registrado',
        message: updated.isFullyPaid
          ? 'Pago completado en su totalidad.'
          : `Saldo pendiente: $${updated.balanceAmount.toFixed(2)}`,
        variant: 'success',
      })
      await loadReservations()
    } catch (err) {
      toast.show({
        title: 'Error registrando aporte',
        message: readApiError(err, 'No se pudo guardar el abono.'),
        variant: 'error',
      })
    } finally {
      setPaying(false)
    }
  }

  const handleViewProof = async (paymentId: string) => {
    if (!tenantId || !selected) return
    try {
      const { url } = await getStockReservationPaymentProofUrl(tenantId, selected.id, paymentId)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.show({
        title: 'No se pudo abrir el comprobante',
        message: readApiError(err, 'Error obteniendo enlace.'),
        variant: 'error',
      })
    }
  }

  const handleStartInvoice = () => {
    if (!selected) return
    if (!selected.isFullyPaid) {
      setInvoiceObservation(
        `Reserva ${selected.reservationNumber} facturada con saldo pendiente de $${selected.balanceAmount.toFixed(2)}.`
      )
      setInvoiceObsModalOpen(true)
      return
    }
    navigate(`/facturacion/facturas/emitir?reserva=${encodeURIComponent(selected.id)}`)
  }

  const handleConfirmPartialInvoice = () => {
    if (!selected) return
    if (!invoiceObservation.trim()) {
      toast.show({
        title: 'Observación obligatoria',
        message: 'La reserva tiene saldo pendiente; ingresa una observación para facturar.',
        variant: 'warning',
      })
      return
    }
    setInvoiceObsModalOpen(false)
    navigate(
      `/facturacion/facturas/emitir?reserva=${encodeURIComponent(selected.id)}&obs=${encodeURIComponent(invoiceObservation.trim())}`
    )
  }

  const handleCancelReservation = async () => {
    if (!tenantId || !selected) return
    setCancelling(true)
    try {
      const updated = await cancelStockReservation(tenantId, selected.id, 'Anulada desde admin')
      setSelected(updated)
      toast.show({
        title: 'Reserva anulada',
        message: 'El stock reservado fue liberado en bodega.',
        variant: 'info',
      })
      await loadReservations()
    } catch (err) {
      toast.show({
        title: 'No se pudo anular',
        message: readApiError(err, 'Error anulando reserva.'),
        variant: 'error',
      })
    } finally {
      setCancelling(false)
    }
  }

  const columns: ColumnDef<ReservationRow>[] = useMemo(
    () => [
      { key: 'reservationNumber', header: 'N° Reserva', width: 130 },
      { key: 'customerName', header: 'Cliente', minWidth: 180 },
      { key: 'warehouseName', header: 'Bodega', width: 150 },
      {
        key: 'status',
        header: 'Estado',
        width: 140,
        renderCell: (_v, row) => {
          const meta = statusMeta[row.status] ?? { label: 'Activa', tone: 'info' as const }
          return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
        },
      },
      {
        key: 'totalAmount',
        header: 'Total',
        width: 110,
        renderCell: (_v, row) => `$${row.totalAmount.toFixed(2)}`,
      },
      {
        key: 'paidAmount',
        header: 'Abonado',
        width: 110,
        renderCell: (_v, row) => `$${row.paidAmount.toFixed(2)}`,
      },
      {
        key: 'balanceAmount',
        header: 'Saldo',
        width: 110,
        renderCell: (_v, row) => (
          <span style={{ color: row.balanceAmount > 0 ? 'var(--ecu-warning, #d97706)' : 'inherit', fontWeight: 600 }}>
            ${row.balanceAmount.toFixed(2)}
          </span>
        ),
      },
      {
        key: 'reservedAtUtc',
        header: 'Fecha',
        width: 140,
        renderCell: (_v, row) => formatDate(row.reservedAtUtc),
      },
      {
        key: 'actions',
        header: 'Acciones',
        width: 130,
        sticky: 'right',
        renderCell: (_v, row) => (
          <Button
            size="sm"
            variant="outline"
            iconLeft={<Eye size={14} />}
            onClick={() => setSelected(row)}
          >
            Gestionar
          </Button>
        ),
      },
    ],
    []
  )

  const activeCount = useMemo(
    () => reservations.filter((r) => r.status === 1 || r.status === 2 || r.status === 3).length,
    [reservations]
  )
  const pendingBalanceTotal = useMemo(
    () => reservations.filter((r) => r.status !== 5 && r.status !== 4).reduce((acc, r) => acc + r.balanceAmount, 0),
    [reservations]
  )

  return (
    <TenantSessionGate
      title="Reservas de Stock"
      lead="Aparta SKUs para clientes, registra aportes con comprobante y factura verificando el pago."
    >
      <div className="ecu-dashboard-layout ecu-section-page ecu-dashboard-layout--fluid">
        <PageHeader
          title="Reservas de Stock para Clientes"
          badge={<StatusBadge tone="primary">Ecommerce · Pedidos</StatusBadge>}
          info="Reserva inventario por bodega, registra abonos con comprobante y controla el saldo antes de facturar."
          actions={
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="outline" onClick={() => navigate('/ecommerce/pedidos')}>
                Ver Pedidos
              </Button>
              {canManage && (
                <Button variant="primary" iconLeft={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
                  Crear Reserva
                </Button>
              )}
            </div>
          }
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
          <StatCard label="Total reservas" value={reservations.length} />
          <StatCard label="Reservas activas" value={activeCount} />
          <StatCard label="Saldo por cobrar" value={`$${pendingBalanceTotal.toFixed(2)}`} />
        </div>

        <SectionCard title="Listado de Reservas">
          <DataGrid
            dataSource={reservations}
            columns={columns}
            keyExpr="id"
            loading={loading}
            showSearch
            messages={gridMessages}
          />
        </SectionCard>

        {/* Modal Nueva Reserva */}
        <Popup
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title="Nueva Reserva de Stock"
          width={760}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                size="sm"
                variant={customerMode === 'existing' ? 'primary' : 'outline'}
                onClick={() => setCustomerMode('existing')}
              >
                Seleccionar cliente
              </Button>
              <Button
                size="sm"
                variant={customerMode === 'new' ? 'primary' : 'outline'}
                onClick={() => setCustomerMode('new')}
              >
                Crear cliente nuevo
              </Button>
            </div>

            {customerMode === 'existing' ? (
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
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
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

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end' }}>
              <div style={{ flex: 1 }}>
                <Select
                  label="Agregar SKU con stock disponible"
                  labelPosition="outlined"
                  variant="outline"
                  value={selectedSkuId}
                  onChange={(val) => setSelectedSkuId(val)}
                  options={availableSkuOptions}
                  fullWidth
                />
              </div>
              <Button variant="outline" iconLeft={<Plus size={16} />} onClick={handleAddDraftSku}>
                Agregar SKU
              </Button>
            </div>

            {draftLines.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {draftLines.map((line) => (
                  <div
                    key={line.catalogItemId}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 100px 120px 40px',
                      gap: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <strong>{line.sku}</strong> · {line.name}{' '}
                      <small style={{ opacity: 0.7 }}>(Disp: {line.available})</small>
                    </div>
                    <NumberBox
                      label="Cant."
                      labelPosition="outlined"
                      variant="outline"
                      min={1}
                      max={line.available}
                      value={line.quantity}
                      onChange={(e) =>
                        setDraftLines((prev) =>
                          prev.map((p) =>
                            p.catalogItemId === line.catalogItemId
                              ? { ...p, quantity: Math.max(1, Math.min(line.available, Number(e.target.value) || 1)) }
                              : p
                          )
                        )
                      }
                    />
                    <NumberBox
                      label="Precio ($)"
                      labelPosition="outlined"
                      variant="outline"
                      min={0}
                      step={0.01}
                      value={line.unitPrice}
                      onChange={(e) =>
                        setDraftLines((prev) =>
                          prev.map((p) =>
                            p.catalogItemId === line.catalogItemId
                              ? { ...p, unitPrice: Math.max(0, Number(e.target.value) || 0) }
                              : p
                          )
                        )
                      }
                    />
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        setDraftLines((prev) => prev.filter((p) => p.catalogItemId !== line.catalogItemId))
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <TextBox
              label="Notas (opcional)"
              labelPosition="outlined"
              variant="outline"
              value={reservationNotes}
              onChange={(e) => setReservationNotes(e.target.value)}
              fullWidth
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                iconLeft={<PackageCheck size={16} />}
                disabled={creating}
                onClick={() => void handleCreateReservation()}
              >
                {creating ? 'Reservando...' : 'Confirmar Reserva'}
              </Button>
            </div>
          </div>
        </Popup>

        {/* Modal Gestión de Reserva (Aportes + Facturación) */}
        <Popup
          open={Boolean(selected)}
          onClose={() => setSelected(null)}
          title={selected ? `Reserva ${selected.reservationNumber} · ${selected.customerName}` : ''}
          width={760}
        >
          {selected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                <StatCard label="Total Reserva" value={`$${selected.totalAmount.toFixed(2)}`} />
                <StatCard label="Total Abonado" value={`$${selected.paidAmount.toFixed(2)}`} />
                <StatCard label="Saldo Pendiente" value={`$${selected.balanceAmount.toFixed(2)}`} />
              </div>

              <div>
                <strong>SKUs Reservados ({selected.warehouseName}):</strong>
                <ul style={{ margin: '0.4rem 0', paddingLeft: '1.2rem' }}>
                  {selected.items.map((it) => (
                    <li key={it.id}>
                      {it.sku} · {it.itemName} — Cant: <strong>{it.quantity}</strong> × ${it.unitPrice.toFixed(2)} ={' '}
                      <strong>${it.lineTotal.toFixed(2)}</strong>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <strong>Aportes de Pago ({selected.payments.length}):</strong>
                {selected.payments.length === 0 ? (
                  <p style={{ opacity: 0.7, margin: '0.3rem 0' }}>Sin aportes registrados aún.</p>
                ) : (
                  <ul style={{ margin: '0.4rem 0', paddingLeft: '1.2rem' }}>
                    {selected.payments.map((p) => (
                      <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span>
                          <strong>${p.amount.toFixed(2)}</strong> · {formatDate(p.paidAtUtc)}
                          {p.reference ? ` · Ref: ${p.reference}` : ''}
                        </span>
                        {p.hasProof && (
                          <Button
                            size="sm"
                            variant="outline"
                            iconLeft={<FileText size={12} />}
                            onClick={() => void handleViewProof(p.id)}
                          >
                            Comprobante
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selected.status !== 4 && selected.status !== 5 && canManage && (
                <div
                  style={{
                    border: '1px solid var(--ecu-border, #334155)',
                    borderRadius: '8px',
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <strong>Registrar Aporte / Abono</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.65rem' }}>
                    <NumberBox
                      label="Monto ($)"
                      labelPosition="outlined"
                      variant="outline"
                      min={0.01}
                      step={0.01}
                      value={payAmount ? Number(payAmount) : undefined}
                      onChange={(e) => setPayAmount(e.target.value)}
                      fullWidth
                    />
                    <Select
                      label="Método de pago"
                      labelPosition="outlined"
                      variant="outline"
                      value={payMethod}
                      onChange={(v) => setPayMethod(v)}
                      options={paymentMethodOptions}
                      fullWidth
                    />
                    <TextBox
                      label="Referencia / N° Comprobante"
                      labelPosition="outlined"
                      variant="outline"
                      value={payRef}
                      onChange={(e) => setPayRef(e.target.value)}
                      fullWidth
                    />
                  </div>
                  <TextBox
                    label="Nota del aporte (opcional)"
                    labelPosition="outlined"
                    variant="outline"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    fullWidth
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <Upload size={15} />
                      <span>{payFile ? payFile.name : 'Adjuntar comprobante (JPG, PNG, PDF)'}</span>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf"
                        style={{ display: 'none' }}
                        onChange={(e) => setPayFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    <Button variant="primary" disabled={paying} onClick={() => void handleAddPayment()}>
                      {paying ? 'Guardando...' : 'Agregar Aporte'}
                    </Button>
                  </div>
                </div>
              )}

              {selected.invoiceObservation && (
                <p style={{ margin: 0, color: 'var(--ecu-warning, #d97706)' }}>
                  <strong>Observación de facturación:</strong> {selected.invoiceObservation}
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                {selected.status !== 4 && selected.status !== 5 && canManage ? (
                  <Button
                    variant="danger"
                    iconLeft={<XCircle size={15} />}
                    disabled={cancelling}
                    onClick={() => void handleCancelReservation()}
                  >
                    {cancelling ? 'Anulando...' : 'Anular y Liberar Stock'}
                  </Button>
                ) : <span />}

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {selected.status !== 4 && selected.status !== 5 && canInvoice && (
                    <Button
                      variant="primary"
                      iconLeft={selected.isFullyPaid ? <CheckCircle2 size={15} /> : <Receipt size={15} />}
                      onClick={handleStartInvoice}
                    >
                      {selected.isFullyPaid ? 'Facturar (Pago Completo)' : 'Facturar con Saldo Pendiente'}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setSelected(null)}>
                    Cerrar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Popup>

        {/* Modal Observación cuando el pago no se completó en su totalidad */}
        <Popup
          open={invoiceObsModalOpen}
          onClose={() => setInvoiceObsModalOpen(false)}
          title="Pago Incompleto · Observación Requerida"
          width={520}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <p style={{ margin: 0 }}>
              Esta reserva aún tiene un saldo pendiente de{' '}
              <strong>${selected?.balanceAmount.toFixed(2) ?? '0.00'}</strong>. Para continuar con la facturación,
              deja una observación que quedará registrada en la factura:
            </p>
            <TextBox
              label="Observación de facturación"
              labelPosition="outlined"
              variant="outline"
              value={invoiceObservation}
              onChange={(e) => setInvoiceObservation(e.target.value)}
              fullWidth
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="outline" onClick={() => setInvoiceObsModalOpen(false)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleConfirmPartialInvoice}>
                Continuar a Facturación
              </Button>
            </div>
          </div>
        </Popup>
      </div>
    </TenantSessionGate>
  )
}
