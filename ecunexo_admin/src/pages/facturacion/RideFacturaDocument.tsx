import { Document, Page, View } from '@react-pdf/renderer'
import { RideFacturaBuyer } from '@/pages/facturacion/RideFacturaBuyer'
import { RideFacturaFooter, RideSoftwareFooter } from '@/pages/facturacion/RideFacturaFooter'
import { RideFacturaHeader } from '@/pages/facturacion/RideFacturaHeader'
import { RideFacturaLines } from '@/pages/facturacion/RideFacturaLines'
import { rideIssuerName } from '@/pages/facturacion/rideFacturaFormat'
import { buildRidePalette } from '@/pages/facturacion/rideFacturaPalette'
import { createRideStyles } from '@/pages/facturacion/rideFacturaStyles'
import { RideThemeContext } from '@/pages/facturacion/rideFacturaTheme'
import type { RideFacturaDocumentProps, RideTotals } from '@/pages/facturacion/rideFacturaTypes'

export type { RideFacturaDocumentProps, RideLegalExtras } from '@/pages/facturacion/rideFacturaTypes'

function sumByRate(
  invoice: RideFacturaDocumentProps['invoice'],
  rateCode: string,
  field: 'taxableBase' | 'value'
): number {
  return invoice.taxTotals
    .filter((t) => t.rateCode === rateCode)
    .reduce((acc, t) => acc + t[field], 0)
}

function computeTotals(invoice: RideFacturaDocumentProps['invoice']): RideTotals {
  return {
    discountTotal: invoice.lines.reduce((acc, l) => acc + l.discount, 0),
    subtotal15: sumByRate(invoice, '4', 'taxableBase'),
    subtotal5: sumByRate(invoice, '5', 'taxableBase'),
    subtotal0: sumByRate(invoice, '0', 'taxableBase'),
    subtotalNoObjeto: sumByRate(invoice, '6', 'taxableBase'),
    iva15: sumByRate(invoice, '4', 'value'),
    iva5: sumByRate(invoice, '5', 'value'),
  }
}

export function RideFacturaDocument(props: RideFacturaDocumentProps) {
  const { invoice, legal, barcodeDataUrl, authorizationDateTime } = props
  const docNumber = `${invoice.establishment}-${invoice.emissionPoint}-${invoice.sequential}`
  const palette = buildRidePalette(legal?.primaryColorHex)
  const styles = createRideStyles(palette)
  const issuerName = rideIssuerName(
    legal?.companyName,
    invoice.emitter.tradeName,
    invoice.emitter.businessName
  )
  const totals = computeTotals(invoice)
  const theme = { palette, styles }

  return (
    <Document title={`RIDE-${docNumber}`} author={issuerName || invoice.emitter.businessName}>
      <Page size="A4" style={styles.page}>
        <RideThemeContext.Provider value={theme}>
          <View style={styles.topBar} />
          <View style={styles.body}>
            <RideFacturaHeader
              invoice={invoice}
              legal={legal}
              barcodeDataUrl={barcodeDataUrl}
              authorizationDateTime={authorizationDateTime}
            />
            <RideFacturaBuyer invoice={invoice} />
            <RideFacturaLines invoice={invoice} />
            <RideFacturaFooter invoice={invoice} legal={legal} totals={totals} />
          </View>
          <RideSoftwareFooter invoice={invoice} />
        </RideThemeContext.Provider>
      </Page>
    </Document>
  )
}
