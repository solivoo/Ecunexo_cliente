import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { formatDateTime } from '@/lib/formatDate'
import { damageLevelLabel, DamageLevel, type RepairDispatchDto } from '@/types/repairsApi'
import { buildRidePalette } from '@/pages/facturacion/rideFacturaPalette'

export type DispatchPdfCompanyInfo = {
  name: string
  taxId?: string | null
  address?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  logoUrl?: string | null
  primaryColorHex?: string | null
}

export type DispatchDeliveryNotePdfProps = {
  dispatch: RepairDispatchDto
  company?: DispatchPdfCompanyInfo | null
  batchNumber?: string | null
  customerName?: string | null
  contractReference?: string | null
  barcodeDataUrl?: string | null
  qrVerificationUrl?: string | null
  issuerName?: string | null
  issuerRole?: string | null
}

function createDispatchStyles(primaryColorHex?: string | null) {
  const palette = buildRidePalette(primaryColorHex)
  return StyleSheet.create({
    page: {
      paddingTop: 18,
      paddingBottom: 24,
      paddingHorizontal: 24,
      fontSize: 8,
      fontFamily: 'Helvetica',
      color: '#0f172a',
      backgroundColor: '#ffffff',
    },
    topAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 4,
      backgroundColor: palette.accent,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
      paddingBottom: 6,
      borderBottomWidth: 1.5,
      borderBottomColor: palette.accent,
    },
    companyBox: {
      maxWidth: 460,
    },
    logo: {
      height: 32,
      maxWidth: 160,
      objectFit: 'contain',
      marginBottom: 3,
    },
    companyName: {
      fontSize: 11,
      fontFamily: 'Helvetica-Bold',
      color: '#0f172a',
      marginBottom: 2,
    },
    companyMeta: {
      fontSize: 7,
      color: '#475569',
      lineHeight: 1.25,
    },
    docBox: {
      width: 250,
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 4,
      backgroundColor: '#f8fafc',
      padding: 6,
      alignItems: 'center',
    },
    docTitle: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: palette.accentDeep,
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    docNumber: {
      fontSize: 11,
      fontFamily: 'Helvetica-Bold',
      color: '#0f172a',
      marginBottom: 3,
    },
    docMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      fontSize: 7,
      marginBottom: 1.5,
    },
    docMetaLabel: {
      color: '#64748b',
      fontFamily: 'Helvetica-Bold',
    },
    docMetaVal: {
      color: '#0f172a',
    },
    barcode: {
      height: 20,
      width: 170,
      marginTop: 2,
      objectFit: 'contain',
    },
    sectionRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
    },
    card: {
      flex: 1,
      borderWidth: 0.8,
      borderColor: '#e2e8f0',
      borderRadius: 4,
      backgroundColor: '#fbfcfd',
      padding: 6,
    },
    cardHeader: {
      fontSize: 7.5,
      fontFamily: 'Helvetica-Bold',
      color: palette.accentDeep,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      borderBottomWidth: 0.6,
      borderBottomColor: '#e2e8f0',
      paddingBottom: 2.5,
      marginBottom: 3.5,
    },
    cardRow: {
      flexDirection: 'row',
      marginBottom: 2,
      fontSize: 7,
    },
    cardLabel: {
      width: '40%',
      fontFamily: 'Helvetica-Bold',
      color: '#64748b',
    },
    cardValue: {
      width: '60%',
      color: '#0f172a',
    },
    tableContainer: {
      borderWidth: 0.8,
      borderColor: '#cbd5e1',
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 7,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: palette.accentDeep,
      color: palette.onAccent,
      paddingVertical: 4,
      paddingHorizontal: 6,
      fontSize: 7.2,
      fontFamily: 'Helvetica-Bold',
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 0.5,
      borderBottomColor: '#e2e8f0',
      paddingVertical: 3.2,
      paddingHorizontal: 6,
      fontSize: 7,
    },
    tableRowAlt: {
      backgroundColor: '#f8fafc',
    },
    colIdx: { width: '4%', textAlign: 'center' },
    colSerial: { width: '24%', fontFamily: 'Helvetica-Bold' },
    colBrand: { width: '14%' },
    colModel: { width: '24%' },
    colDamage: { width: '18%' },
    colStatus: { width: '16%', textAlign: 'right' },
    tableFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: palette.accentSoft,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderTopWidth: 0.8,
      borderTopColor: palette.hairline,
      fontSize: 7.5,
      fontFamily: 'Helvetica-Bold',
      color: palette.accentDeep,
    },
    notesBox: {
      borderWidth: 0.8,
      borderColor: '#e2e8f0',
      borderRadius: 4,
      padding: 5,
      backgroundColor: '#ffffff',
      marginBottom: 7,
    },
    notesTitle: {
      fontSize: 7.2,
      fontFamily: 'Helvetica-Bold',
      color: '#334155',
      marginBottom: 1.5,
    },
    notesContent: {
      fontSize: 6.8,
      color: '#475569',
      lineHeight: 1.25,
    },
    clauseBox: {
      borderWidth: 0.6,
      borderColor: '#cbd5e1',
      borderRadius: 4,
      backgroundColor: '#f8fafc',
      padding: 5,
      marginBottom: 16,
    },
    clauseText: {
      fontSize: 6.5,
      color: '#475569',
      lineHeight: 1.25,
      textAlign: 'justify',
    },
    signaturesArea: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 60,
      marginTop: 6,
      marginBottom: 10,
    },
    signatureBox: {
      flex: 1,
      alignItems: 'center',
    },
    signSpace: {
      height: 48,
      width: 210,
      marginBottom: 4,
    },
    signLine: {
      width: 210,
      borderTopWidth: 1,
      borderTopColor: '#334155',
      marginBottom: 6,
    },
    signTitle: {
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: palette.accentDeep,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 2.5,
    },
    signName: {
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: '#0f172a',
      marginBottom: 1.5,
    },
    signSub: {
      fontSize: 7,
      color: '#475569',
      marginBottom: 1.5,
    },
    signRole: {
      fontSize: 6.8,
      color: '#64748b',
      textTransform: 'uppercase',
      marginTop: 2,
    },
    footer: {
      position: 'absolute',
      bottom: 10,
      left: 24,
      right: 24,
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 0.6,
      borderTopColor: '#e2e8f0',
      paddingTop: 3,
      fontSize: 6.2,
      color: '#94a3b8',
    },
  })
}

export function DispatchDeliveryNotePdf({
  dispatch,
  company,
  batchNumber,
  customerName,
  contractReference,
  barcodeDataUrl,
  qrVerificationUrl,
  issuerName,
  issuerRole,
}: DispatchDeliveryNotePdfProps) {
  const styles = createDispatchStyles(company?.primaryColorHex)
  const finalCustomer = customerName || dispatch.customerName || 'Cliente Corporativo'
  const finalBatch = batchNumber || dispatch.batchNumber || 'N/A'
  const issuedDate = dispatch.dispatchedAt ? formatDateTime(dispatch.dispatchedAt) : formatDateTime(dispatch.createdAt)
  const items = dispatch.items ?? []

  type PrintableItem = {
    id: string
    serialNumber: string
    brand: string
    model: string
    damageLevel: DamageLevel
    statusLabel: string
  }

  const printableEquipments: PrintableItem[] = items.map((item, idx) => {
    if (item.equipment) {
      return {
        id: item.equipment.id || item.id || String(idx),
        serialNumber: item.equipment.serialNumber || 'S/N',
        brand: item.equipment.brand || '—',
        model: item.equipment.model || '—',
        damageLevel: (item.equipment.damageLevel as DamageLevel) ?? DamageLevel.Level1,
        statusLabel: 'Listo / Despacho',
      }
    }
    const raw = item as unknown as Record<string, unknown>
    return {
      id: item.equipmentId || item.id || String(idx),
      serialNumber: String(
        raw.serialNumber ||
          raw.equipmentSerialNumber ||
          `EQ-${(item.equipmentId || item.id || '').slice(0, 8)}`
      ),
      brand: String(raw.brand || raw.equipmentBrand || '—'),
      model: String(raw.model || raw.equipmentModel || '—'),
      damageLevel: (typeof raw.damageLevel === 'number'
        ? raw.damageLevel
        : DamageLevel.Level1) as DamageLevel,
      statusLabel: 'Listo / Despacho',
    }
  })

  return (
    <Document
      title={`Acta-${dispatch.dispatchNumber}`}
      author={company?.name || 'EcuNexo Taller'}
      subject={`Acta de Despacho y Entrega de Equipos - ${dispatch.dispatchNumber}`}
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.topAccent} />

        {/* Encabezado Corporativo Dinámico Horizontal */}
        <View style={styles.header}>
          <View style={styles.companyBox}>
            {company?.logoUrl && (
              <Image src={company.logoUrl} style={styles.logo} />
            )}
            <Text style={styles.companyName}>
              {company?.name || 'CENTRO INTEGRAL DE REPARACIONES Y REACONDICIONAMIENTO'}
            </Text>
            {company?.taxId && (
              <Text style={styles.companyMeta}>RUC: {company.taxId}</Text>
            )}
            {company?.address && (
              <Text style={styles.companyMeta}>Dirección: {company.address}</Text>
            )}
            {(company?.contactPhone || company?.contactEmail) && (
              <Text style={styles.companyMeta}>
                {[company.contactPhone, company.contactEmail].filter(Boolean).join(' · ')}
              </Text>
            )}
          </View>

          <View style={styles.docBox}>
            <Text style={styles.docTitle}>
              {dispatch.exitType === 1
                ? 'Acta de Devolución — Irreparable'
                : dispatch.exitType === 2
                  ? 'Acta de Retiro Anticipado'
                  : dispatch.exitType === 3
                    ? 'Acta de Rechazo Técnico'
                    : 'Acta de Entrega / Despacho'}
            </Text>
            <Text style={styles.docNumber}>{dispatch.dispatchNumber}</Text>
            <View style={styles.docMetaRow}>
              <Text style={styles.docMetaLabel}>Fecha salida:</Text>
              <Text style={styles.docMetaVal}>{issuedDate}</Text>
            </View>
            <View style={styles.docMetaRow}>
              <Text style={styles.docMetaLabel}>Tipo de salida:</Text>
              <Text style={styles.docMetaVal}>
                {dispatch.exitType === 1
                  ? 'Devolución Irreparable'
                  : dispatch.exitType === 2
                    ? 'Retiro por Cliente'
                    : dispatch.exitType === 3
                      ? 'Rechazo Técnico'
                      : 'Equipos Reparados'}
              </Text>
            </View>
            <View style={styles.docMetaRow}>
              <Text style={styles.docMetaLabel}>Estado acta:</Text>
              <Text style={styles.docMetaVal}>
                {dispatch.status === 2 ? 'FACTURADO' : 'CONFIRMADO'}
              </Text>
            </View>
            <View style={styles.docMetaRow}>
              <Text style={styles.docMetaLabel}>Total equipos:</Text>
              <Text style={styles.docMetaVal}>{printableEquipments.length} unidades</Text>
            </View>
            {barcodeDataUrl && (
              <Image src={barcodeDataUrl} style={styles.barcode} />
            )}
          </View>
        </View>

        {/* 3 Cajas de Información: Cliente, Operador de Transporte y Emisor */}
        <View style={styles.sectionRow}>
          {/* Tarjeta 1: Cliente & Lote */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>1. Cliente Corporativo y Lote Origen</Text>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Cliente Destino:</Text>
              <Text style={styles.cardValue}>{finalCustomer}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Lote Operativo:</Text>
              <Text style={styles.cardValue}>{finalBatch}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Orden / Contrato:</Text>
              <Text style={styles.cardValue}>{contractReference || 'No referenciado'}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Motivo de Entrega:</Text>
              <Text style={styles.cardValue}>Reacondicionamiento concluido en taller</Text>
            </View>
          </View>

          {/* Tarjeta 2: Operador de Transporte & Retiro */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>2. Operador de Transporte y Retiro</Text>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Operador / Retira:</Text>
              <Text style={styles.cardValue}>{dispatch.carrierName || 'No registrado'}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Cédula / Identificación:</Text>
              <Text style={styles.cardValue}>{dispatch.carrierDocument || 'No registrado'}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Placa de Vehículo:</Text>
              <Text style={styles.cardValue}>{dispatch.carrierVehiclePlate || 'No registrada'}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Custodia de Salida:</Text>
              <Text style={styles.cardValue}>Entrega conforme en rampa de despacho</Text>
            </View>
          </View>

          {/* Tarjeta 3: Emisor Autorizado */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>3. Emisor Autorizado de Salida</Text>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Emisor del Despacho:</Text>
              <Text style={styles.cardValue}>{issuerName || 'Responsable de Taller'}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Cargo / Rol:</Text>
              <Text style={styles.cardValue}>{issuerRole || 'Supervisor de Taller'}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Empresa Emisora:</Text>
              <Text style={styles.cardValue}>{company?.name || 'Taller Autorizado'}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Fecha de Certificación:</Text>
              <Text style={styles.cardValue}>{issuedDate}</Text>
            </View>
          </View>
        </View>

        {/* Tabla Horizontal Detallada de Equipos Despachados */}
        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={styles.colIdx}>#</Text>
            <Text style={styles.colSerial}>Nº DE SERIE</Text>
            <Text style={styles.colBrand}>MARCA</Text>
            <Text style={styles.colModel}>MODELO</Text>
            <Text style={styles.colDamage}>NIVEL DE DAÑO</Text>
            <Text style={styles.colStatus}>ESTADO</Text>
          </View>

          {printableEquipments.length > 0 ? (
            printableEquipments.map((eq, idx) => (
              <View
                key={eq.id || idx}
                style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={styles.colIdx}>{idx + 1}</Text>
                <Text style={styles.colSerial}>{eq.serialNumber}</Text>
                <Text style={styles.colBrand}>{eq.brand || '—'}</Text>
                <Text style={styles.colModel}>{eq.model || '—'}</Text>
                <Text style={styles.colDamage}>{damageLevelLabel(eq.damageLevel)}</Text>
                <Text style={styles.colStatus}>{eq.statusLabel}</Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}>
              <Text style={{ flex: 1, textAlign: 'center', color: '#64748b' }}>
                No se registraron equipos asociados a esta acta.
              </Text>
            </View>
          )}

          <View style={styles.tableFooter}>
            <Text>TOTAL EQUIPOS ENTREGADOS Y DESPACHADOS</Text>
            <Text>{printableEquipments.length} UNIDADES</Text>
          </View>
        </View>

        {/* Observaciones o Notas */}
        {dispatch.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesTitle}>Observaciones registradas en el despacho:</Text>
            <Text style={styles.notesContent}>{dispatch.notes}</Text>
          </View>
        )}

        {/* Cláusula Legal de Traspaso de Custodia (evita 'conductor') */}
        <View style={styles.clauseBox}>
          <Text style={styles.clauseText}>
            DECLARACIÓN DE CONFORMIDAD Y TRASPASO DE CUSTODIA: Por medio de la firma del presente documento,
            el operador de transporte o la persona comisionada para el retiro deja constancia de haber revisado y
            recibido a entera satisfacción los equipos detallados en la presente acta en las condiciones
            físicas y técnicas descritas. A partir del retiro de las instalaciones del taller, la
            responsabilidad sobre la custodia y movilización recae en el operador y el cliente comitente.
          </Text>
        </View>

        {/* Bloque de Firmas: Operador de Transporte y Emisor */}
        <View style={styles.signaturesArea}>
          {/* Firma Operador de Transporte */}
          <View style={styles.signatureBox}>
            <View style={styles.signSpace} />
            <View style={styles.signLine} />
            <Text style={styles.signTitle}>Operador de Transporte</Text>
            <Text style={styles.signName}>{dispatch.carrierName || '_________________________________'}</Text>
            <Text style={styles.signSub}>
              C.I. / RUC: {dispatch.carrierDocument || '___________________'}
            </Text>
            {dispatch.carrierVehiclePlate && (
              <Text style={styles.signSub}>Vehículo: {dispatch.carrierVehiclePlate}</Text>
            )}
            <Text style={styles.signRole}>Firma del Operador / Huella</Text>
          </View>

          {/* Firma Emisor Autorizado */}
          <View style={styles.signatureBox}>
            <View style={styles.signSpace} />
            <View style={styles.signLine} />
            <Text style={styles.signTitle}>Emisor Autorizado</Text>
            <Text style={styles.signName}>{issuerName || 'Responsable de Control y Taller'}</Text>
            <Text style={styles.signSub}>{company?.name || 'Taller Autorizado EcuNexo'}</Text>
            <Text style={styles.signSub}>
              {issuerRole ? `Rol: ${issuerRole} · Fecha: ${issuedDate}` : `Fecha: ${issuedDate}`}
            </Text>
            <Text style={styles.signRole}>Firma del Emisor / Sello Oficial</Text>
          </View>
        </View>

        {/* Pie de Página con Certificación QR y Hash */}
        <View style={styles.footer}>
          <Text>
            Certificación Digital SHA-256: {dispatch.verificationHash.slice(0, 48)}...
          </Text>
          <Text>
            Verificación pública: {qrVerificationUrl || `ecunexo.com/verificar/despacho/${dispatch.verificationHash}`}
          </Text>
          <Text>EcuNexo Taller B2B</Text>
        </View>
      </Page>
    </Document>
  )
}
