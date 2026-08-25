import { Text, View } from '@react-pdf/renderer'
import {
  moneyUsd,
  paymentFormRideLabel,
  rideAdditionalRows,
  rideText,
} from '@/pages/facturacion/rideFacturaFormat'
import { useRideTheme } from '@/pages/facturacion/rideFacturaTheme'
import type { RideLegalExtras, RideTotals } from '@/pages/facturacion/rideFacturaTypes'
import type { InvoiceDetail } from '@/types/billingApi'

function TotalRow({
  label,
  value,
  strong = false,
}: {
  readonly label: string
  readonly value: number
  readonly strong?: boolean
}) {
  const { styles } = useRideTheme()
  const textStyle = strong ? styles.totalStrongText : styles.totalValue
  return (
    <View style={strong ? [styles.totalRow, styles.totalStrong] : styles.totalRow}>
      <Text style={strong ? styles.totalStrongText : styles.totalLabel}>{label}</Text>
      <Text style={textStyle}>{moneyUsd(value)}</Text>
    </View>
  )
}

export function RideFacturaFooter({
  invoice,
  legal,
  totals,
}: {
  readonly invoice: InvoiceDetail
  readonly legal?: RideLegalExtras | null
  readonly totals: RideTotals
}) {
  const { styles } = useRideTheme()
  const additionalRows = rideAdditionalRows(invoice)
  const thankYou = rideText(legal?.rideThankYouText)
  const termDays = invoice.paymentTermDays ?? 0

  return (
    <>
      <View style={styles.bottomRow}>
        <View style={styles.leftCol}>
          {additionalRows.length > 0 ? (
            <View style={styles.infoBox}>
              <Text style={styles.sectionBar}>Información adicional</Text>
              <View style={styles.infoBody}>
                {additionalRows.map((row) => (
                  <View key={row.label} style={styles.infoRow} wrap={false}>
                    <Text style={styles.metaLabel}>{row.label}</Text>
                    <Text style={styles.metaValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          <View style={styles.payBox}>
            <Text style={styles.sectionBar}>Formas de pago</Text>
            <View style={styles.payRow}>
              <Text style={styles.payForma}>
                {paymentFormRideLabel(invoice.paymentFormCode)}
              </Text>
              <Text style={styles.payValor}>{moneyUsd(invoice.grandTotal)}</Text>
              <Text style={styles.payPlazo}>{`${termDays} días`}</Text>
            </View>
          </View>
        </View>

        <View style={styles.totalsBox}>
          <TotalRow label="Subtotal sin impuestos" value={invoice.subtotalWithoutTax} />
          <TotalRow label="Subtotal 15%" value={totals.subtotal15} />
          <TotalRow label="Subtotal 5%" value={totals.subtotal5} />
          <TotalRow label="Subtotal 0%" value={totals.subtotal0} />
          <TotalRow label="Subtotal no objeto IVA" value={totals.subtotalNoObjeto} />
          <TotalRow label="Descuentos" value={totals.discountTotal} />
          <TotalRow label="ICE" value={0} />
          <TotalRow label="IVA 15%" value={totals.iva15} />
          <TotalRow label="IVA 5%" value={totals.iva5} />
          <TotalRow label="Servicio %" value={0} />
          <TotalRow label="Valor total" value={invoice.grandTotal} strong />
        </View>
      </View>

      {thankYou ? (
        <View style={styles.thanksBox}>
          <View style={styles.thanksRule} />
          <Text style={styles.thanksTitle}>AGRADECIMIENTO</Text>
          {thankYou.split('\n').map((line, index) => (
            <Text key={`${index}-${line.slice(0, 24)}`} style={styles.thanksLine}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
    </>
  )
}

export function RideSoftwareFooter({ invoice }: { readonly invoice: InvoiceDetail }) {
  const { styles } = useRideTheme()
  const providerName = rideText(invoice.softwareProviderName)
  const providerRuc = rideText(invoice.softwareProviderRuc)
  const footerLine =
    rideText(invoice.softwareFooterLine) ||
    (providerName ? `Documento generado por ${providerName}` : '')

  if (!footerLine && !providerRuc) {
    return null
  }

  return (
    <View style={styles.softwareFooter} fixed>
      {footerLine ? <Text style={styles.softwareFooterLine}>{footerLine}</Text> : null}
      {providerRuc ? (
        <Text style={styles.softwareFooterRuc}>{`RUC proveedor: ${providerRuc}`}</Text>
      ) : null}
    </View>
  )
}
