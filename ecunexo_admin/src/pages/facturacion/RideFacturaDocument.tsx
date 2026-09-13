import { Document, Page, Text, View } from '@react-pdf/renderer'
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
  const isPreview =
    !invoice.accessKey ||
    !authorizationDateTime ||
    invoice.state === 'Draft' ||
    invoice.invoiceId === 'preview'
  const isTest = Boolean(
    invoice.accessKey && invoice.accessKey.length >= 24 && invoice.accessKey[23] === '1'
  )

  return (
    <Document title={`RIDE-${docNumber}`} author={issuerName || invoice.emitter.businessName}>
      <Page size="A4" style={styles.page}>
        <RideThemeContext.Provider value={theme}>
          <View style={styles.topBar} />
          {isPreview ? (
            <View style={styles.previewBanner}>
              <Text style={styles.previewBannerText}>
                PREVISUALIZACIÓN — DOCUMENTO SIN VALIDEZ TRIBUTARIA
              </Text>
              <Text style={styles.previewBannerSubtext}>
                (Comprobante borrador preliminar — No autorizado ante el SRI)
              </Text>
            </View>
          ) : isTest ? (
            <View style={styles.testBanner}>
              <Text style={styles.testBannerText}>
                AMBIENTE DE PRUEBAS — DOCUMENTO SIN VALIDEZ TRIBUTARIA
              </Text>
              <Text style={styles.testBannerSubtext}>
                (Emitido en servidores de certificación SRI celcer — No genera crédito tributario ni obligaciones fiscales)
              </Text>
            </View>
          ) : null}
          <View style={styles.body}>
            {isPreview ? (
              <View style={styles.watermarkWrap}>
                <Text style={styles.watermarkText}>
                  PREVISUALIZACIÓN — SIN VALIDEZ TRIBUTARIA
                </Text>
              </View>
            ) : isTest ? (
              <View style={styles.watermarkWrap}>
                <Text style={styles.testWatermarkText}>
                  PRUEBAS — SIN VALIDEZ TRIBUTARIA
                </Text>
              </View>
            ) : null}
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
