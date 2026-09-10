import { Button } from 'glubox'
import { useNavigate } from 'react-router-dom'
import { PageHeader, StatusBadge } from '@/components/ui'
import { PageLoadState } from '@/features/organization/components/PageLoadState'
import { useHasPermission } from '@/hooks/useHasPermission'
import { InvoiceLinesSection } from '@/pages/facturacion/InvoiceLinesSection'
import { InvoiceMetaFields } from '@/pages/facturacion/InvoiceMetaFields'
import { InvoiceNotesFields } from '@/pages/facturacion/InvoiceNotesFields'
import { InvoiceRidePreviewPopup } from '@/pages/facturacion/InvoiceRidePreviewPopup'
import { RidePrintConfirmPopup } from '@/pages/facturacion/RidePrintConfirmPopup'
import { useInvoiceEmitForm } from '@/pages/facturacion/useInvoiceEmitForm'
import { selectTenantBranding, selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import './facturaEmitir.css'

export function FacturaEmitirPage() {
  const navigate = useNavigate()
  const canCreate = useHasPermission('facturacion.facturas.create')
  const tenantId = useAppSelector(selectTenantId)
  const branding = useAppSelector(selectTenantBranding)
  const form = useInvoiceEmitForm({ tenantId, branding, canCreate })
  const profile = form.emitProfile

  const primaryLabel =
    profile.emitMode === 'draft'
      ? 'Validar XML'
      : profile.emitMode === 'sign'
        ? 'Firmar'
        : profile.sriEnvironment === 'Production'
          ? 'Emitir (producción)'
          : 'Emitir (SRI pruebas)'

  if (!canCreate) {
    return (
      <div className="ecu-dashboard-layout factura-emitir">
        <PageHeader
          title="Emitir Factura"
          subtitle="Sin permiso para emitir facturas (facturacion.facturas.create)."
          badge={<StatusBadge tone="danger">Acceso Restringido</StatusBadge>}
        />
      </div>
    )
  }

  return (
    <div className="ecu-dashboard-layout factura-emitir">
      <PageHeader
        title={form.requiresNotaVenta ? 'Nota de Venta' : 'Emitir Factura Electrónica'}
        subtitle={
          form.requiresNotaVenta
            ? 'Negocio popular: el SRI pide nota de venta. Si tu régimen requiere factura electrónica, verifícalo en Configuración SRI.'
            : form.companyLabel
              ? `Comprobante de venta SRI 01 — ${form.companyLabel}`
              : 'Emisión y firma electrónica autorizada por el SRI.'
        }
        badge={
          <StatusBadge tone={profile.isDevelopment ? 'warning' : 'success'} withDot>
            {profile.isDevelopment ? 'Ambiente Pruebas' : 'Producción SRI'}
          </StatusBadge>
        }
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/facturacion/comprobantes')}
          >
            Volver a comprobantes
          </Button>
        }
      />

      <PageLoadState
        loading={form.loadingTenant}
        error={form.loadError}
        empty={!tenantId}
        emptyMessage="Entrar a una empresa para emitir facturas."
      >
        <div
          className={
            profile.isDevelopment
              ? 'factura-emitir__mode-banner factura-emitir__mode-banner--dev'
              : 'factura-emitir__mode-banner factura-emitir__mode-banner--prod'
          }
          role="status"
        >
          <p className="factura-emitir__mode-banner-title">
            {profile.isDevelopment ? 'Modo desarrollo' : 'Modo producción'}
          </p>
          <p className="factura-emitir__mode-banner-text">
            {profile.label}. {profile.description}
          </p>
          <p className="factura-emitir__mode-banner-hint">
            Cambiar en Facturación → Emisor.
          </p>
        </div>

        <form
          className="factura-emitir__form ecu-companies-form"
          onSubmit={(e) => {
            e.preventDefault()
            void form.onSubmit()
          }}
          noValidate
        >
          <section className="app-shell__card ecu-companies-form__card factura-emitir__card">
            <InvoiceMetaFields
              header={form.header}
              counterparty={form.counterparty}
              issuerLocked={form.issuerLocked}
              disabled={form.formDisabled}
              onHeaderChange={form.patchHeader}
              onCounterpartyChange={form.patchCounterparty}
            />

            <InvoiceNotesFields
              header={form.header}
              disabled={form.formDisabled}
              onHeaderChange={form.patchHeader}
            />

            <InvoiceLinesSection
              tenantId={tenantId}
              lines={form.lines}
              disabled={form.formDisabled}
              embedded
              onAdd={form.addLine}
              onRemove={form.removeLine}
              onChange={form.patchLine}
            />

            <footer className="ecu-companies-form__actions factura-emitir__actions">
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={form.formDisabled}
                loading={form.previewing}
                onClick={() => void form.onPreview()}
              >
                {form.previewing ? 'Generando…' : 'Previsualizar'}
              </Button>
              {profile.emitMode !== 'draft' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  disabled={form.formDisabled}
                  onClick={() => void form.onSubmit('draft')}
                >
                  Solo validar
                </Button>
              ) : null}
              {profile.emitMode === 'sri' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  disabled={form.formDisabled}
                  onClick={() => void form.onSubmit('sign')}
                >
                  Solo firmar
                </Button>
              ) : null}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={form.formDisabled}
                loading={form.busy}
              >
                {form.busy ? 'Procesando…' : primaryLabel}
              </Button>
            </footer>
          </section>
        </form>
      </PageLoadState>

      <InvoiceRidePreviewPopup
        open={form.previewRide !== null}
        blob={form.previewRide?.blob ?? null}
        filename={form.previewRide?.filename}
        hint="Borrador. El secuencial y la clave de acceso se asignan al emitir."
        printing={form.previewPrinting}
        onClose={form.dismissPreview}
        onPrint={() => {
          void form.confirmPreviewPrint()
        }}
      />

      <RidePrintConfirmPopup
        open={form.rideOfferOpen}
        printing={form.ridePrinting}
        message="¿Desea generar e imprimir el RIDE de esta factura?"
        onClose={form.dismissRideOffer}
        onConfirmPrint={() => {
          void form.confirmRidePrint()
        }}
      />
    </div>
  )
}
