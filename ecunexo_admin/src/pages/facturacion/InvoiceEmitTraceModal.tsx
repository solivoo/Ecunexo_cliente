import { useState, useMemo } from 'react'
import { Popup, Button } from 'glubox'
import type { SriEmitTrace } from '@/pages/facturacion/invoiceEmitApi'
import { parseAccessKey } from '@/pages/facturacion/sriAccessKey'
import type { AccessKeyBreakdown } from '@/pages/facturacion/sriAccessKey'
import './invoiceEmitTraceModal.css'

export type InvoiceEmitTraceModalProps = {
  readonly open: boolean
  readonly trace: SriEmitTrace | null
  readonly onClose: () => void
}

export type { AccessKeyBreakdown }
export { parseAccessKey }

export function InvoiceEmitTraceModal({ open, trace, onClose }: InvoiceEmitTraceModalProps) {
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedXml, setCopiedXml] = useState(false)
  const [copiedJson, setCopiedJson] = useState(false)

  const activeKey =
    trace?.sriResult?.accessKey ||
    trace?.signResult?.accessKey ||
    trace?.previewXml?.accessKey ||
    null

  const keyBreakdown = useMemo(() => parseAccessKey(activeKey), [activeKey])

  const copyToClipboard = async (text: string, setter: (val: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text)
      setter(true)
      setTimeout(() => setter(false), 2000)
    } catch {
      // Fallback si no hay clipboard API
    }
  }

  if (!trace) {
    return (
      <Popup
        open={open}
        title="Diagnóstico Técnico SRI"
        onClose={onClose}
        width="min(96vw, 42rem)"
        actions={[{ id: 'close', label: 'Cerrar', variant: 'ghost', onClick: onClose }]}
      >
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--glb-muted)' }}>
          No hay registros de emisión disponibles todavía. Emite o valida una factura para ver su trazabilidad.
        </div>
      </Popup>
    )
  }

  const isProduction = trace.environment === 'Production'
  const isAuthorized = trace.sriResult?.state === 'Authorized'
  const isReturned = trace.sriResult?.state === 'Returned'
  const hasError = Boolean(trace.rawError) || isReturned || trace.sriResult?.state === 'NotAuthorized'

  const hasCode35 = trace.sriResult?.messages.some(
    (m) => m.identifier === '35' || m.text.includes('35') || m.text.includes('ESTRUCTURA XML')
  )

  const jsonPayloadString = trace.requestPayload
    ? JSON.stringify(trace.requestPayload, null, 2)
    : null

  return (
    <Popup
      open={open}
      title="Diagnóstico y Trazabilidad Técnica SRI"
      onClose={onClose}
      width="min(96vw, 56rem)"
      closeOnOverlayClick
      closeOnEscape
      actions={[
        {
          id: 'close',
          label: 'Cerrar',
          variant: 'primary',
          onClick: onClose,
        },
      ]}
    >
      <div className="ecu-sri-trace">
        {/* Cabecera de estado y ambiente */}
        <div className="ecu-sri-trace__header">
          <div className="ecu-sri-trace__badges">
            <span
              className={`ecu-sri-trace__badge ${
                isProduction ? 'ecu-sri-trace__badge--prod' : 'ecu-sri-trace__badge--test'
              }`}
            >
              {isProduction ? 'Ambiente 2 · PRODUCCIÓN' : 'Ambiente 1 · PRUEBAS'}
            </span>
            <span className="ecu-sri-trace__badge ecu-sri-trace__badge--info">
              Modo: {trace.mode}
            </span>
            {trace.sriResult?.state && (
              <span
                className={`ecu-sri-trace__badge ${
                  isAuthorized
                    ? 'ecu-sri-trace__badge--authorized'
                    : isReturned
                      ? 'ecu-sri-trace__badge--returned'
                      : 'ecu-sri-trace__badge--warning'
                }`}
              >
                SRI: {trace.sriResult.state}
              </span>
            )}
            {trace.sriResult?.sriTransmissionState && (
              <span className="ecu-sri-trace__badge ecu-sri-trace__badge--info">
                Transmisión: {trace.sriResult.sriTransmissionState}
              </span>
            )}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
            {new Date(trace.timestamp).toLocaleTimeString('es-EC', { hour12: false })}
          </span>
        </div>

        {/* Resumen emisor y numeración */}
        <div className="ecu-sri-trace__meta-grid">
          <div className="ecu-sri-trace__meta-item">
            <span className="ecu-sri-trace__meta-label">RUC Emisor</span>
            <span className="ecu-sri-trace__meta-value">{trace.emitterRuc}</span>
          </div>
          <div className="ecu-sri-trace__meta-item">
            <span className="ecu-sri-trace__meta-label">Serie (Estab - Pto)</span>
            <span className="ecu-sri-trace__meta-value">
              {trace.establishment} - {trace.emissionPoint}
            </span>
          </div>
          <div className="ecu-sri-trace__meta-item">
            <span className="ecu-sri-trace__meta-label">Secuencial Solicitado</span>
            <span className="ecu-sri-trace__meta-value">{trace.sequentialRequested}</span>
          </div>
          <div className="ecu-sri-trace__meta-item">
            <span className="ecu-sri-trace__meta-label">Secuencial Asignado</span>
            <span className="ecu-sri-trace__meta-value">
              {trace.createdInvoice?.sequential || '—'}
            </span>
          </div>
        </div>

        {/* Alerta de errores SRI si hubo rechazo o error técnico */}
        {hasError && (
          <div className="ecu-sri-trace__sri-alert" role="alert">
            <div className="ecu-sri-trace__sri-alert-title">
              ⚠️ Respuesta o Error del SRI
            </div>
            {trace.rawError && <p style={{ margin: 0, fontSize: '0.8rem' }}>{trace.rawError}</p>}
            {trace.sriResult?.messages && trace.sriResult.messages.length > 0 && (
              <ul className="ecu-sri-trace__sri-messages">
                {trace.sriResult.messages.map((m, idx) => (
                  <li key={idx}>
                    <strong>[{m.identifier}]</strong> {m.text} {m.detail ? `(${m.detail})` : ''}
                  </li>
                ))}
              </ul>
            )}
            {hasCode35 && (
              <div className="ecu-sri-trace__sri-alert-hint">
                <strong>Diagnóstico para Error [35] ARCHIVO NO CUMPLE ESTRUCTURA XML:</strong>
                <br />
                1. Verifica que la posición 24 de la clave de acceso coincida con el ambiente (debe ser <strong>2</strong> para Producción).
                <br />
                2. Verifica que el nodo <code>&lt;ambiente&gt;</code> en el XML sea <strong>2</strong>.
                <br />
                3. Comprueba que el certificado de firma digital pertenezca al mismo RUC emisor (<code>{trace.emitterRuc}</code>).
              </div>
            )}
          </div>
        )}

        {/* Clave de Acceso y desglose de 49 dígitos */}
        {activeKey && (
          <div className="ecu-sri-trace__section">
            <div className="ecu-sri-trace__section-head">
              <span className="ecu-sri-trace__section-title">
                Clave de Acceso SRI (49 dígitos)
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copyToClipboard(activeKey, setCopiedKey)}
              >
                {copiedKey ? '¡Copiada!' : 'Copiar Clave'}
              </Button>
            </div>

            <div className="ecu-sri-trace__key-full">
              <span>{activeKey}</span>
            </div>

            {keyBreakdown && (
              <div className="ecu-sri-trace__key-segments" title="Desglose de los 49 dígitos de la clave">
                <div className="ecu-sri-trace__segment" title="Fecha (ddMMyyyy)">
                  <span className="ecu-sri-trace__segment-label">Fecha</span>
                  <span className="ecu-sri-trace__segment-value">{keyBreakdown.date}</span>
                </div>
                <div className="ecu-sri-trace__segment" title="Tipo comprobante (01=Factura)">
                  <span className="ecu-sri-trace__segment-label">Doc</span>
                  <span className="ecu-sri-trace__segment-value">{keyBreakdown.docType}</span>
                </div>
                <div className="ecu-sri-trace__segment" title="RUC emisor">
                  <span className="ecu-sri-trace__segment-label">RUC</span>
                  <span className="ecu-sri-trace__segment-value">{keyBreakdown.ruc}</span>
                </div>
                <div
                  className={`ecu-sri-trace__segment ${
                    keyBreakdown.env === '2'
                      ? 'ecu-sri-trace__segment--env'
                      : 'ecu-sri-trace__segment--env-test'
                  }`}
                  title={`Ambiente (Posición 24): ${keyBreakdown.env === '2' ? '2 = Producción' : '1 = Pruebas'}`}
                >
                  <span className="ecu-sri-trace__segment-label">Amb (P24)</span>
                  <span className="ecu-sri-trace__segment-value">
                    {keyBreakdown.env} ({keyBreakdown.env === '2' ? 'Prod' : 'Test'})
                  </span>
                </div>
                <div className="ecu-sri-trace__segment" title="Establecimiento">
                  <span className="ecu-sri-trace__segment-label">Estab</span>
                  <span className="ecu-sri-trace__segment-value">{keyBreakdown.estab}</span>
                </div>
                <div className="ecu-sri-trace__segment" title="Punto de Emisión">
                  <span className="ecu-sri-trace__segment-label">Pto</span>
                  <span className="ecu-sri-trace__segment-value">{keyBreakdown.ptoEmi}</span>
                </div>
                <div
                  className="ecu-sri-trace__segment ecu-sri-trace__segment--seq"
                  title="Secuencial de 9 dígitos"
                >
                  <span className="ecu-sri-trace__segment-label">Secuencial</span>
                  <span className="ecu-sri-trace__segment-value">{keyBreakdown.sequential}</span>
                </div>
                <div className="ecu-sri-trace__segment" title="Código Numérico de seguridad">
                  <span className="ecu-sri-trace__segment-label">Numérico</span>
                  <span className="ecu-sri-trace__segment-value">{keyBreakdown.numericCode}</span>
                </div>
                <div className="ecu-sri-trace__segment" title="Tipo Emisión (1=Normal)">
                  <span className="ecu-sri-trace__segment-label">Emi</span>
                  <span className="ecu-sri-trace__segment-value">{keyBreakdown.emissionType}</span>
                </div>
                <div className="ecu-sri-trace__segment" title="Dígito Verificador (Módulo 11)">
                  <span className="ecu-sri-trace__segment-label">DV</span>
                  <span className="ecu-sri-trace__segment-value">{keyBreakdown.checkDigit}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* XML Generado / Validado */}
        {trace.previewXml?.xmlText && (
          <div className="ecu-sri-trace__section">
            <div className="ecu-sri-trace__section-head">
              <span className="ecu-sri-trace__section-title">
                XML del Comprobante ({trace.previewXml.isValid ? 'Válido contra XSD' : 'Con errores XSD'})
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copyToClipboard(trace.previewXml?.xmlText || '', setCopiedXml)}
              >
                {copiedXml ? '¡Copiado!' : 'Copiar XML'}
              </Button>
            </div>
            <div className="ecu-sri-trace__code-wrapper">
              <div className="ecu-sri-trace__code-bar">
                <span>factura.xml</span>
                <span>{trace.previewXml.xmlText.length} caracteres</span>
              </div>
              <pre className="ecu-sri-trace__code-content">
                {trace.previewXml.xmlText}
              </pre>
            </div>
          </div>
        )}

        {/* Payload JSON enviado */}
        {jsonPayloadString && (
          <div className="ecu-sri-trace__section">
            <div className="ecu-sri-trace__section-head">
              <span className="ecu-sri-trace__section-title">
                Payload JSON (Enviado a Billing.Api /invoices)
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copyToClipboard(jsonPayloadString, setCopiedJson)}
              >
                {copiedJson ? '¡Copiado!' : 'Copiar JSON'}
              </Button>
            </div>
            <div className="ecu-sri-trace__code-wrapper">
              <div className="ecu-sri-trace__code-bar">
                <span>request-payload.json</span>
              </div>
              <pre className="ecu-sri-trace__code-content">
                {jsonPayloadString}
              </pre>
            </div>
          </div>
        )}
      </div>
    </Popup>
  )
}
