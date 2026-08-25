import { Text, View } from '@react-pdf/renderer'
import { formatIssueDate, rideValue } from '@/pages/facturacion/rideFacturaFormat'
import { useRideTheme } from '@/pages/facturacion/rideFacturaTheme'
import type { InvoiceDetail } from '@/types/billingApi'

function Field({
  label,
  value,
  full = false,
}: {
  readonly label: string
  readonly value: string
  readonly full?: boolean
}) {
  const { styles } = useRideTheme()
  return (
    <View style={full ? styles.buyerCellFull : styles.buyerCell}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{rideValue(value)}</Text>
    </View>
  )
}

export function RideFacturaBuyer({ invoice }: { readonly invoice: InvoiceDetail }) {
  const { styles } = useRideTheme()
  const buyer = invoice.counterparty
  return (
    <View style={styles.buyerBox}>
      <View style={styles.buyerGrid}>
        <Field label="Razón social" value={buyer.businessName} full />
        <Field label="RUC / CI" value={buyer.identification} />
        <Field label="Teléfono" value={buyer.phone ?? ''} />
        <Field label="Dirección" value={buyer.address ?? ''} full />
        <Field label="Fecha de emisión" value={formatIssueDate(invoice.issueDate)} />
        <Field label="Correo" value={buyer.email ?? ''} />
      </View>
    </View>
  )
}
