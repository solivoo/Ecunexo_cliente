import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Button, Popup, Select, TextBox } from 'glubox'
import {
  AlertCircle,
  Building2,
  UploadCloud,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui'
import { readApiError } from '@/lib/readApiError'
import { createPurchase, parseSriPurchaseXml } from '@/services/purchasesApi'
import type { CatalogItemListItemDto } from '@/types/catalogApi'
import type { WarehouseListItemDto } from '@/types/inventoryApi'
import type {
  CreatePurchaseItemPayload,
  CreatePurchasePayload,
  ExpenseTypeDto,
  ParseSriPurchaseXmlResponse,
  ParsedLineWithMatchDto,
} from '@/types/purchasesApi'
import '@/pages/repairs/ecu-customer-form.css'

interface ParseXmlModalProps {
  open: boolean
  tenantId: string
  expenseTypes: ExpenseTypeDto[]
  warehouses: WarehouseListItemDto[]
  catalogItems: CatalogItemListItemDto[]
  onClose: () => void
  onSuccess: (purchaseId: string, invoiceNumber: string) => void
}

interface EditableLineItem extends ParsedLineWithMatchDto {
  selectedCatalogItemId: string
  selectedWarehouseId: string
  affectsStock: boolean
}

export function ParseXmlModal({
  open,
  tenantId,
  expenseTypes,
  warehouses,
  catalogItems,
  onClose,
  onSuccess,
}: ParseXmlModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Step state: 'input' or 'preview'
  const [step, setStep] = useState<'input' | 'preview'>('input')
  const [xmlContent, setXmlContent] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Parsed result & editable fields
  const [parsedData, setParsedData] = useState<ParseSriPurchaseXmlResponse | null>(null)
  const [selectedExpenseTypeId, setSelectedExpenseTypeId] = useState<string>('')
  const [sriSustentoCode, setSriSustentoCode] = useState<string>('01')
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<string>('')
  const [lines, setLines] = useState<EditableLineItem[]>([])
  const [notes, setNotes] = useState<string>('')

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setStep('input')
      setXmlContent('')
      setFileName(null)
      setParsing(false)
      setSaving(false)
      setErrorMessage(null)
      setParsedData(null)
      setLines([])
      setNotes('')
      return
    }

    if (expenseTypes.length > 0) {
      setSelectedExpenseTypeId(expenseTypes[0].id)
    }
    if (warehouses.length > 0) {
      setDefaultWarehouseId(warehouses[0].id)
    }
  }, [open, expenseTypes, warehouses])

  const handleFileSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setErrorMessage(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setXmlContent(text)
    }
    reader.onerror = () => {
      setErrorMessage('Error al leer el archivo XML.')
    }
    reader.readAsText(file)
  }

  const handleParse = async () => {
    if (!xmlContent.trim()) {
      setErrorMessage('Por favor carga un archivo XML o pega su contenido.')
      return
    }

    setParsing(true)
    setErrorMessage(null)

    try {
      const result = await parseSriPurchaseXml(tenantId, xmlContent)
      setParsedData(result)

      const initialLines: EditableLineItem[] = result.lines.map((l) => ({
        ...l,
        selectedCatalogItemId: l.matchedCatalogItemId ?? '',
        selectedWarehouseId: defaultWarehouseId,
        affectsStock: l.canAffectInventory ?? true,
      }))
      setLines(initialLines)
      setStep('preview')
    } catch (err) {
      setErrorMessage(
        readApiError(
          err,
          'No se pudo interpretar el archivo XML SRI. Verifica que sea un comprobante electrónico válido.'
        )
      )
    } finally {
      setParsing(false)
    }
  }

  const handleDefaultWarehouseChange = (whId: string) => {
    setDefaultWarehouseId(whId)
    // Update lines that have empty or default warehouse
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        selectedWarehouseId: l.selectedWarehouseId ? l.selectedWarehouseId : whId,
      }))
    )
  }

  const handleLineCatalogItemChange = (index: number, catalogItemId: string) => {
    setLines((prev) => {
      const updated = [...prev]
      const found = catalogItems.find((c) => c.id === catalogItemId)
      updated[index] = {
        ...updated[index],
        selectedCatalogItemId: catalogItemId,
        affectsStock: found ? found.kind === 1 : updated[index].affectsStock,
      }
      return updated
    })
  }

  const handleLineAffectsStockChange = (index: number, affects: boolean) => {
    setLines((prev) => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        affectsStock: affects,
      }
      return updated
    })
  }

  const handleSavePurchase = async () => {
    if (!parsedData) return
    setSaving(true)
    setErrorMessage(null)

    try {
      const itemsPayload: CreatePurchaseItemPayload[] = lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount,
        taxRate: l.taxRate,
        itemCode: l.itemCode,
        catalogItemId: l.selectedCatalogItemId ? l.selectedCatalogItemId : null,
        warehouseId: l.affectsStock && l.selectedWarehouseId ? l.selectedWarehouseId : (defaultWarehouseId || null),
        affectsInventory: l.affectsStock,
      }))

      const payload: CreatePurchasePayload = {
        supplierId: parsedData.supplier.existingSupplierId ?? '',
        invoiceNumber: parsedData.invoiceNumber,
        issueDate: parsedData.issueDate,
        documentType: parsedData.documentType ?? '01',
        authorizationNumber: parsedData.authorizationNumber,
        expenseTypeId: selectedExpenseTypeId || null,
        sriSustentoCode: sriSustentoCode || '01',
        subtotalZero: parsedData.subtotalZero,
        subtotalTaxed: parsedData.subtotalTaxed,
        subtotalNoSubject: parsedData.subtotalNoSubject,
        subtotalExempt: parsedData.subtotalExempt,
        taxRate: parsedData.taxRate,
        taxAmount: parsedData.taxAmount,
        totalDiscount: parsedData.totalDiscount,
        totalAmount: parsedData.totalAmount,
        paymentMethodCode: parsedData.paymentMethodCode,
        creditDays: parsedData.creditDays,
        rawXml: parsedData.rawXml,
        notes: notes.trim() || null,
        items: itemsPayload,
      }

      const res = await createPurchase(tenantId, payload)
      onSuccess(res.purchaseId, res.invoiceNumber)
    } catch (err) {
      setErrorMessage(
        readApiError(err, 'Ocurrió un error al registrar el documento de compra.')
      )
    } finally {
      setSaving(false)
    }
  }

  // Catalog item options for mapping
  const catalogItemOptions = useMemo(() => {
    return [
      { value: '', label: '— Sin vincular a catálogo —' },
      ...catalogItems.map((item) => ({
        value: item.id,
        label: `${item.name} (${item.sku || 'Sin SKU'})`,
      })),
    ]
  }, [catalogItems])

  // Warehouse options
  const warehouseOptions = useMemo(() => {
    return warehouses.map((wh) => ({
      value: wh.id,
      label: `${wh.name} (${wh.code})`,
    }))
  }, [warehouses])

  // Expense type options
  const expenseTypeOptions = useMemo(() => {
    return expenseTypes.map((et) => ({
      value: et.id,
      label: `${et.code} - ${et.name}`,
    }))
  }, [expenseTypes])

  return (
    <Popup
      open={open}
      title={
        step === 'input'
          ? 'Cargar Factura Electrónica SRI (XML)'
          : `Validación de Compra: ${parsedData?.invoiceNumber ?? ''}`
      }
      onClose={onClose}
      width="min(95vw, 68rem)"
      actions={
        step === 'input'
          ? [
              {
                id: 'cancel',
                label: 'Cancelar',
                variant: 'outline',
                onClick: onClose,
                disabled: parsing,
              },
              {
                id: 'parse',
                label: parsing ? 'Procesando XML...' : 'Analizar XML SRI',
                variant: 'primary',
                onClick: () => void handleParse(),
                disabled: parsing || !xmlContent.trim(),
                loading: parsing,
              },
            ]
          : [
              {
                id: 'back',
                label: 'Volver a cargar',
                variant: 'outline',
                onClick: () => {
                  setStep('input')
                  setErrorMessage(null)
                },
                disabled: saving,
              },
              {
                id: 'cancel',
                label: 'Cancelar',
                variant: 'outline',
                onClick: onClose,
                disabled: saving,
              },
              {
                id: 'save',
                label: saving ? 'Registrando...' : 'Registrar Factura de Compra',
                variant: 'primary',
                onClick: () => void handleSavePurchase(),
                disabled: saving,
                loading: saving,
              },
            ]
      }
    >
      <div className="ecu-customer-form" style={{ gap: '1.25rem' }}>
        {errorMessage && (
          <div className="ecu-form-error-banner" role="alert">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {step === 'input' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              style={{
                border: '2px dashed color-mix(in srgb, var(--shell-primary, #4f46e5) 40%, var(--shell-border, rgba(255, 255, 255, 0.15)))',
                borderRadius: '0.75rem',
                padding: '2rem 1.5rem',
                textAlign: 'center',
                backgroundColor: 'color-mix(in srgb, var(--shell-primary, #4f46e5) 5%, transparent)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
                transition: 'all 0.2s ease',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml"
                style={{ display: 'none' }}
                onChange={handleFileSelected}
              />
              <UploadCloud size={36} style={{ color: 'var(--shell-primary, #4f46e5)' }} />
              <div>
                <p style={{ fontWeight: 600, margin: 0, fontSize: '0.95rem', color: 'var(--glb-text, inherit)' }}>
                  {fileName ? `Archivo seleccionado: ${fileName}` : 'Haz clic para seleccionar o arrastra tu archivo XML'}
                </p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--glb-muted, #64748b)' }}>
                  Acepta comprobantes electrónicos SRI (Factura 01) o archivos RIDE autorizados.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm">
                Seleccionar Archivo XML
              </Button>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                  color: 'var(--glb-text, inherit)',
                }}
              >
                O pega el contenido XML directamente:
              </label>
              <textarea
                value={xmlContent}
                onChange={(e) => {
                  setXmlContent(e.target.value)
                  setFileName(null)
                  setErrorMessage(null)
                }}
                rows={7}
                placeholder="Pegar XML aquí (ejemplo: <?xml version='1.0' encoding='UTF-8'?>...)"
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: '0.8125rem',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--shell-border, rgba(255, 255, 255, 0.12))',
                  backgroundColor: 'var(--glb-surface, transparent)',
                  color: 'var(--glb-text, inherit)',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>
        )}

        {step === 'preview' && parsedData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Supplier & Header Card */}
            <div
              style={{
                backgroundColor: 'var(--glb-surface, transparent)',
                border: '1px solid var(--shell-border, rgba(255, 255, 255, 0.08))',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <Building2 size={18} style={{ color: 'var(--shell-primary, #4f46e5)' }} />
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--glb-text, inherit)' }}>
                    {parsedData.supplier.businessName}
                  </span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--glb-muted, #64748b)' }}>
                  RUC: <strong>{parsedData.supplier.taxId}</strong>
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  {parsedData.supplier.isRegistered ? (
                    <StatusBadge tone="success" withDot>
                      Proveedor Registrado
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="warning" withDot>
                      Nuevo Proveedor (se creará automáticamente)
                    </StatusBadge>
                  )}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--glb-muted, #64748b)' }}>
                  Factura N°: <strong style={{ color: 'var(--glb-text, inherit)' }}>{parsedData.invoiceNumber}</strong>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--glb-muted, #64748b)', marginTop: '0.25rem' }}>
                  Fecha Emisión: <strong style={{ color: 'var(--glb-text, inherit)' }}>{parsedData.issueDate}</strong>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #64748b)', marginTop: '0.25rem' }}>
                  Clave de Acceso: <span style={{ fontFamily: 'monospace' }}>{parsedData.authorizationNumber}</span>
                </div>
              </div>
            </div>

            {/* Fiscal & Warehouse Configuration */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
              }}
            >
              {expenseTypeOptions.length > 0 && (
                <Select
                  id="purchase-expense-type"
                  label="Tipo de Gasto SRI (Tabla 5) *"
                  labelPosition="outlined"
                  variant="outline"
                  value={selectedExpenseTypeId}
                  options={expenseTypeOptions}
                  onChange={(val: string) => setSelectedExpenseTypeId(val)}
                  fullWidth
                />
              )}

              {warehouseOptions.length > 0 && (
                <Select
                  id="purchase-default-warehouse"
                  label="Bodega Predeterminada *"
                  labelPosition="outlined"
                  variant="outline"
                  value={defaultWarehouseId}
                  options={warehouseOptions}
                  onChange={handleDefaultWarehouseChange}
                  fullWidth
                />
              )}

              <TextBox
                id="purchase-sri-sustento"
                label="Código Sustento SRI"
                labelPosition="outlined"
                variant="outline"
                value={sriSustentoCode}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSriSustentoCode(e.target.value)}
                placeholder="01"
                fullWidth
              />
            </div>

            {/* Lines Table */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  Detalle de Ítems ({lines.length}) & Homologación de Catálogo
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #64748b)' }}>
                  Asigna los ítems a tu catálogo para registrar stock en bodega
                </span>
              </div>

              <div
                style={{
                  border: '1px solid var(--shell-border, rgba(255, 255, 255, 0.08))',
                  borderRadius: '0.5rem',
                  overflowX: 'auto',
                  maxHeight: '260px',
                  backgroundColor: 'var(--glb-surface, transparent)',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: 'var(--glb-surface-hover, rgba(255, 255, 255, 0.04))',
                        borderBottom: '1px solid var(--shell-border, rgba(255, 255, 255, 0.08))',
                        textAlign: 'left',
                      }}
                    >
                      <th style={{ padding: '0.5rem 0.75rem' }}>Cód.</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Descripción SRI</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Cant.</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>P. Unit.</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Total</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Homologación Catálogo</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr
                        key={`line-${idx}`}
                        style={{
                          borderBottom: '1px solid var(--shell-border, rgba(255, 255, 255, 0.06))',
                        }}
                      >
                        <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {line.itemCode || '—'}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>
                          {line.description}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                          {line.quantity}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                          ${line.unitPrice.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                          ${line.total.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', minWidth: '220px' }}>
                          <select
                            value={line.selectedCatalogItemId}
                            onChange={(e) => handleLineCatalogItemChange(idx, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.35rem 0.5rem',
                              borderRadius: '0.375rem',
                              border: '1px solid var(--shell-border, rgba(255, 255, 255, 0.12))',
                              fontSize: '0.75rem',
                              backgroundColor: 'var(--glb-surface, transparent)',
                              color: 'var(--glb-text, inherit)',
                            }}
                          >
                            {catalogItemOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={line.affectsStock}
                            onChange={(e) => handleLineAffectsStockChange(idx, e.target.checked)}
                            title="Afecta inventario físico en bodega"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals Summary */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginTop: '0.5rem',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: '240px' }}>
                <TextBox
                  value={notes}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
                  placeholder="Notas u observaciones de compra (opcional)..."
                  variant="outline"
                  fullWidth
                />
              </div>

              <div
                style={{
                  width: '320px',
                  backgroundColor: 'rgba(248, 250, 252, 0.8)',
                  border: '1px solid var(--shell-border, #e2e8f0)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1rem',
                  fontSize: '0.8125rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--glb-muted, #64748b)' }}>Subtotal 0%:</span>
                  <span>${parsedData.subtotalZero.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--glb-muted, #64748b)' }}>Subtotal Grabado ({parsedData.taxRate}%):</span>
                  <span>${parsedData.subtotalTaxed.toFixed(2)}</span>
                </div>
                {parsedData.totalDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--glb-muted, #64748b)' }}>Descuento:</span>
                    <span>-${parsedData.totalDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--glb-muted, #64748b)' }}>IVA:</span>
                  <span>${parsedData.taxAmount.toFixed(2)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingTop: '0.35rem',
                    borderTop: '1px solid var(--shell-border, #cbd5e1)',
                    fontWeight: 700,
                    fontSize: '0.9375rem',
                    color: 'var(--shell-primary, #4f46e5)',
                  }}
                >
                  <span>Total Factura:</span>
                  <span>${parsedData.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Popup>
  )
}
