import { Image, Text, View } from '@react-pdf/renderer'
import {
  ambienteFromAccessKey,
  formatAuthDateTime,
  isHttpUrl,
  rideIssuerName,
  rideIssuerRuc,
  rideText,
  rideValue,
  yesNo,
} from '@/pages/facturacion/rideFacturaFormat'
import type { RideFacturaDocumentProps } from '@/pages/facturacion/rideFacturaTypes'
import { useRideTheme } from '@/pages/facturacion/rideFacturaTheme'

function Meta({ label, value }: { readonly label: string; readonly value: string }) {
  const { styles } = useRideTheme()
  return (
    <View style={styles.metaField}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{rideValue(value)}</Text>
    </View>
  )
}

export function RideFacturaHeader({
  invoice,
  legal,
  barcodeDataUrl,
  authorizationDateTime,
}: RideFacturaDocumentProps) {
  const { styles } = useRideTheme()
  const docNumber = `${invoice.establishment}-${invoice.emissionPoint}-${invoice.sequential}`
  const accessKey = invoice.accessKey
  const logoUrl = legal?.logoUrl
  const companyName = rideIssuerName(
    legal?.companyName,
    invoice.emitter.tradeName,
    invoice.emitter.businessName
  )
  const companyRuc = rideIssuerRuc(legal?.taxId, invoice.emitter.ruc)
  const matriz =
    rideText(legal?.matrizAddress) || rideText(invoice.emitter.mainAddress)
  const authWhen = formatAuthDateTime(authorizationDateTime)

  const isPreview =
    !accessKey ||
    !authorizationDateTime ||
    invoice.state === 'Draft' ||
    invoice.invoiceId === 'preview'
  const displayDocNumber =
    isPreview && (invoice.sequential === '000000000' || invoice.sequential === '—')
      ? `${invoice.establishment}-${invoice.emissionPoint}-PREVISUALIZACIÓN`
      : docNumber

  return (
    <View style={styles.headerRow}>
      <View style={styles.leftBox}>
        <View style={styles.brandStack}>
          {isHttpUrl(logoUrl) ? (
            <View style={styles.logoSlot}>
              <Image src={logoUrl ?? ''} style={styles.logoImage} />
            </View>
          ) : (
            <View style={styles.logoSlot}>
              <Text style={styles.logoWatermark}>
                {rideValue(companyName).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.brandText}>
            <Text style={styles.companyName}>{rideValue(companyName)}</Text>
            <Text style={styles.companyRuc}>RUC {rideValue(companyRuc)}</Text>
          </View>
        </View>
        <Meta label="Matriz" value={matriz} />
        <Meta label="Correo" value={legal?.contactEmail ?? ''} />
        <Meta label="Teléfono" value={legal?.contactPhone ?? ''} />
        <Meta
          label="Obligado a llevar contabilidad"
          value={yesNo(legal?.accountingRequired ?? false)}
        />
        {legal?.isRimpe ? (
          <Text style={styles.rimpe}>CONTRIBUYENTE RÉGIMEN RIMPE</Text>
        ) : null}
      </View>

      <View style={styles.rightBox}>
        <View style={styles.accentStrip} />
        <View style={styles.rightBand}>
          <Text style={styles.facturaTitle}>
            {invoice.documentType === '04' ? 'NOTA DE CRÉDITO' : 'FACTURA'}
          </Text>
          <Text style={styles.docNumber}>No. {displayDocNumber}</Text>
        </View>
        <View style={styles.rightBody}>
          {invoice.documentType === '04' && invoice.modifiedDocumentNumber ? (
            <Meta label="Doc. modificado" value={invoice.modifiedDocumentNumber} />
          ) : null}
          <View style={styles.metaField}>
            <Text style={styles.metaLabel}>Número de autorización</Text>
            <Text style={styles.authValue}>
              {isPreview
                ? 'DOCUMENTO SIN VALIDEZ TRIBUTARIA'
                : rideValue(accessKey)}
            </Text>
          </View>
          <Meta
            label="Fecha y hora de autorización"
            value={isPreview ? 'NO AUTORIZADO' : authWhen}
          />
          <Meta
            label="Ambiente"
            value={isPreview ? 'PREVISUALIZACIÓN' : ambienteFromAccessKey(accessKey)}
          />
          <Meta label="Emisión" value="NORMAL" />
          <Text style={styles.metaLabel}>Clave de acceso</Text>
          <View style={styles.barcodeWrap}>
            {barcodeDataUrl && accessKey && !isPreview ? (
              <Image src={barcodeDataUrl} style={styles.barcode} />
            ) : null}
            <Text style={styles.claveText}>
              {isPreview
                ? 'DOCUMENTO EN BORRADOR / SIN VALIDEZ TRIBUTARIA'
                : rideValue(accessKey)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}
