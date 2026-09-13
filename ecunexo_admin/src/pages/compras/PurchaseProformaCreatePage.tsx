import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, TextBox, useToast } from 'glubox'
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  FileText,
  ListPlus,
  Mail,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { PageHeader, SectionCard, StatusBadge } from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { createPurchaseProforma, listSuppliers } from '@/services/purchasesApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type {
  CreatePurchaseProformaItemPayload,
  CreatePurchaseProformaPayload,
  SupplierDto,
} from '@/types/purchasesApi'

interface FormItemLine {
  id: string
  description: string
  quantity: string
  unitPrice: string
  taxRate: string
}

const TAX_RATE_OPTIONS = [
  { value: '15', label: '15% (Tarifa General)' },
  { value: '0', label: '0% (Tarifa Cero)' },
  { value: '5', label: '5% (Materiales Construcción)' },
]

type ProformaMode = 'document' | 'itemized'

export function PurchaseProformaCreatePage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)

  const canManage = useHasPermission('purchases.proformas.manage') || useHasPermission('facturacion.read')

  const [loadingSuppliers, setLoadingSuppliers] = useState(true)
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Header state
  const [supplierId, setSupplierId] = useState('')
  const [proformaNumber, setProformaNumber] = useState('')
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0])
  const [expirationDate, setExpirationDate] = useState('')
  const [notes, setNotes] = useState('')

  // Mode state: 'document' (URL/PDF sin grid forzado) vs 'itemized' (con grid)
  const [mode, setMode] = useState<ProformaMode>('document')

  // Document mode state
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [attachmentFileName, setAttachmentFileName] = useState('')
  const [docSubtotal, setDocSubtotal] = useState('')
  const [docTaxRate, setDocTaxRate] = useState('15')
  const [docTaxAmount, setDocTaxAmount] = useState('')
  const [docTotalAmount, setDocTotalAmount] = useState('')

  // Itemized mode state
  const [items, setItems] = useState<FormItemLine[]>([
    { id: 'item-1', description: '', quantity: '1', unitPrice: '0.00', taxRate: '15' },
  ])

  // Load active suppliers
  useEffect(() => {
    if (!tenantId) return
    let active = true
    setLoadingSuppliers(true)
    listSuppliers(tenantId, { activeOnly: true })
      .then((data) => {
        if (active) {
          setSuppliers(data)
          if (data.length > 0 && !supplierId) {
            setSupplierId(data[0].id)
          }
        }
      })
      .catch((err) => {
        toast.show({
          title: 'Error de proveedores',
          message: readApiError(err, 'No se pudo cargar la lista de proveedores.'),
          variant: 'error',
        })
      })
      .finally(() => {
        if (active) setLoadingSuppliers(false)
      })
    return () => {
      active = false
    }
  }, [tenantId, toast, supplierId])

  // Selected supplier details
  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === supplierId),
    [suppliers, supplierId]
  )

  // Helper to add days to issueDate for expiration shortcuts
  const addDaysToExpiration = useCallback(
    (days: number) => {
      const base = issueDate ? new Date(issueDate) : new Date()
      base.setDate(base.getDate() + days)
      setExpirationDate(base.toISOString().split('T')[0])
    },
    [issueDate]
  )

  // Document mode tax/total automatic calculation
  const handleDocSubtotalChange = (val: string) => {
    setDocSubtotal(val)
    const sub = parseFloat(val)
    if (!Number.isNaN(sub) && sub >= 0) {
      const rate = parseFloat(docTaxRate) / 100.0
      const calculatedTax = Math.round(sub * rate * 100) / 100
      const calculatedTotal = Math.round((sub + calculatedTax) * 100) / 100
      setDocTaxAmount(calculatedTax.toFixed(2))
      setDocTotalAmount(calculatedTotal.toFixed(2))
    }
  }

  const handleDocTaxRateChange = (rateVal: string) => {
    setDocTaxRate(rateVal)
    const sub = parseFloat(docSubtotal)
    if (!Number.isNaN(sub) && sub >= 0) {
      const rate = parseFloat(rateVal) / 100.0
      const calculatedTax = Math.round(sub * rate * 100) / 100
      const calculatedTotal = Math.round((sub + calculatedTax) * 100) / 100
      setDocTaxAmount(calculatedTax.toFixed(2))
      setDocTotalAmount(calculatedTotal.toFixed(2))
    }
  }

  // Itemized calculations
  const totals = useMemo(() => {
    let sub = 0
    let tax = 0
    items.forEach((it) => {
      const q = parseFloat(it.quantity) || 0
      const p = parseFloat(it.unitPrice) || 0
      const r = parseFloat(it.taxRate) || 0
      const lineSub = Math.round(q * p * 100) / 100
      const lineTax = Math.round(lineSub * (r / 100.0) * 100) / 100
      sub += lineSub
      tax += lineTax
    })
    return {
      subtotal: Math.round(sub * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round((sub + tax) * 100) / 100,
    }
  }, [items])

  const addItemLine = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        description: '',
        quantity: '1',
        unitPrice: '0.00',
        taxRate: '15',
      },
    ])
  }

  const removeItemLine = (id: string) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const updateItemLine = (id: string, field: keyof FormItemLine, val: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: val } : it))
    )
  }

  // Submit handler
  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault()
    setFormError(null)

    if (!tenantId) return

    if (!supplierId) {
      setFormError('Debes seleccionar un proveedor de la lista.')
      return
    }

    if (!proformaNumber.trim()) {
      setFormError('El número o código de proforma del proveedor es obligatorio.')
      return
    }

    if (!issueDate) {
      setFormError('La fecha de emisión es obligatoria.')
      return
    }

    if (expirationDate && expirationDate < issueDate) {
      setFormError('La fecha de vencimiento no puede ser anterior a la fecha de emisión.')
      return
    }

    let payload: CreatePurchaseProformaPayload

    if (mode === 'document') {
      if (!attachmentUrl.trim()) {
        setFormError('En modalidad por documento, ingresa el enlace o URL de la cotización (PDF / Imagen / Cloud Storage).')
        return
      }

      const parsedSubtotal = parseFloat(docSubtotal) || 0
      const parsedTax = parseFloat(docTaxAmount) || 0
      const parsedTotal = parseFloat(docTotalAmount) || 0

      if (parsedTotal <= 0 && parsedSubtotal <= 0) {
        setFormError('Ingresa el monto total o subtotal consignado en la proforma.')
        return
      }

      payload = {
        supplierId,
        proformaNumber: proformaNumber.trim(),
        issueDate,
        expirationDate: expirationDate || null,
        notes: notes.trim() || null,
        attachmentUrl: attachmentUrl.trim(),
        attachmentFileName: attachmentFileName.trim() || null,
        subtotal: parsedSubtotal,
        taxAmount: parsedTax,
        totalAmount: parsedTotal > 0 ? parsedTotal : parsedSubtotal + parsedTax,
      }
    } else {
      // Itemized mode
      const validItems: CreatePurchaseProformaItemPayload[] = []
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        const desc = it.description.trim()
        const qty = parseFloat(it.quantity)
        const price = parseFloat(it.unitPrice)
        const rate = parseFloat(it.taxRate)

        if (!desc) {
          setFormError(`El ítem #${i + 1} requiere una descripción.`)
          return
        }
        if (Number.isNaN(qty) || qty <= 0) {
          setFormError(`La cantidad del ítem #${i + 1} debe ser mayor a 0.`)
          return
        }
        if (Number.isNaN(price) || price < 0) {
          setFormError(`El precio del ítem #${i + 1} no puede ser negativo.`)
          return
        }

        validItems.push({
          description: desc,
          quantity: qty,
          unitPrice: price,
          taxRate: Number.isNaN(rate) ? 15 : rate,
        })
      }

      if (validItems.length === 0) {
        setFormError('Debes agregar al menos un ítem cotizado.')
        return
      }

      payload = {
        supplierId,
        proformaNumber: proformaNumber.trim(),
        issueDate,
        expirationDate: expirationDate || null,
        notes: notes.trim() || null,
        attachmentUrl: attachmentUrl.trim() || null,
        attachmentFileName: attachmentFileName.trim() || null,
        items: validItems,
      }
    }

    setSaving(true)
    try {
      await createPurchaseProforma(tenantId, payload)
      toast.show({
        title: 'Proforma registrada',
        message: `La cotización N° ${payload.proformaNumber} ha sido registrada exitosamente.`,
        variant: 'success',
      })
      navigate('/compras/proformas')
    } catch (err) {
      setFormError(readApiError(err, 'No se pudo registrar la proforma de compra.'))
    } finally {
      setSaving(false)
    }
  }

  if (!canManage) {
    return (
      <TenantSessionGate title="Proformas" lead="Gestión de cotizaciones comerciales de compra.">
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres permisos de compras para registrar proformas."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Nueva Proforma de Compra"
      lead="Registra cotizaciones formales de proveedores con fecha de vencimiento y modalidad documental o desglosada."
    >
      <div className="ecu-dashboard-layout" style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <PageHeader
          title="Registrar Proforma / Cotización"
          subtitle="Documento comercial precontractual para comparar ofertas de proveedores antes de formalizar la compra."
          badge={
            <StatusBadge tone="primary" withDot>
              Módulo Compras
            </StatusBadge>
          }
          actions={
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Button
                variant="outline"
                onClick={() => navigate('/compras/proformas')}
                disabled={saving}
              >
                <ArrowLeft size={16} />
                Volver a Proformas
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleSubmit()}
                disabled={saving || loadingSuppliers}
              >
                <Save size={16} />
                {saving ? 'Guardando...' : 'Guardar Cotización'}
              </Button>
            </div>
          }
        />

        {formError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.875rem 1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: 'var(--glb-danger, #ef4444)',
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* SECCIÓN 1: CABECERA COMERCIAL & VIGENCIA */}
          <SectionCard
            title="Datos de la Cotización & Proveedor"
            subtitle="Selecciona el proveedor registrado y fija la fecha límite de vigencia de los precios ofertados."
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div>
                <label className="ecu-form-label" style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
                  Proveedor Oferente *
                </label>
                <Select
                  value={supplierId}
                  options={suppliers.map((s) => ({
                    value: s.id,
                    label: `${s.businessName} (${s.taxId})`,
                  }))}
                  onChange={(val: string) => setSupplierId(val)}
                  variant="outline"
                  size="md"
                  fullWidth
                  disabled={loadingSuppliers || saving}
                />
                {selectedSupplier && (
                  <div style={{ marginTop: '0.375rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--glb-muted, #6b7280)' }}>
                    <Mail size={12} />
                    <span>Correo para notificación: <strong>{selectedSupplier.contactEmail || 'Sin email (se recomienda actualizar)'}</strong></span>
                  </div>
                )}
              </div>

              <div>
                <TextBox
                  label="Número de Proforma / Cotización *"
                  labelPosition="outlined"
                  variant="outline"
                  placeholder="Ej: PROF-2026-0045 o COT-9812"
                  value={proformaNumber}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setProformaNumber(e.target.value)}
                  fullWidth
                  disabled={saving}
                />
              </div>

              <div>
                <TextBox
                  label="Fecha de Emisión *"
                  labelPosition="outlined"
                  type="date"
                  variant="outline"
                  value={issueDate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setIssueDate(e.target.value)}
                  fullWidth
                  disabled={saving}
                />
              </div>

              <div>
                <TextBox
                  label="Fecha de Vencimiento / Vigencia de Precios"
                  labelPosition="outlined"
                  type="date"
                  variant="outline"
                  value={expirationDate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setExpirationDate(e.target.value)}
                  fullWidth
                  disabled={saving}
                />
                <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.375rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #6b7280)' }}>Vigencia:</span>
                  <button
                    type="button"
                    onClick={() => addDaysToExpiration(7)}
                    style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid var(--shell-border, #d1d5db)', background: 'transparent', cursor: 'pointer' }}
                  >
                    +7 días
                  </button>
                  <button
                    type="button"
                    onClick={() => addDaysToExpiration(15)}
                    style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid var(--shell-border, #d1d5db)', background: 'transparent', cursor: 'pointer' }}
                  >
                    +15 días
                  </button>
                  <button
                    type="button"
                    onClick={() => addDaysToExpiration(30)}
                    style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid var(--shell-border, #d1d5db)', background: 'transparent', cursor: 'pointer' }}
                  >
                    +30 días
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* SECCIÓN 2: SELECTOR DE MODALIDAD DE REGISTRO */}
          <SectionCard
            title="Modalidad de Carga de la Cotización"
            subtitle="Elige si registras la cotización por documento/enlace externo (sin desglosar ítems) o detallando cada línea."
          >
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setMode('document')}
                style={{
                  flex: '1 1 250px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.875rem 1rem',
                  borderRadius: '8px',
                  border: mode === 'document' ? '2px solid var(--shell-primary, #4f46e5)' : '1px solid var(--shell-border, #d1d5db)',
                  background: mode === 'document' ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <FileText size={22} color={mode === 'document' ? 'var(--shell-primary, #4f46e5)' : 'currentColor'} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Por Documento / Enlace Externo (PDF)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #6b7280)' }}>
                    Ideal cuando el proveedor envía una proforma firmada. No requiere digitar ítems.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('itemized')}
                style={{
                  flex: '1 1 250px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.875rem 1rem',
                  borderRadius: '8px',
                  border: mode === 'itemized' ? '2px solid var(--shell-primary, #4f46e5)' : '1px solid var(--shell-border, #d1d5db)',
                  background: mode === 'itemized' ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <ListPlus size={22} color={mode === 'itemized' ? 'var(--shell-primary, #4f46e5)' : 'currentColor'} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Desglose Detallado por Ítems</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #6b7280)' }}>
                    Digita cada ítem, cantidad, precio unitario y tarifa de IVA para control granular.
                  </div>
                </div>
              </button>
            </div>

            {/* CASO A: MODALIDAD DOCUMENTO / URL */}
            {mode === 'document' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                  <div>
                    <TextBox
                      label="Enlace / URL de la Cotización (PDF / Imagen / Cloud) *"
                      labelPosition="outlined"
                      variant="outline"
                      placeholder="https://bucket.empresa.com/proformas/cotizacion-0123.pdf"
                      value={attachmentUrl}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setAttachmentUrl(e.target.value)}
                      fullWidth
                      disabled={saving}
                    />
                    {attachmentUrl && (
                      <div style={{ marginTop: '0.25rem' }}>
                        <a
                          href={attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--shell-primary, #4f46e5)' }}
                        >
                          <ExternalLink size={12} />
                          Probar enlace en pestaña nueva
                        </a>
                      </div>
                    )}
                  </div>

                  <div>
                    <TextBox
                      label="Nombre del Archivo Adjunto (Opcional)"
                      labelPosition="outlined"
                      variant="outline"
                      placeholder="Cotizacion_Oficial_Whirlpool_2026.pdf"
                      value={attachmentFileName}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setAttachmentFileName(e.target.value)}
                      fullWidth
                      disabled={saving}
                    />
                  </div>
                </div>

                <div
                  style={{
                    padding: '1rem',
                    border: '1px solid var(--shell-border, #e5e7eb)',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    alignItems: 'end',
                  }}
                >
                  <div>
                    <TextBox
                      label="Subtotal Neto ($ USD) *"
                      labelPosition="outlined"
                      type="number"
                      variant="outline"
                      placeholder="0.00"
                      value={docSubtotal}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleDocSubtotalChange(e.target.value)}
                      fullWidth
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <label className="ecu-form-label" style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
                      Tarifa de IVA Aplicable
                    </label>
                    <Select
                      value={docTaxRate}
                      options={TAX_RATE_OPTIONS}
                      onChange={(val: string) => handleDocTaxRateChange(val)}
                      variant="outline"
                      size="md"
                      fullWidth
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <TextBox
                      label="Monto IVA Calculado ($ USD)"
                      labelPosition="outlined"
                      type="number"
                      variant="outline"
                      placeholder="0.00"
                      value={docTaxAmount}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setDocTaxAmount(e.target.value)}
                      fullWidth
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <TextBox
                      label="Total General ($ USD) *"
                      labelPosition="outlined"
                      type="number"
                      variant="outline"
                      placeholder="0.00"
                      value={docTotalAmount}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setDocTotalAmount(e.target.value)}
                      fullWidth
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* CASO B: MODALIDAD DESGLOSADA POR ÍTEMS */}
            {mode === 'itemized' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                    Líneas Cotizadas ({items.length})
                  </span>
                  <Button variant="outline" size="sm" onClick={addItemLine} disabled={saving}>
                    <Plus size={14} />
                    Agregar Línea
                  </Button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {items.map((it, idx) => {
                    const lineSub = Math.round((parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0) * 100) / 100
                    return (
                      <div
                        key={it.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(200px, 3fr) 90px 110px 170px 100px 40px',
                          gap: '0.5rem',
                          alignItems: 'center',
                          padding: '0.5rem',
                          borderRadius: '6px',
                          border: '1px solid var(--shell-border, #e5e7eb)',
                        }}
                      >
                        <div>
                          <TextBox
                            placeholder={`Descripción del ítem #${idx + 1}`}
                            value={it.description}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              updateItemLine(it.id, 'description', e.target.value)
                            }
                            variant="outline"
                            size="sm"
                            fullWidth
                            disabled={saving}
                          />
                        </div>

                        <div>
                          <TextBox
                            type="number"
                            placeholder="Cant."
                            value={it.quantity}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              updateItemLine(it.id, 'quantity', e.target.value)
                            }
                            variant="outline"
                            size="sm"
                            fullWidth
                            disabled={saving}
                          />
                        </div>

                        <div>
                          <TextBox
                            type="number"
                            placeholder="P. Unit"
                            value={it.unitPrice}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              updateItemLine(it.id, 'unitPrice', e.target.value)
                            }
                            variant="outline"
                            size="sm"
                            fullWidth
                            disabled={saving}
                          />
                        </div>

                        <div>
                          <Select
                            value={it.taxRate}
                            options={TAX_RATE_OPTIONS}
                            onChange={(val: string) => updateItemLine(it.id, 'taxRate', val)}
                            variant="outline"
                            size="sm"
                            fullWidth
                            disabled={saving}
                          />
                        </div>

                        <div style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.875rem' }}>
                          ${lineSub.toFixed(2)}
                        </div>

                        <div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeItemLine(it.id)}
                            disabled={items.length <= 1 || saving}
                            title="Eliminar línea"
                          >
                            <Trash2 size={13} color="var(--glb-danger, #ef4444)" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Resumen Totales */}
                <div
                  style={{
                    alignSelf: 'flex-end',
                    width: '320px',
                    padding: '0.875rem',
                    border: '1px solid var(--shell-border, #e5e7eb)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.375rem',
                    marginTop: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--glb-muted, #6b7280)' }}>Subtotal:</span>
                    <span style={{ fontWeight: 600 }}>${totals.subtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--glb-muted, #6b7280)' }}>IVA Estimado:</span>
                    <span style={{ fontWeight: 600 }}>${totals.tax.toFixed(2)}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      borderTop: '1px solid var(--shell-border, #e5e7eb)',
                      paddingTop: '0.375rem',
                      color: 'var(--shell-primary, #4f46e5)',
                    }}
                  >
                    <span>Total Proforma:</span>
                    <span>${totals.total.toFixed(2)} USD</span>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          {/* SECCIÓN 3: LOGÍSTICA, TÉRMINOS & CONDICIONES */}
          <SectionCard
            title="Términos de Entrega & Observaciones"
            subtitle="Indica tiempos de entrega, forma de pago acordada o notas internas para la autorización de la compra."
          >
            <div>
              <TextBox
                label="Observaciones y Términos Comerciales"
                labelPosition="outlined"
                variant="outline"
                placeholder="Ejemplo: Entrega en bodega matriz Quito en 5 días laborables. Pago 50% anticipo y 50% contra entrega."
                value={notes}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
                fullWidth
                disabled={saving}
              />
            </div>
          </SectionCard>
        </form>
      </div>
    </TenantSessionGate>
  )
}
