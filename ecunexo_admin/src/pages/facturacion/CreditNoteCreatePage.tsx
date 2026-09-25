import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, TextBox, useToast } from 'glubox'
import { EmptyState, PageHeader, SectionCard, StatusBadge } from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { formatMoney } from '@/pages/facturacion/invoiceFormTypes'
import { useBillingInvoices } from '@/pages/facturacion/useBillingInvoices'
import {
  createCreditNote,
  getInvoiceDetail,
  listInvoices,
  signInvoice,
  pollInvoiceAuthorization,
} from '@/services/billingApi'
import type { CreateInvoiceLineBody, InvoiceDetail, InvoiceListItem } from '@/types/billingApi'

type ReturnLineItem = {
  readonly lineNumber: number
  readonly mainCode?: string | null
  readonly description: string
  readonly originalQty: number
  returnQty: number
  readonly unitPrice: number
  readonly discount: number
  selected: boolean
  readonly taxes: readonly {
    taxCode: string
    rateCode: string
    rate: number
    taxableBase: number
    value: number
  }[]
}

const MOTIVO_PRESETS = [
  { value: 'Devolución total de mercadería', label: 'Devolución total de mercadería' },
  { value: 'Devolución parcial de productos', label: 'Devolución parcial de productos' },
  { value: 'Descuento o bonificación posterior', label: 'Descuento o bonificación posterior' },
  { value: 'Rescisión de contrato o servicio', label: 'Rescisión de contrato o servicio' },
  { value: 'Corrección de precio o valor factual', label: 'Corrección de precio o valor factual' },
]

export function CreditNoteCreatePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { emitterId, tenantId } = useBillingInvoices({ from: '2020-01-01', to: '2030-12-31' })

  const canCreate =
    useHasPermission('facturacion.notas.credito.create') ||
    useHasPermission('facturacion.read')

  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [authorizedInvoices, setAuthorizedInvoices] = useState<InvoiceListItem[]>([])
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('')
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [invoiceDetail, setInvoiceDetail] = useState<InvoiceDetail | null>(null)

  const [issueDate, setIssueDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [motivoPreset, setMotivoPreset] = useState<string>('Devolución total de mercadería')
  const [motivoDetails, setMotivoDetails] = useState<string>('Devolución de mercadería')
  const [lines, setLines] = useState<ReturnLineItem[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Cargar facturas autorizadas para el selector
  const loadAuthorizedInvoices = useCallback(async () => {
    if (!emitterId) return
    setLoadingInvoices(true)
    try {
      const res = await listInvoices(emitterId, {
        state: 'Authorized',
        page: 1,
        pageSize: 200,
      })
      // Solo facturas tipo '01' que no estén anuladas
      const filtered = res.items.filter(
        (i) => i.documentType === '01' && !i.isVoided && i.canVoid
      )
      setAuthorizedInvoices(filtered)
    } catch (err) {
      toast.show({
        title: 'Error',
        message: readApiError(err, 'Error al cargar facturas autorizadas.'),
        variant: 'error',
      })
    } finally {
      setLoadingInvoices(false)
    }
  }, [emitterId, toast])

  useEffect(() => {
    loadAuthorizedInvoices()
  }, [loadAuthorizedInvoices])

  // Cargar detalle de la factura seleccionada
  const handleSelectInvoice = async (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId)
    if (!invoiceId || !emitterId) {
      setInvoiceDetail(null)
      setLines([])
      return
    }

    setLoadingDetail(true)
    try {
      const detail = await getInvoiceDetail(emitterId, invoiceId)
      setInvoiceDetail(detail)

      // Convertir líneas de la factura a ítems seleccionables para devolución
      const returnLines: ReturnLineItem[] = detail.lines.map((l) => ({
        lineNumber: l.lineNumber,
        mainCode: l.mainCode,
        description: l.description,
        originalQty: l.quantity,
        returnQty: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount,
        selected: true,
        taxes: l.taxes,
      }))
      setLines(returnLines)

      // Validar fecha por defecto
      if (detail.issueDate > issueDate) {
        setIssueDate(detail.issueDate)
      }
    } catch (err) {
      toast.show({
        title: 'Error',
        message: readApiError(err, 'Error al obtener detalle de la factura.'),
        variant: 'error',
      })
    } finally {
      setLoadingDetail(false)
    }
  }

  // Alternar selección de línea
  const handleToggleLine = (index: number) => {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, selected: !l.selected } : l))
    )
  }

  // Actualizar cantidad a devolver
  const handleQtyChange = (index: number, qtyStr: string) => {
    const val = parseFloat(qtyStr) || 0
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l
        const safeQty = Math.max(0, Math.min(l.originalQty, val))
        return { ...l, returnQty: safeQty }
      })
    )
  }

  // Cálculos reactivos de la Nota de Crédito
  const totals = useMemo(() => {
    let subtotalWithoutTax = 0
    let vatSum = 0

    const selectedLines = lines.filter((l) => l.selected && l.returnQty > 0)
    for (const line of selectedLines) {
      const lineTotal = line.returnQty * line.unitPrice - line.discount
      subtotalWithoutTax += Math.max(0, lineTotal)

      for (const t of line.taxes) {
        if (t.rate > 0) {
          const lineTaxable = lineTotal
          const lineVat = lineTaxable * (t.rate / 100)
          vatSum += lineVat
        }
      }
    }

    const grandTotal = subtotalWithoutTax + vatSum
    return {
      subtotalWithoutTax,
      vatSum,
      grandTotal,
      selectedCount: selectedLines.length,
    }
  }, [lines])

  // Emisión de la Nota de Crédito
  const handleEmitCreditNote = async () => {
    if (!emitterId || !selectedInvoiceId || !invoiceDetail) return

    const trimmedMotivo = motivoDetails.trim() || motivoPreset
    if (trimmedMotivo.length < 1 || trimmedMotivo.length > 300) {
      toast.show({ title: 'Atención', message: 'El motivo debe tener entre 1 y 300 caracteres.', variant: 'error' })
      return
    }

    const selectedLines = lines.filter((l) => l.selected && l.returnQty > 0)
    if (selectedLines.length === 0) {
      toast.show({
        title: 'Atención',
        message: 'Debe seleccionar al menos un ítem con cantidad mayor a 0 para devolver.',
        variant: 'error',
      })
      return
    }

    setSubmitting(true)
    try {
      // Mapear líneas seleccionadas para el API
      const requestLines: CreateInvoiceLineBody[] = selectedLines.map((l) => {
        const lineTotal = Math.max(0, l.returnQty * l.unitPrice - l.discount)
        return {
          lineNumber: l.lineNumber,
          description: l.description,
          quantity: l.returnQty,
          unitPrice: l.unitPrice,
          discount: l.discount,
          lineTotalWithoutTax: lineTotal,
          mainCode: l.mainCode,
          taxes: l.taxes.map((t) => ({
            taxCode: t.taxCode,
            rateCode: t.rateCode,
            rate: t.rate,
            taxableBase: lineTotal,
            value: lineTotal * (t.rate / 100),
          })),
        }
      })

      // 1. Crear Nota de Crédito en backend
      const created = await createCreditNote(
        emitterId,
        selectedInvoiceId,
        {
          motivo: trimmedMotivo,
          issueDate,
          lines: requestLines,
        },
        tenantId
      )

      toast.show({
        title: 'Procesando',
        message: `Nota de Crédito ${created.sequential} creada. Firmando y enviando al SRI...`,
        variant: 'info',
      })

      // 2. Firmar XML y enviar al SRI
      await signInvoice(emitterId, created.creditNoteId)

      // 3. Consultar autorización
      const sriRes = await pollInvoiceAuthorization(emitterId, created.creditNoteId)

      if (sriRes.state === 'Authorized') {
        toast.show({
          title: 'Éxito',
          message: `¡Nota de Crédito ${created.sequential} autorizada por el SRI!`,
          variant: 'success',
        })
      } else {
        toast.show({
          title: 'En Proceso',
          message: `Nota de Crédito en estado ${sriRes.state}. Revise el estado en el listado.`,
          variant: 'info',
        })
      }

      navigate('/facturacion/notas-credito')
    } catch (err) {
      toast.show({
        title: 'Error',
        message: readApiError(err, 'Error al emitir la Nota de Crédito.'),
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!canCreate) {
    return (
      <TenantSessionGate
        title="Nueva Nota de Crédito"
        lead="Emisión de notas de crédito electrónicas ante el SRI"
      >
        <div className="ecu-dashboard-layout ecu-section-page ecu-section-page">
          <EmptyState
            icon="gpp_bad"
            title="Sin permisos"
            description="No dispone de permisos para emitir notas de crédito electrónicas."
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Nueva Nota de Crédito"
      lead="Emisión de notas de crédito electrónicas ante el SRI"
    >
      <div className="ecu-dashboard-layout ecu-section-page ecu-section-page">
        <PageHeader
          title="Nueva Nota de Crédito Electrónica"
          badge={<StatusBadge tone="info">SRI 04</StatusBadge>}
          subtitle="Seleccione la factura autorizada de sustento para realizar la anulación o devolución parcial."
          actions={
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/facturacion/notas-credito')}
            >
              ← Volver al listado
            </Button>
          }
        />

        {/* 1. Selección de Factura Sustento */}
        <SectionCard title="1. Factura de Sustento (Documento Modificado)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Select
              id="invoice-select"
              label="Factura Autorizada por el SRI"
              labelPosition="outlined"
              variant="outline"
              options={[
                { value: '', label: '-- Seleccione una factura autorizada --' },
                ...authorizedInvoices.map((inv) => ({
                  value: inv.invoiceId,
                  label: `Factura ${inv.establishment}-${inv.emissionPoint}-${inv.sequential} | ${inv.counterpartyName} (${formatMoney(inv.grandTotal)}) - ${inv.issueDate}`,
                })),
              ]}
              value={selectedInvoiceId}
              disabled={loadingInvoices || submitting}
              onChange={(value: string) => handleSelectInvoice(value)}
            />

            {loadingDetail ? (
              <div className="app-shell__muted" style={{ padding: '1rem' }}>
                Cargando datos de la factura seleccionada...
              </div>
            ) : invoiceDetail ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                  padding: '1rem',
                  backgroundColor: 'var(--glb-surface)',
                  border: '1px solid var(--shell-border)',
                  borderRadius: 'var(--glb-border-radius, 8px)',
                }}
              >
                <div>
                  <span className="app-shell__muted" style={{ fontSize: '0.85rem' }}>
                    Comprobante Sustento
                  </span>
                  <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>
                    Factura {invoiceDetail.establishment}-{invoiceDetail.emissionPoint}-
                    {invoiceDetail.sequential}
                  </div>
                </div>
                <div>
                  <span className="app-shell__muted" style={{ fontSize: '0.85rem' }}>
                    Fecha Emisión Sustento
                  </span>
                  <div style={{ fontWeight: 600 }}>{invoiceDetail.issueDate}</div>
                </div>
                <div>
                  <span className="app-shell__muted" style={{ fontSize: '0.85rem' }}>
                    Cliente / Comprador
                  </span>
                  <div style={{ fontWeight: 600 }}>
                    {invoiceDetail.counterparty.businessName} ({invoiceDetail.counterparty.identification})
                  </div>
                </div>
                <div>
                  <span className="app-shell__muted" style={{ fontSize: '0.85rem' }}>
                    Monto Facturado
                  </span>
                  <div style={{ fontWeight: 600, color: 'var(--shell-primary)' }}>
                    {formatMoney(invoiceDetail.grandTotal)}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </SectionCard>

        {invoiceDetail ? (
          <>
            {/* 2. Parámetros de Emisión & Motivo */}
            <SectionCard title="2. Parámetros de Emisión & Motivo SRI">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                <TextBox
                  id="issue-date"
                  type="date"
                  label="Fecha Emisión Nota de Crédito"
                  labelPosition="outlined"
                  variant="outline"
                  value={issueDate}
                  min={invoiceDetail.issueDate}
                  disabled={submitting}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setIssueDate(e.target.value)}
                />

                <Select
                  id="motivo-preset"
                  label="Tipo de Motivo Tributario"
                  labelPosition="outlined"
                  variant="outline"
                  options={MOTIVO_PRESETS}
                  value={motivoPreset}
                  disabled={submitting}
                  onChange={(value: string) => {
                    setMotivoPreset(value)
                    setMotivoDetails(value)
                  }}
                />

                <TextBox
                  id="motivo-details"
                  label="Detalle del Motivo (SRI)"
                  labelPosition="outlined"
                  variant="outline"
                  maxLength={300}
                  value={motivoDetails}
                  disabled={submitting}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setMotivoDetails(e.target.value)}
                />
              </div>
            </SectionCard>

            {/* 3. Devolución de Ítems / Cantidades */}
            <SectionCard title="3. Selección de Ítems a Devolver / Modificar">
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'separate',
                    borderSpacing: 0,
                    fontSize: '0.9rem',
                    marginBottom: '1rem',
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--shell-border)', textAlign: 'left' }}>
                      <th style={{ padding: '0.65rem 0.75rem', width: '65px', textAlign: 'center' }}>Incluir</th>
                      <th style={{ padding: '0.65rem 0.75rem' }}>Ítem / Descripción</th>
                      <th style={{ padding: '0.65rem 0.75rem', width: '130px', textAlign: 'right' }}>
                        Cant. Facturada
                      </th>
                      <th style={{ padding: '0.65rem 0.75rem', width: '140px', textAlign: 'right' }}>
                        Cant. a Devolver
                      </th>
                      <th style={{ padding: '0.65rem 0.75rem', width: '120px', textAlign: 'right' }}>
                        Precio Unit.
                      </th>
                      <th style={{ padding: '0.65rem 0.75rem', width: '130px', textAlign: 'right' }}>
                        Subtotal Dev.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => {
                      const lineTotal = line.selected
                        ? Math.max(0, line.returnQty * line.unitPrice - line.discount)
                        : 0
                      return (
                        <tr
                          key={line.lineNumber}
                          style={{
                            borderBottom: '1px solid var(--shell-border)',
                            opacity: line.selected ? 1 : 0.45,
                            transition: 'opacity 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={line.selected}
                              disabled={submitting}
                              onChange={() => handleToggleLine(idx)}
                              style={{
                                width: '18px',
                                height: '18px',
                                cursor: 'pointer',
                                accentColor: 'var(--shell-primary)',
                                verticalAlign: 'middle',
                              }}
                            />
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            <strong style={{ color: 'var(--glb-text)' }}>{line.description}</strong>
                            {line.mainCode ? (
                              <span className="app-shell__muted" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                                ({line.mainCode})
                              </span>
                            ) : null}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 500 }}>
                            {line.originalQty}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              max={line.originalQty}
                              value={line.returnQty}
                              disabled={!line.selected || submitting}
                              onChange={(e) => handleQtyChange(idx, e.target.value)}
                              style={{
                                width: '85px',
                                textAlign: 'right',
                                padding: '0.35rem 0.5rem',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                border: '1px solid var(--shell-border)',
                                borderRadius: '6px',
                                background: line.selected ? 'var(--glb-surface)' : 'rgba(255,255,255,0.03)',
                                color: 'var(--glb-text)',
                                outline: 'none',
                              }}
                            />
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: 'var(--glb-muted)' }}>
                            ${formatMoney(line.unitPrice)}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 600, color: 'var(--glb-text)' }}>
                            ${formatMoney(lineTotal)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Resumen Económico */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: '1.25rem',
                  paddingTop: '1.25rem',
                  borderTop: '1px solid var(--shell-border)',
                }}
              >
                <div
                  style={{
                    width: '360px',
                    maxWidth: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                    padding: '1rem 1.25rem',
                    borderRadius: '8px',
                    backgroundColor: 'var(--glb-surface)',
                    border: '1px solid var(--shell-border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span className="app-shell__muted">Subtotal sin impuestos:</span>
                    <span style={{ fontWeight: 500, color: 'var(--glb-text)' }}>${formatMoney(totals.subtotalWithoutTax)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span className="app-shell__muted">IVA Calculado:</span>
                    <span style={{ fontWeight: 500, color: 'var(--glb-text)' }}>${formatMoney(totals.vatSum)}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      paddingTop: '0.6rem',
                      marginTop: '0.2rem',
                      borderTop: '1px solid var(--shell-border)',
                    }}
                  >
                    <span style={{ color: 'var(--glb-text)' }}>Total Modificado:</span>
                    <span style={{ color: 'var(--shell-primary)', fontSize: '1.25rem' }}>
                      ${formatMoney(totals.grandTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* 4. Acción de Emisión */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
              <Button
                type="button"
                variant="ghost"
                disabled={submitting}
                onClick={() => navigate('/facturacion/notas-credito')}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={submitting}
                disabled={submitting || totals.selectedCount === 0 || totals.grandTotal <= 0}
                onClick={handleEmitCreditNote}
              >
                {submitting ? 'Emitiendo...' : 'Emitir Nota de Crédito al SRI'}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </TenantSessionGate>
  )
}
