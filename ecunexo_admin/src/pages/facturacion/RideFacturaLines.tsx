import { Text, View, type ViewProps } from '@react-pdf/renderer'
import { money, moneyUsd, rideValue } from '@/pages/facturacion/rideFacturaFormat'
import { useRideTheme } from '@/pages/facturacion/rideFacturaTheme'
import type { InvoiceDetail } from '@/types/billingApi'

function Cell({
  style,
  children,
}: {
  readonly style: ViewProps['style']
  readonly children: string
}) {
  return (
    <View style={style}>
      <Text wrap>{children}</Text>
    </View>
  )
}

export function RideFacturaLines({ invoice }: { readonly invoice: InvoiceDetail }) {
  const { styles } = useRideTheme()
  return (
    <View style={styles.tableBox}>
      <View style={styles.tableHeader}>
        <Cell style={styles.colCod}>Código</Cell>
        <Cell style={styles.colCant}>Cantidad</Cell>
        <Cell style={styles.colDesc}>Descripción</Cell>
        <Cell style={styles.colDet}>Det. adicionales</Cell>
        <Cell style={styles.colPUnit}>P. unitario</Cell>
        <Cell style={styles.colDisc}>Desc.</Cell>
        <Cell style={styles.colTotal}>Total</Cell>
      </View>
      {invoice.lines.map((line, index) => (
        <View
          key={line.lineNumber}
          style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
          wrap={false}
        >
          <Cell style={styles.colCod}>{rideValue(line.mainCode)}</Cell>
          <Cell style={styles.colCant}>{money(line.quantity)}</Cell>
          <Cell style={styles.colDesc}>{rideValue(line.description)}</Cell>
          <Cell style={styles.colDet}> </Cell>
          <Cell style={styles.colPUnit}>{money(line.unitPrice)}</Cell>
          <Cell style={styles.colDisc}>{moneyUsd(line.discount)}</Cell>
          <Cell style={styles.colTotal}>{moneyUsd(line.lineTotalWithoutTax)}</Cell>
        </View>
      ))}
    </View>
  )
}
