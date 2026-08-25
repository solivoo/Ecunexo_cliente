import type { ChangeEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Button, TextBox, useToast } from 'glubox'
import { readApiError } from '@/lib/readApiError'
import { getRideProvider, updateRideProvider } from '@/services/billingApi'

export type SriSoftwareProviderSectionProps = {
  readonly disabled?: boolean
  readonly suggestedRuc?: string
}

export function SriSoftwareProviderSection({
  disabled = false,
  suggestedRuc = '',
}: SriSoftwareProviderSectionProps) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [ruc, setRuc] = useState(suggestedRuc)
  const [legalName, setLegalName] = useState('EcuNexo')
  const [footerLine, setFooterLine] = useState('Documento generado por EcuNexo')
  const [fallback, setFallback] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await getRideProvider()
        if (cancelled) return
        setRuc(data.ruc ?? suggestedRuc)
        setLegalName(data.legalName || 'EcuNexo')
        setFooterLine(data.footerLine || 'Documento generado por EcuNexo')
        setFallback(data.usesEmitterFallback)
        setLoadError(null)
      } catch (err: unknown) {
        if (cancelled) return
        if (suggestedRuc) setRuc(suggestedRuc)
        setLoadError(
          readApiError(err, 'No se pudo leer el RUC proveedor en Billing.Api (:5203).')
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [suggestedRuc])

  const onSave = useCallback(async () => {
    setBusy(true)
    try {
      const saved = await updateRideProvider({
        ruc: ruc.trim() || null,
        legalName: legalName.trim() || 'EcuNexo',
        footerLine: footerLine.trim() || 'Documento generado por EcuNexo',
      })
      setRuc(saved.ruc ?? '')
      setLegalName(saved.legalName)
      setFooterLine(saved.footerLine)
      setFallback(saved.usesEmitterFallback)
      setLoadError(null)
      toast.show({
        title: 'Proveedor del sistema',
        message: saved.usesEmitterFallback
          ? 'Guardado. Sin RUC de plataforma, cada factura usará el RUC del emisor.'
          : `Guardado. RUC Proveedor ${saved.ruc} en XML y RIDE.`,
        variant: 'success',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'No se pudo guardar',
        message: readApiError(err, 'Revisa que Billing.Api (:5203) esté en marcha.'),
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }, [footerLine, legalName, ruc, toast])

  return (
    <section className="app-shell__card ecu-companies-form__card">
      <h2 className="app-shell__section-title">Proveedor del sistema (SRI)</h2>
      <p className="ecu-companies-form__hint">
        Resolución NAC-DGERCGC26-00000027: en cada factura debe ir el campo adicional «RUC
        Proveedor» con el RUC de quien comercializa el software. Si EcuNexo y la empresa emisora
        son la misma persona jurídica, ese RUC coincide con el de esta empresa — igual hay que
        emitirlo. Si más adelante facturan clientes terceros, no cambien este valor: sigue siendo
        el RUC de EcuNexo.
      </p>
      {loadError ? (
        <p className="ecu-companies-form__hint" role="status">
          {loadError}
        </p>
      ) : null}
      {fallback ? (
        <p className="ecu-companies-form__hint" role="status">
          Hoy no hay RUC de plataforma. Las facturas nuevas usarán el RUC del emisor (correcto
          solo mientras sean la misma empresa).
        </p>
      ) : null}
      <div className="ecu-companies-form__grid ecu-companies-form__grid--3">
        <div className="ecu-companies-form__field">
          <TextBox
            id="ride-provider-ruc"
            label="RUC proveedor del sistema"
            labelPosition="outlined"
            variant="outline"
            value={ruc}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setRuc(e.target.value)}
            placeholder="13 dígitos"
            disabled={disabled || busy}
            fullWidth
          />
        </div>
        <div className="ecu-companies-form__field">
          <TextBox
            id="ride-provider-name"
            label="Nombre comercial del software"
            labelPosition="outlined"
            variant="outline"
            value={legalName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setLegalName(e.target.value)}
            placeholder="EcuNexo"
            disabled={disabled || busy}
            fullWidth
          />
        </div>
        <div className="ecu-companies-form__field ecu-companies-form__field--span-3">
          <TextBox
            id="ride-provider-footer"
            label="Pie del RIDE"
            labelPosition="outlined"
            variant="outline"
            value={footerLine}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFooterLine(e.target.value)}
            placeholder="Documento generado por EcuNexo"
            disabled={disabled || busy}
            fullWidth
          />
        </div>
      </div>
      <footer className="ecu-companies-form__actions">
        <Button
          type="button"
          variant="primary"
          size="md"
          disabled={disabled || busy}
          loading={busy}
          onClick={() => void onSave()}
        >
          {busy ? 'Guardando…' : 'Guardar proveedor del sistema'}
        </Button>
      </footer>
    </section>
  )
}
