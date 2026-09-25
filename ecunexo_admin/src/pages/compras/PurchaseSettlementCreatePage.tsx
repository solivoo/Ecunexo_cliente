import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, TextBox, useToast } from 'glubox'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Plus,
  Receipt,
  Save,
  Trash2,
  UserX,
} from 'lucide-react'
import { PageHeader, SectionCard, StatusBadge } from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import {
  createPurchaseSettlement,
  listExpenseTypes,
  listSuppliers,
} from '@/services/purchasesApi'
import { getTenant } from '@/services/tenantApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { ExpenseTypeDto, SupplierDto } from '@/types/purchasesApi'
import type { GetTenantByIdDto } from '@/types/tenantApi'
import '@/pages/repairs/ecu-customer-form.css'

interface SettlementItemLine {
  id: string
  description: string
  quantity: string
  unitPrice: string
  discount: string
  taxRate: string
}

const TAX_RATES = [
  { value: '15', label: '15% (Tarifa General)' },
  { value: '0', label: '0% (Tarifa Cero)' },
  { value: '5', label: '5% (Materiales Construcción)' },
]

const SRI_SUSTENTO_OPTIONS = [
  { value: '01', label: '01 - Crédito Tributario para declaración de IVA' },
  { value: '02', label: '02 - Costo o Gasto para declaración de IR' },
  { value: '06', label: '06 - Inventario / Activo Fijo' },
  { value: '07', label: '07 - Gastos de viaje o movilización' },
]

const PAYMENT_METHODS = [
  { value: '01', label: '01 - Sin utilización del sistema financiero (Efectivo)' },
  { value: '20', label: '20 - Otros con utilización del sistema financiero (Transferencia)' },
]

const RETENTION_IR_OPTIONS = [
  { value: '0', label: '0% - Sin retención IR' },
  { value: '1', label: '1% - Adquisición de bienes / insumos agrícolas' },
  { value: '1.75', label: '1.75% - Transferencia de bienes corporales' },
  { value: '2', label: '2% - Servicios donde predomina la mano de obra' },
  { value: '8', label: '8% - Servicios profesionales / comisiones' },
  { value: '10', label: '10% - Honorarios profesionales con título' },
]

export function PurchaseSettlementCreatePage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)

  const canIssue =
    useHasPermission('facturacion.liquidacion.compra.issue') ||
    useHasPermission('purchases.documents.manage') ||
    useHasPermission('purchases.manage')

  const [tenant, setTenant] = useState<GetTenantByIdDto | null>(null)
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([])
  const [expenseTypes, setExpenseTypes] = useState<ExpenseTypeDto[]>([])
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Form Header State
  const [supplierId, setSupplierId] = useState('')
  const [sequential, setSequential] = useState('000000001')
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0])
  const [sriSustentoCode, setSriSustentoCode] = useState('01')
  const [expenseTypeId, setExpenseTypeId] = useState('')
  const [paymentMethodCode, setPaymentMethodCode] = useState('01')
  const [notes, setNotes] = useState('')

  // Retention State
  const [retentionIrRate, setRetentionIrRate] = useState('2') // Default 2% mano de obra para liquidaciones

  // Items State
  const [items, setItems] = useState<SettlementItemLine[]>([
    {
      id: 'item-1',
      description: '',
      quantity: '1',
      unitPrice: '0.00',
      discount: '0.00',
      taxRate: '15',
    },
  ])

  // Load Initial Data
  useEffect(() => {
    if (!tenantId) return
    let active = true
    setLoadingInitial(true)

    Promise.all([
      getTenant(tenantId).catch(() => null),
      listSuppliers(tenantId, { activeOnly: true }).catch(() => []),
      listExpenseTypes(tenantId, true).catch(() => []),
    ])
      .then(([tenantData, suppliersData, expensesData]) => {
        if (!active) return
        if (tenantData) setTenant(tenantData)
        if (suppliersData) {
          setSuppliers(suppliersData)
          // Seleccionar por defecto el primer proveedor sin RUC si existe
          const nonRucSupplier = suppliersData.find(
            (s) => s.taxId.trim().length !== 13 || !s.taxId.trim().endsWith('001')
          )
          if (nonRucSupplier) {
            setSupplierId(nonRucSupplier.id)
          } else if (suppliersData.length > 0) {
            setSupplierId(suppliersData[0].id)
          }
        }
        if (expensesData) setExpenseTypes(expensesData)
      })
      .finally(() => {
        if (active) setLoadingInitial(false)
      })

    return () => {
      active = false
    }
  }, [tenantId])

  // Emisor prefix: 001-001
  const seriesPrefix = useMemo(() => {
    const est = tenant?.establishmentCode || '001'
    return `${est}-001`
  }, [tenant?.establishmentCode])

  const fullInvoiceNumber = useMemo(() => {
    const padded = sequential.padStart(9, '0').slice(-9)
    return `${seriesPrefix}-${padded}`
  }, [seriesPrefix, sequential])

  // Proveedor seleccionado
  const selectedSupplier = useMemo(() => {
    return suppliers.find((s) => s.id === supplierId)
  }, [suppliers, supplierId])

  // Invariante Art. 48 RCVR: ¿Tiene RUC activo?
  const isSupplierRuc = useMemo(() => {
    if (!selectedSupplier) return false
    const id = selectedSupplier.taxId.trim()
    return id.length === 13 && id.endsWith('001')
  }, [selectedSupplier])

  // Líneas y Totales Calculados
  const calculatedTotals = useMemo(() => {
    let subtotalZero = 0
    let subtotalTaxed = 0
    let totalDiscount = 0
    let totalTaxAmount = 0

    items.forEach((item) => {
      const qty = Math.max(0, parseFloat(item.quantity) || 0)
      const price = Math.max(0, parseFloat(item.unitPrice) || 0)
      const disc = Math.max(0, parseFloat(item.discount) || 0)
      const lineSubtotal = Math.max(0, qty * price - disc)
      const rate = parseFloat(item.taxRate) || 0

      totalDiscount += disc

      if (rate === 0) {
        subtotalZero += lineSubtotal
      } else {
        subtotalTaxed += lineSubtotal
        totalTaxAmount += lineSubtotal * (rate / 100)
      }
    })

    const grossTotal = subtotalZero + subtotalTaxed + totalTaxAmount

    // Retenciones SRI Liquidación: 100% de IVA retenido
    const withheldIva = totalTaxAmount * 1.0

    // Retención IR sobre base imponible
    const irRate = parseFloat(retentionIrRate) || 0
    const taxableBaseForIr = subtotalZero + subtotalTaxed
    const withheldIr = taxableBaseForIr * (irRate / 100)

    // Neto a desembolsar al sujeto pasivo
    const netToPay = Math.max(0, grossTotal - withheldIva - withheldIr)

    return {
      subtotalZero,
      subtotalTaxed,
      totalDiscount,
      totalTaxAmount,
      grossTotal,
      withheldIva,
      withheldIr,
      netToPay,
    }
  }, [items, retentionIrRate])

  // Modificar línea
  const handleItemChange = useCallback(
    (id: string, field: keyof SettlementItemLine, value: string) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
      )
    },
    []
  )

  // Agregar línea
  const handleAddItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        description: '',
        quantity: '1',
        unitPrice: '0.00',
        discount: '0.00',
        taxRate: '15',
      },
    ])
  }, [])

  // Eliminar línea
  const handleRemoveItem = useCallback((id: string) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((item) => item.id !== id)
    })
  }, [])

  // Enviar y emitir
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!tenantId) return

    if (!supplierId) {
      setFormError('Debe seleccionar un proveedor o sujeto pasivo emisor del bien/servicio.')
      return
    }

    if (isSupplierRuc) {
      setFormError(
        'Incompatibilidad legal Art. 48 RCVR: No se puede emitir una liquidación de compra a un proveedor con RUC activo.'
      )
      return
    }

    if (!sequential.trim()) {
      setFormError('Ingrese el secuencial de la liquidación de compra.')
      return
    }

    const invalidLine = items.find(
      (it) => !it.description.trim() || (parseFloat(it.quantity) || 0) <= 0
    )
    if (invalidLine) {
      setFormError('Todas las líneas deben tener una descripción válida y una cantidad mayor a cero.')
      return
    }

    if (calculatedTotals.grossTotal <= 0) {
      setFormError('El monto total de la liquidación debe ser superior a $0.00.')
      return
    }

    setSaving(true)
    try {
      const payloadLines = items.map((it) => {
        const qty = parseFloat(it.quantity) || 1
        const price = parseFloat(it.unitPrice) || 0
        const disc = parseFloat(it.discount) || 0
        const rate = parseFloat(it.taxRate) || 0
        return {
          description: it.description.trim(),
          quantity: qty,
          unitPrice: price,
          discount: disc,
          taxRate: rate,
          affectsInventory: false,
        }
      })

      const payload = {
        supplierId,
        invoiceNumber: fullInvoiceNumber,
        issueDate,
        documentType: '03',
        expenseTypeId: expenseTypeId || null,
        sriSustentoCode,
        subtotalZero: calculatedTotals.subtotalZero,
        subtotalTaxed: calculatedTotals.subtotalTaxed,
        taxRate: 15,
        taxAmount: calculatedTotals.totalTaxAmount,
        totalDiscount: calculatedTotals.totalDiscount,
        totalAmount: calculatedTotals.grossTotal,
        paymentMethodCode,
        notes: notes.trim() ? `${notes.trim()} | Ret. IVA 100%: $${calculatedTotals.withheldIva.toFixed(2)} | Ret. IR ${retentionIrRate}%: $${calculatedTotals.withheldIr.toFixed(2)} | Neto pagado: $${calculatedTotals.netToPay.toFixed(2)}` : `Ret. IVA 100%: $${calculatedTotals.withheldIva.toFixed(2)} | Ret. IR ${retentionIrRate}%: $${calculatedTotals.withheldIr.toFixed(2)} | Neto pagado: $${calculatedTotals.netToPay.toFixed(2)}`,
        items: payloadLines,
      }

      const res = await createPurchaseSettlement(tenantId, payload)

      toast.show({
        title: 'Liquidación Registrada',
        message: `Liquidación SRI Tipo 03 ${res.invoiceNumber} registrada exitosamente.`,
        variant: 'success',
      })

      navigate('/compras/liquidaciones')
    } catch (err) {
      const msg = readApiError(err, 'No se pudo registrar la liquidación de compra.')
      setFormError(msg)
      toast.show({
        title: 'Error al emitir liquidación',
        message: msg,
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  if (!canIssue) {
    return (
      <TenantSessionGate title="Nueva Liquidación de Compra" lead="Emisión de comprobante SRI Tipo 03.">
        <div className="ecu-dashboard-layout ecu-section-page ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="No cuentas con permisos suficientes para emitir liquidaciones de compra."
            badge={<StatusBadge tone="danger">Sin Permiso</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Nueva Liquidación de Compra"
      lead="Emisión de liquidaciones de compra de bienes y servicios (SRI Tipo 03) conforme al Art. 48 RCVR."
    >
      <div className="ecu-dashboard-layout ecu-section-page ecu-section-page">
        <PageHeader
          title="Nueva Liquidación de Compra"
          subtitle="Comprobante fiscal emitido por el comprador a personas naturales no obligadas a tener RUC (mano de obra ocasional, artesanos, productores agrícolas)."
          badge={
            <StatusBadge tone="primary" withDot>
              SRI Tipo 03
            </StatusBadge>
          }
          actions={
            <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate('/compras/liquidaciones')}
                disabled={saving}
              >
                <ArrowLeft size={16} />
                Volver
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSubmit}
                disabled={saving || isSupplierRuc || calculatedTotals.grossTotal <= 0}
              >
                <Save size={16} />
                {saving ? 'Registrando...' : 'Emitir Liquidación'}
              </Button>
            </div>
          }
        />

        {formError && (
          <div
            style={{
              padding: '0.875rem 1.25rem',
              borderRadius: '0.625rem',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{formError}</span>
          </div>
        )}

        {/* Banner Informativo SRI */}
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid color-mix(in srgb, var(--shell-primary, #4f46e5) 25%, var(--shell-border, rgba(255, 255, 255, 0.1)))',
            backgroundColor: 'color-mix(in srgb, var(--shell-primary, #4f46e5) 4%, var(--glb-surface, transparent))',
            fontSize: '0.8125rem',
            color: 'var(--glb-text, inherit)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <Receipt size={18} style={{ color: 'var(--shell-primary, #4f46e5)', flexShrink: 0 }} />
          <div>
            <strong>Emisor Fiscal Autorizado:</strong> Serie autorizada:{' '}
            <strong>{seriesPrefix}</strong> · Clave de acceso Módulo 11 generada automáticamente por EcuNexo.
            La empresa retendrá el <strong>100% del IVA generado</strong> y el porcentaje de Impuesto a la Renta seleccionado.
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* SECCIÓN 1: SUJETO PASIVO / PROVEEDOR */}
          <SectionCard
            title="1. Sujeto Pasivo / Proveedor (Art. 48 RCVR)"
            subtitle="Identificación de la persona natural sin RUC que transfiere el bien o presta el servicio"
          >
            <div className="ecu-customer-form__grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <Select
                  label="Proveedor / Sujeto Pasivo"
                  labelPosition="outlined"
                  variant="outline"
                  placeholder="Selecciona el proveedor..."
                  value={supplierId}
                  disabled={loadingInitial || suppliers.length === 0}
                  options={suppliers.map((s) => ({
                    value: s.id,
                    label: `${s.businessName} (${s.taxId}) - ${s.identificationType === 2 ? 'Cédula' : s.identificationType === 3 ? 'Pasaporte' : 'RUC'}`,
                  }))}
                  onChange={(val) => setSupplierId(val || '')}
                />
              </div>

              <div>
                <TextBox
                  label="Número de Liquidación"
                  labelPosition="outlined"
                  variant="outline"
                  value={fullInvoiceNumber}
                  readOnly
                />
                <span className="ecu-customer-form__hint">Prefijo serie: {seriesPrefix}</span>
              </div>

              <div>
                <TextBox
                  label="Secuencial (9 dígitos)"
                  labelPosition="outlined"
                  variant="outline"
                  value={sequential}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSequential(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="000000001"
                />
              </div>

              <div>
                <TextBox
                  label="Fecha de Emisión"
                  labelPosition="outlined"
                  variant="outline"
                  type="date"
                  value={issueDate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setIssueDate(e.target.value)}
                />
              </div>

              <div>
                <Select
                  label="Sustento Tributario SRI"
                  labelPosition="outlined"
                  variant="outline"
                  value={sriSustentoCode}
                  options={SRI_SUSTENTO_OPTIONS}
                  onChange={(val) => setSriSustentoCode(val || '01')}
                />
              </div>

              <div>
                <Select
                  label="Tipo de Gasto / Clasificación SRI"
                  labelPosition="outlined"
                  variant="outline"
                  placeholder="Seleccione tipo de gasto (opcional)"
                  value={expenseTypeId}
                  options={[
                    { value: '', label: 'Ninguno / Sin clasificar' },
                    ...expenseTypes.map((et) => ({
                      value: et.id,
                      label: `${et.code} - ${et.name}`,
                    })),
                  ]}
                  onChange={(val) => setExpenseTypeId(val || '')}
                />
              </div>

              <div>
                <Select
                  label="Forma de Pago"
                  labelPosition="outlined"
                  variant="outline"
                  value={paymentMethodCode}
                  options={PAYMENT_METHODS}
                  onChange={(val) => setPaymentMethodCode(val || '01')}
                />
              </div>
            </div>

            {/* VALIDACIÓN PREVENTIVA ART. 48 RCVR */}
            {selectedSupplier && (
              <div style={{ marginTop: '1rem' }}>
                {isSupplierRuc ? (
                  <div
                    style={{
                      padding: '0.875rem 1rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                    }}
                  >
                    <UserX size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <strong>Incompatibilidad Legal - Art. 48 RCVR:</strong>
                      <p style={{ margin: '0.25rem 0 0 0' }}>
                        El proveedor seleccionado <strong>{selectedSupplier.businessName}</strong> posee un RUC activo ({selectedSupplier.taxId}).
                        Por disposición del SRI, las Liquidaciones de Compra (Tipo 03) únicamente pueden emitirse a personas naturales no obligadas a tener RUC o extranjeros no residentes.
                        Para este proveedor debe registrar una <strong>Factura (Tipo 01)</strong> en Compras &rarr; Facturas de Compra.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#10b981',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                    }}
                  >
                    <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                    <div>
                      <strong>Proveedor habilitado para Liquidación Tipo 03:</strong> Sujeto pasivo sin RUC ({selectedSupplier.taxId}) conforme a normativa SRI.
                    </div>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {/* SECCIÓN 2: LÍNEAS DEL COMPROBANTE */}
          <SectionCard
            title="2. Detalle de Bienes y Prestación de Servicios"
            subtitle="Desglose de los productos o servicios recibidos del sujeto pasivo"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(200px, 3fr) 100px 120px 100px 160px 100px 48px',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: 'var(--glb-muted, #64748b)',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid var(--shell-border, rgba(255, 255, 255, 0.1))',
                }}
              >
                <div>Descripción</div>
                <div>Cantidad</div>
                <div>Precio Unit.</div>
                <div>Descuento</div>
                <div>Tarifa IVA</div>
                <div style={{ textAlign: 'right' }}>Subtotal</div>
                <div></div>
              </div>

              {items.map((line) => {
                const qty = Math.max(0, parseFloat(line.quantity) || 0)
                const price = Math.max(0, parseFloat(line.unitPrice) || 0)
                const disc = Math.max(0, parseFloat(line.discount) || 0)
                const sub = Math.max(0, qty * price - disc)

                return (
                  <div
                    key={line.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(200px, 3fr) 100px 120px 100px 160px 100px 48px',
                      gap: '0.5rem',
                      alignItems: 'center',
                      padding: '0.25rem 0',
                    }}
                  >
                    <div>
                      <TextBox
                        variant="outline"
                        placeholder="Ej. Servicio de albañilería / cosecha..."
                        value={line.description}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleItemChange(line.id, 'description', e.target.value)}
                      />
                    </div>
                    <div>
                      <TextBox
                        variant="outline"
                        type="number"
                        min="1"
                        step="1"
                        value={line.quantity}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleItemChange(line.id, 'quantity', e.target.value)}
                      />
                    </div>
                    <div>
                      <TextBox
                        variant="outline"
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleItemChange(line.id, 'unitPrice', e.target.value)}
                      />
                    </div>
                    <div>
                      <TextBox
                        variant="outline"
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.discount}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleItemChange(line.id, 'discount', e.target.value)}
                      />
                    </div>
                    <div>
                      <Select
                        variant="outline"
                        value={line.taxRate}
                        options={TAX_RATES}
                        onChange={(val) => handleItemChange(line.id, 'taxRate', val || '15')}
                      />
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.9rem' }}>
                      ${sub.toFixed(2)}
                    </div>
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={items.length <= 1}
                        onClick={() => handleRemoveItem(line.id)}
                        aria-label="Eliminar fila"
                      >
                        <Trash2 size={16} style={{ color: items.length > 1 ? '#ef4444' : 'var(--glb-muted)' }} />
                      </Button>
                    </div>
                  </div>
                )
              })}

              <div>
                <Button variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus size={15} />
                  Agregar Línea
                </Button>
              </div>
            </div>
          </SectionCard>

          {/* SECCIÓN 3: LIQUIDACIÓN ECONÓMICA Y RETENCIONES OBLIGATORIAS */}
          <SectionCard
            title="3. Liquidación Económica & Retención SRI Obligatoria"
            subtitle="Cálculo de retención del 100% de IVA y porcentaje aplicable de Impuesto a la Renta"
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              <div>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: 600 }}>
                  Retenciones en la Fuente Aplicables
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'color-mix(in srgb, var(--shell-primary, #4f46e5) 8%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--shell-primary, #4f46e5) 20%, transparent)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Retención de IVA (Art. 48 RCVR):</span>
                      <StatusBadge tone="primary">100% IVA</StatusBadge>
                    </div>
                    <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: 'var(--glb-muted, #64748b)' }}>
                      El emisor de la liquidación retiene por ley el 100% del IVA causado: <strong>${calculatedTotals.withheldIva.toFixed(2)}</strong>
                    </p>
                  </div>

                  <div>
                    <Select
                      label="Retención Impuesto a la Renta (AIR)"
                      labelPosition="outlined"
                      variant="outline"
                      value={retentionIrRate}
                      options={RETENTION_IR_OPTIONS}
                      onChange={(val) => setRetentionIrRate(val || '2')}
                    />
                    <span className="ecu-customer-form__hint">
                      Monto retenido IR ({retentionIrRate}%): ${calculatedTotals.withheldIr.toFixed(2)}
                    </span>
                  </div>

                  <div>
                    <TextBox
                      label="Notas u Observaciones"
                      labelPosition="outlined"
                      variant="outline"
                      placeholder="Detalles sobre el servicio prestado, lugar de entrega, etc."
                      value={notes}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Resumen de Liquidación */}
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--shell-border, rgba(255, 255, 255, 0.1))',
                  backgroundColor: 'var(--glb-surface, rgba(255, 255, 255, 0.02))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 600, borderBottom: '1px solid var(--shell-border, rgba(255, 255, 255, 0.1))', paddingBottom: '0.5rem' }}>
                  Resumen de Liquidación
                </h4>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--glb-muted)' }}>Subtotal 0%:</span>
                  <span>${calculatedTotals.subtotalZero.toFixed(2)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--glb-muted)' }}>Subtotal Gravado (15%):</span>
                  <span>${calculatedTotals.subtotalTaxed.toFixed(2)}</span>
                </div>

                {calculatedTotals.totalDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#10b981' }}>
                    <span>Descuento:</span>
                    <span>-${calculatedTotals.totalDiscount.toFixed(2)}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--glb-muted)' }}>IVA Causado (15%):</span>
                  <span>+${calculatedTotals.totalTaxAmount.toFixed(2)}</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    borderTop: '1px dashed var(--shell-border, rgba(255, 255, 255, 0.1))',
                    paddingTop: '0.5rem',
                    marginTop: '0.25rem',
                  }}
                >
                  <span>Total Bruto Comprobante:</span>
                  <span>${calculatedTotals.grossTotal.toFixed(2)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#ef4444', marginTop: '0.25rem' }}>
                  <span>(-) Retención 100% IVA:</span>
                  <span>-${calculatedTotals.withheldIva.toFixed(2)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#ef4444' }}>
                  <span>(-) Retención {retentionIrRate}% IR:</span>
                  <span>-${calculatedTotals.withheldIr.toFixed(2)}</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 700,
                    fontSize: '1.1rem',
                    borderTop: '2px solid var(--shell-border, rgba(255, 255, 255, 0.2))',
                    paddingTop: '0.75rem',
                    marginTop: '0.5rem',
                    color: 'var(--shell-primary, #4f46e5)',
                  }}
                >
                  <span>Neto a Desembolsar:</span>
                  <span>${calculatedTotals.netToPay.toFixed(2)}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted)', textAlign: 'right' }}>
                  Monto efectivo pagado al proveedor
                </div>
              </div>
            </div>
          </SectionCard>
        </form>
      </div>
    </TenantSessionGate>
  )
}

export default PurchaseSettlementCreatePage
