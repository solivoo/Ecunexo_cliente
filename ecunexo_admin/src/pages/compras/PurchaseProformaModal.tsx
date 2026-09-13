import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Button, Popup, Select, TextBox } from 'glubox'
import { AlertCircle, Plus, Trash2 } from 'lucide-react'
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

interface PurchaseProformaModalProps {
  open: boolean
  suppliers: SupplierDto[]
  saving: boolean
  onClose: () => void
  onSave: (payload: CreatePurchaseProformaPayload) => Promise<void>
}

const TAX_RATE_OPTIONS = [
  { value: '15', label: '15% (Tarifa General)' },
  { value: '0', label: '0% (Tarifa Cero)' },
  { value: '5', label: '5% (Materiales Construcción)' },
]

export function PurchaseProformaModal({
  open,
  suppliers,
  saving,
  onClose,
  onSave,
}: PurchaseProformaModalProps) {
  const [supplierId, setSupplierId] = useState('')
  const [proformaNumber, setProformaNumber] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [notes, setNotes] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [attachmentFileName, setAttachmentFileName] = useState('')
  const [items, setItems] = useState<FormItemLine[]>([
    { id: 'item-1', description: '', quantity: '1', unitPrice: '0.00', taxRate: '15' },
  ])

  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setFormError(null)
      return
    }

    const today = new Date().toISOString().split('T')[0]
    setSupplierId(suppliers[0]?.id ?? '')
    setProformaNumber('')
    setIssueDate(today)
    setExpirationDate('')
    setNotes('')
    setAttachmentUrl('')
    setAttachmentFileName('')
    setItems([
      { id: 'item-1', description: '', quantity: '1', unitPrice: '0.00', taxRate: '15' },
    ])
    setFormError(null)
  }, [open, suppliers])

  const supplierOptions = useMemo(() => {
    return suppliers
      .filter((s) => s.isActive)
      .map((s) => ({
        value: s.id,
        label: `${s.businessName} (${s.taxId})`,
      }))
  }, [suppliers])

  const addItemLine = useCallback(() => {
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
  }, [])

  const removeItemLine = useCallback((id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev))
  }, [])

  const updateItemLine = useCallback(
    (id: string, field: keyof FormItemLine, val: string) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: val } : item))
      )
    },
    []
  )

  // Live totals calculation
  const totals = useMemo(() => {
    let subtotal = 0
    let tax = 0

    for (const item of items) {
      const q = parseFloat(item.quantity) || 0
      const p = parseFloat(item.unitPrice) || 0
      const r = parseFloat(item.taxRate) || 0
      const lineSubtotal = Math.round(q * p * 100) / 100
      const lineTax = Math.round(lineSubtotal * (r / 100) * 100) / 100
      subtotal += lineSubtotal
      tax += lineTax
    }

    return {
      subtotal,
      tax,
      total: subtotal + tax,
    }
  }, [items])

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      setFormError(null)

      if (!supplierId) {
        setFormError('Debes seleccionar un proveedor.')
        return
      }

      if (!proformaNumber.trim()) {
        setFormError('El número o código de la proforma es obligatorio.')
        return
      }

      if (!issueDate) {
        setFormError('La fecha de emisión es obligatoria.')
        return
      }

      const validItems: CreatePurchaseProformaItemPayload[] = []
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (!it.description.trim()) {
          setFormError(`La descripción del ítem #${i + 1} no puede estar vacía.`)
          return
        }
        const qty = parseFloat(it.quantity)
        if (Number.isNaN(qty) || qty <= 0) {
          setFormError(`La cantidad del ítem #${i + 1} debe ser mayor a 0.`)
          return
        }
        const price = parseFloat(it.unitPrice)
        if (Number.isNaN(price) || price < 0) {
          setFormError(`El precio unitario del ítem #${i + 1} no puede ser negativo.`)
          return
        }
        validItems.push({
          description: it.description.trim(),
          quantity: qty,
          unitPrice: price,
          taxRate: parseFloat(it.taxRate) || 15,
        })
      }

      const payload: CreatePurchaseProformaPayload = {
        supplierId,
        proformaNumber: proformaNumber.trim(),
        issueDate,
        expirationDate: expirationDate || null,
        notes: notes.trim() || null,
        attachmentUrl: attachmentUrl.trim() || null,
        attachmentFileName: attachmentFileName.trim() || null,
        items: validItems,
      }

      try {
        await onSave(payload)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al guardar la proforma.'
        setFormError(msg)
      }
    },
    [
      supplierId,
      proformaNumber,
      issueDate,
      expirationDate,
      notes,
      attachmentUrl,
      attachmentFileName,
      items,
      onSave,
    ]
  )

  return (
    <Popup
      open={open}
      title="Registrar Proforma / Cotización de Compra"
      onClose={onClose}
      width="min(94vw, 52rem)"
      actions={[
        {
          id: 'cancel',
          label: 'Cancelar',
          variant: 'outline',
          onClick: onClose,
          disabled: saving,
        },
        {
          id: 'save',
          label: saving ? 'Guardando...' : 'Crear proforma',
          variant: 'primary',
          onClick: () => void handleSubmit(),
          disabled: saving || !proformaNumber.trim() || !supplierId,
          loading: saving,
        },
      ]}
    >
      <form onSubmit={handleSubmit} className="ecu-customer-form" noValidate>
        {formError ? (
          <div className="ecu-form-error-banner" role="alert">
            <AlertCircle size={16} />
            <span>{formError}</span>
          </div>
        ) : null}

        <div className="ecu-customer-form__grid">
          <div className="ecu-customer-form__field ecu-customer-form__field--span">
            <Select
              id="proforma-supplier"
              label="Proveedor *"
              labelPosition="outlined"
              variant="outline"
              value={supplierId}
              options={supplierOptions}
              onChange={(val: string) => setSupplierId(val)}
              fullWidth
              disabled={saving}
            />
          </div>

          <div className="ecu-customer-form__field">
            <TextBox
              id="proforma-number"
              label="Número de Proforma / Cotización *"
              labelPosition="outlined"
              variant="outline"
              placeholder="Ej. PROF-2026-0045"
              value={proformaNumber}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setProformaNumber(e.target.value)}
              fullWidth
              disabled={saving}
            />
          </div>

          <div className="ecu-customer-form__field">
            <TextBox
              id="proforma-issue-date"
              label="Fecha de Emisión *"
              labelPosition="outlined"
              variant="outline"
              type="date"
              value={issueDate}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setIssueDate(e.target.value)}
              fullWidth
              disabled={saving}
            />
          </div>

          <div className="ecu-customer-form__field">
            <TextBox
              id="proforma-expiration-date"
              label="Válida hasta (Opcional)"
              labelPosition="outlined"
              variant="outline"
              type="date"
              value={expirationDate}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setExpirationDate(e.target.value)}
              fullWidth
              disabled={saving}
            />
          </div>

          <div className="ecu-customer-form__field">
            <TextBox
              id="proforma-attachment-url"
              label="Enlace / URL de Cotización (PDF / Imagen)"
              labelPosition="outlined"
              variant="outline"
              placeholder="https://bucket.com/archivo.pdf"
              value={attachmentUrl}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAttachmentUrl(e.target.value)}
              fullWidth
              disabled={saving}
            />
          </div>

          <div className="ecu-customer-form__field ecu-customer-form__field--span">
            <TextBox
              id="proforma-notes"
              label="Observaciones / Términos de entrega"
              labelPosition="outlined"
              variant="outline"
              placeholder="Entrega en bodega matriz en 5 días laborables..."
              value={notes}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
              fullWidth
              disabled={saving}
            />
          </div>
        </div>

        {/* Dynamic Items Table */}
        <div style={{ marginTop: '1.25rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              Ítems Cotizados ({items.length})
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItemLine}
              disabled={saving}
            >
              <Plus size={14} />
              Agregar Línea
            </Button>
          </div>

          <div
            style={{
              overflowX: 'auto',
              border: '1px solid var(--shell-border, #e5e7eb)',
              borderRadius: '8px',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--glb-surface-variant, #f9fafb)', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Descripción *</th>
                  <th style={{ padding: '0.5rem 0.75rem', width: '90px' }}>Cant.</th>
                  <th style={{ padding: '0.5rem 0.75rem', width: '110px' }}>P. Unit (USD)</th>
                  <th style={{ padding: '0.5rem 0.75rem', width: '120px' }}>IVA</th>
                  <th style={{ padding: '0.5rem 0.75rem', width: '100px', textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '0.5rem', width: '40px' }} />
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const q = parseFloat(item.quantity) || 0
                  const p = parseFloat(item.unitPrice) || 0
                  const r = parseFloat(item.taxRate) || 0
                  const lineTot = Math.round(q * p * (1 + r / 100) * 100) / 100
                  return (
                    <tr
                      key={item.id}
                      style={{ borderTop: '1px solid var(--shell-border, #e5e7eb)' }}
                    >
                      <td style={{ padding: '0.375rem 0.75rem' }}>
                        <input
                          type="text"
                          className="ecu-text-box-input"
                          style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--shell-border, #d1d5db)' }}
                          placeholder={`Ítem #${idx + 1} descripción`}
                          value={item.description}
                          onChange={(e) => updateItemLine(item.id, 'description', e.target.value)}
                          disabled={saving}
                        />
                      </td>
                      <td style={{ padding: '0.375rem 0.75rem' }}>
                        <input
                          type="number"
                          step="any"
                          style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--shell-border, #d1d5db)' }}
                          value={item.quantity}
                          onChange={(e) => updateItemLine(item.id, 'quantity', e.target.value)}
                          disabled={saving}
                        />
                      </td>
                      <td style={{ padding: '0.375rem 0.75rem' }}>
                        <input
                          type="number"
                          step="0.01"
                          style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--shell-border, #d1d5db)' }}
                          value={item.unitPrice}
                          onChange={(e) => updateItemLine(item.id, 'unitPrice', e.target.value)}
                          disabled={saving}
                        />
                      </td>
                      <td style={{ padding: '0.375rem 0.75rem' }}>
                        <select
                          style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--shell-border, #d1d5db)', background: 'transparent' }}
                          value={item.taxRate}
                          onChange={(e) => updateItemLine(item.id, 'taxRate', e.target.value)}
                          disabled={saving}
                        >
                          {TAX_RATE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '0.375rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                        ${lineTot.toFixed(2)}
                      </td>
                      <td style={{ padding: '0.375rem', textAlign: 'center' }}>
                        {items.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeItemLine(item.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--glb-danger, #ef4444)', cursor: 'pointer' }}
                            title="Eliminar línea"
                          >
                            <Trash2 size={15} />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '0.75rem',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ width: '220px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }}>
                <span style={{ color: 'var(--glb-muted, #6b7280)' }}>Subtotal:</span>
                <span style={{ fontWeight: 500 }}>${totals.subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }}>
                <span style={{ color: 'var(--glb-muted, #6b7280)' }}>IVA:</span>
                <span style={{ fontWeight: 500 }}>${totals.tax.toFixed(2)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.35rem 0',
                  borderTop: '1px solid var(--shell-border, #e5e7eb)',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: 'var(--shell-primary, #4f46e5)',
                }}
              >
                <span>Total:</span>
                <span>${totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Popup>
  )
}
