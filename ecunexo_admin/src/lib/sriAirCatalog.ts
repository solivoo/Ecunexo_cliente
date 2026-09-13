/**
 * Catálogo Oficial de Conceptos de Retención en la Fuente de Impuesto a la Renta (AIR)
 * SRI Ecuador — ATS Versión 2.0 / Ficha Técnica SRI — Tabla 3.10 (Vigente desde 06/Agosto/2026).
 */

export interface SriAirConcept {
  code: string
  description: string
  defaultPercentage: number | null
  group: string
  notes?: string
}

export const SRI_AIR_CATALOG: SriAirConcept[] = [
  // -------------------------------------------------------------------------
  // BIENES MUEBLES, INSUMOS Y PRODUCCIÓN
  // -------------------------------------------------------------------------
  {
    code: '312',
    description: 'Transferencia de bienes muebles de naturaleza corporal',
    defaultPercentage: 2.0,
    group: 'Bienes Muebles e Insumos',
    notes: 'Aplica a compras de mercadería para la reventa, suministros de oficina, materiales y activos físicos tangibles.',
  },
  {
    code: '312A',
    description: 'Compras al productor de bienes de origen bioacuático, forestal (art. 27.1 LRTI)',
    defaultPercentage: 1.0,
    group: 'Bienes Muebles e Insumos',
  },
  {
    code: '312C',
    description: 'Compras al comercializador de bienes de origen bioacuático, forestal (art. 27.1 LRTI)',
    defaultPercentage: 1.75,
    group: 'Bienes Muebles e Insumos',
  },
  {
    code: '336',
    description: 'Venta de combustibles a comercializadoras (2 por mil)',
    defaultPercentage: 0.2,
    group: 'Bienes Muebles e Insumos',
  },
  {
    code: '337',
    description: 'Venta de combustibles a distribuidores (3 por mil)',
    defaultPercentage: 0.3,
    group: 'Bienes Muebles e Insumos',
  },
  {
    code: '338',
    description: 'Producción y venta local de banano',
    defaultPercentage: 1.5,
    group: 'Bienes Muebles e Insumos',
  },
  {
    code: '340',
    description: 'Impuesto único a la exportación de banano',
    defaultPercentage: 3.0,
    group: 'Bienes Muebles e Insumos',
  },
  {
    code: '343A',
    description: 'Energía eléctrica',
    defaultPercentage: 2.0,
    group: 'Bienes Muebles e Insumos',
  },
  {
    code: '343B',
    description: 'Actividades de construcción de obra material inmueble, urbanización, lotización',
    defaultPercentage: 2.0,
    group: 'Bienes Muebles e Insumos',
  },
  {
    code: '343C',
    description: 'Recepción de botellas plásticas no retornables de PET',
    defaultPercentage: 2.0,
    group: 'Bienes Muebles e Insumos',
  },
  {
    code: '344B',
    description: 'Adquisición de sustancias minerales dentro del territorio nacional',
    defaultPercentage: 2.0,
    group: 'Bienes Muebles e Insumos',
  },

  // -------------------------------------------------------------------------
  // SERVICIOS, MANO DE OBRA Y TRANSPORTE
  // -------------------------------------------------------------------------
  {
    code: '307',
    description: 'Servicios donde predomina la mano de obra',
    defaultPercentage: 3.0,
    group: 'Servicios y Transporte',
    notes: 'Mano de obra, reparaciones técnicas, mantenimiento correctivo/preventivo, limpieza, guardianía e infraestructura.',
  },
  {
    code: '310',
    description: 'Servicio de transporte privado de pasajeros o transporte público o privado de carga',
    defaultPercentage: 1.0,
    group: 'Servicios y Transporte',
    notes: 'Fletes, servicios de courier, mensajería, logística terrestre de carga y paquetería.',
  },
  {
    code: '309',
    description: 'Servicios prestados por medios de comunicación y agencias de publicidad',
    defaultPercentage: 3.0,
    group: 'Servicios y Transporte',
    notes: 'Pautas publicitarias, spots, campañas de marketing en medios digitales o tradicionales.',
  },
  {
    code: '311',
    description: 'Pagos a través de liquidación de compra (nivel cultural o rusticidad)',
    defaultPercentage: 3.0,
    group: 'Servicios y Transporte',
  },
  {
    code: '3440',
    description: 'Otras retenciones aplicables el 3% (incluye pago utilidades a extrabajadores)',
    defaultPercentage: 3.0,
    group: 'Servicios y Transporte',
    notes: 'Código residual para servicios gravados con tarifa general del 3%.',
  },
  {
    code: '3482',
    description: 'Comisiones a sociedades, nacionales o extranjeras residentes y establecimientos permanentes',
    defaultPercentage: 5.0,
    group: 'Servicios y Transporte',
    notes: 'Intermediación comercial y comisiones mercantiles facturadas por personas jurídicas residentes.',
  },

  // -------------------------------------------------------------------------
  // HONORARIOS PROFESIONALES E INTELECTO
  // -------------------------------------------------------------------------
  {
    code: '303',
    description: 'Honorarios profesionales y demás pagos por servicios relacionados con el título profesional',
    defaultPercentage: 10.0,
    group: 'Honorarios e Intelecto',
    notes: 'Servicios prestados por personas naturales tituladas (abogados, contadores, médicos, ingenieros, arquitectos).',
  },
  {
    code: '303A',
    description: 'Servicios profesionales prestados por sociedades residentes',
    defaultPercentage: 5.0,
    group: 'Honorarios e Intelecto',
    notes: 'Firmas jurídicas, consultoras, auditoras y empresas que prestan asesoría técnica especializada.',
  },
  {
    code: '304',
    description: 'Servicios predomina el intelecto no relacionados con el título profesional',
    defaultPercentage: 10.0,
    group: 'Honorarios e Intelecto',
  },
  {
    code: '304A',
    description: 'Comisiones y demás pagos por servicios predomina intelecto no relacionados con el título',
    defaultPercentage: 10.0,
    group: 'Honorarios e Intelecto',
  },
  {
    code: '304B',
    description: 'Pagos a notarios y registradores de la propiedad y mercantil',
    defaultPercentage: 10.0,
    group: 'Honorarios e Intelecto',
  },
  {
    code: '304C',
    description: 'Pagos a deportistas, entrenadores, árbitros y miembros del cuerpo técnico',
    defaultPercentage: 10.0,
    group: 'Honorarios e Intelecto',
  },
  {
    code: '304D',
    description: 'Pagos a artistas por sus actividades ejercidas como tales',
    defaultPercentage: 10.0,
    group: 'Honorarios e Intelecto',
  },
  {
    code: '304E',
    description: 'Honorarios y demás pagos por servicios de docencia',
    defaultPercentage: 10.0,
    group: 'Honorarios e Intelecto',
  },
  {
    code: '308',
    description: 'Utilización o aprovechamiento de la imagen o renombre (personas naturales, sociedades, "influencers")',
    defaultPercentage: 10.0,
    group: 'Honorarios e Intelecto',
  },

  // -------------------------------------------------------------------------
  // ARRENDAMIENTO Y SEGUROS
  // -------------------------------------------------------------------------
  {
    code: '320',
    description: 'Arrendamiento de bienes inmuebles',
    defaultPercentage: 10.0,
    group: 'Arrendamiento y Seguros',
    notes: 'Alquiler de locales comerciales, bodegas de almacenamiento, oficinas y terrenos.',
  },
  {
    code: '319',
    description: 'Cuotas de arrendamiento mercantil (prestado por sociedades), inclusive opción de compra',
    defaultPercentage: 2.0,
    group: 'Arrendamiento y Seguros',
  },
  {
    code: '322',
    description: 'Seguros y reaseguros (primas y cesiones)',
    defaultPercentage: 2.0,
    group: 'Arrendamiento y Seguros',
    notes: 'Pólizas de seguro vehicular, contra incendios, vida, salud y transporte contratadas con aseguradoras.',
  },

  // -------------------------------------------------------------------------
  // DERECHOS DE AUTOR, FRANQUICIAS Y PATENTES
  // -------------------------------------------------------------------------
  {
    code: '314A',
    description: 'Regalías por concepto de franquicias de acuerdo al Código INGENIOS - pago a personas naturales',
    defaultPercentage: 10.0,
    group: 'Propiedad Intelectual',
  },
  {
    code: '314B',
    description: 'Cánones, derechos de autor, marcas, patentes de acuerdo al Código INGENIOS – pago a personas naturales',
    defaultPercentage: 10.0,
    group: 'Propiedad Intelectual',
  },
  {
    code: '314C',
    description: 'Regalías por concepto de franquicias de acuerdo al Código INGENIOS - pago a sociedades',
    defaultPercentage: 10.0,
    group: 'Propiedad Intelectual',
  },
  {
    code: '314D',
    description: 'Cánones, derechos de autor, marcas, patentes de acuerdo al Código INGENIOS - pago a sociedades',
    defaultPercentage: 10.0,
    group: 'Propiedad Intelectual',
  },

  // -------------------------------------------------------------------------
  // REGÍMENES ESPECIALES (RIMPE) Y TARJETAS
  // -------------------------------------------------------------------------
  {
    code: '343',
    description: 'Otras retenciones aplicables el 1% (incluye régimen RIMPE - Emprendedores)',
    defaultPercentage: 1.0,
    group: 'Régimen RIMPE y Tasas 1%',
    notes: 'Compras de bienes o servicios a contribuyentes acogidos al régimen RIMPE categoría Emprendedor.',
  },
  {
    code: '344A',
    description: 'Pago local tarjeta de crédito/débito reportada por la Emisora / entidades financieras',
    defaultPercentage: 2.0,
    group: 'Régimen RIMPE y Tasas 1%',
  },

  // -------------------------------------------------------------------------
  // OPERACIONES FINANCIERAS, DIVIDENDOS Y GANANCIAS DE CAPITAL
  // -------------------------------------------------------------------------
  {
    code: '323',
    description: 'Rendimientos financieros pagados a naturales y sociedades (no a IFIs)',
    defaultPercentage: 3.0,
    group: 'Financiero y Capital',
  },
  {
    code: '323A',
    description: 'Rendimientos financieros depósitos Cta. Corriente',
    defaultPercentage: 3.0,
    group: 'Financiero y Capital',
  },
  {
    code: '323B1',
    description: 'Rendimientos financieros depósitos Cta. Ahorros Sociedades',
    defaultPercentage: 3.0,
    group: 'Financiero y Capital',
  },
  {
    code: '323E',
    description: 'Rendimientos financieros depósito a plazo fijo gravados',
    defaultPercentage: 3.0,
    group: 'Financiero y Capital',
  },
  {
    code: '323F',
    description: 'Rendimientos financieros operaciones de reporto repos',
    defaultPercentage: 3.0,
    group: 'Financiero y Capital',
  },
  {
    code: '323G',
    description: 'Inversiones (captaciones) rendimientos distintos de aquellos pagados a IFIs',
    defaultPercentage: 3.0,
    group: 'Financiero y Capital',
  },
  {
    code: '323H',
    description: 'Rendimientos financieros obligaciones',
    defaultPercentage: 3.0,
    group: 'Financiero y Capital',
  },
  {
    code: '323I',
    description: 'Rendimientos financieros bonos convertibles en acciones',
    defaultPercentage: 3.0,
    group: 'Financiero y Capital',
  },
  {
    code: '323M',
    description: 'Rendimientos financieros: Inversiones en títulos valores en renta fija gravados',
    defaultPercentage: 3.0,
    group: 'Financiero y Capital',
  },
  {
    code: '323P',
    description: 'Intereses pagados por entidades del sector público a favor de sujetos pasivos',
    defaultPercentage: 3.0,
    group: 'Financiero y Capital',
  },
  {
    code: '323Q',
    description: 'Otros intereses y rendimientos financieros gravados',
    defaultPercentage: 3.0,
    group: 'Financiero y Capital',
  },
  {
    code: '323S',
    description: 'Pagos y créditos en cuenta por el BCE y depósitos centralizados como intermediarios',
    defaultPercentage: 3.0,
    group: 'Financiero y Capital',
  },
  {
    code: '324A',
    description: 'Intereses en operaciones de crédito entre IFIs y entidades de economía popular y solidaria',
    defaultPercentage: 2.0,
    group: 'Financiero y Capital',
  },
  {
    code: '324B',
    description: 'Inversiones entre instituciones del sistema financiero y EPS',
    defaultPercentage: 2.0,
    group: 'Financiero y Capital',
  },
  {
    code: '324C',
    description: 'Pagos y créditos efectuados por el BCE entre instituciones del sistema financiero',
    defaultPercentage: 2.0,
    group: 'Financiero y Capital',
  },
  {
    code: '325',
    description: 'Anticipo dividendos',
    defaultPercentage: 25.0,
    group: 'Financiero y Capital',
  },
  {
    code: '325A',
    description: 'Préstamos accionistas, beneficiarios o partícipes residentes o establecidos en el Ecuador',
    defaultPercentage: 25.0,
    group: 'Financiero y Capital',
  },
  {
    code: '326',
    description: 'Dividendos distribuidos correspondientes al impuesto único art. 27 LRTI',
    defaultPercentage: 12.0,
    group: 'Financiero y Capital',
    notes: 'Tarifa del 12% o 14% según composición accionaria.',
  },
  {
    code: '327',
    description: 'Dividendos distribuidos a personas naturales residentes',
    defaultPercentage: 12.0,
    group: 'Financiero y Capital',
    notes: 'Tarifa del 12% o 14% según escala.',
  },
  {
    code: '333',
    description: 'Ganancia en enajenación de derechos de capital cotizados en bolsa del Ecuador',
    defaultPercentage: 10.0,
    group: 'Financiero y Capital',
  },
  {
    code: '334',
    description: 'Enajenación de derechos representativos de capital no cotizados en bolsa del Ecuador',
    defaultPercentage: 2.0,
    group: 'Financiero y Capital',
  },
  {
    code: '335',
    description: 'Loterías, rifas, pronósticos deportivos, apuestas y similares',
    defaultPercentage: 15.0,
    group: 'Financiero y Capital',
  },
  {
    code: '3480',
    description: 'Impuesto a la renta único sobre ingresos percibidos por operadores de pronósticos deportivos',
    defaultPercentage: 15.0,
    group: 'Financiero y Capital',
  },
  {
    code: '350',
    description: 'Otras autorretenciones (inciso 1 y 2 Art. 92.1 RLRTI)',
    defaultPercentage: 1.75,
    group: 'Financiero y Capital',
  },

  // -------------------------------------------------------------------------
  // OPERACIONES NO SUJETAS A RETENCIÓN (0.00%)
  // -------------------------------------------------------------------------
  {
    code: '332',
    description: 'Otras compras de bienes y servicios no sujetas a retención (incluye RIMPE - Negocios Populares)',
    defaultPercentage: 0.0,
    group: 'No Sujetas a Retención (0%)',
    notes: 'Aplica a proveedores bajo régimen RIMPE Negocio Popular (nota de venta o factura con leyenda). Tarifa 0%.',
  },
  {
    code: '332B',
    description: 'Compra de bienes inmuebles',
    defaultPercentage: 0.0,
    group: 'No Sujetas a Retención (0%)',
  },
  {
    code: '332C',
    description: 'Transporte público de pasajeros',
    defaultPercentage: 0.0,
    group: 'No Sujetas a Retención (0%)',
  },
  {
    code: '332D',
    description: 'Pagos en el país por transporte internacional de pasajeros o carga a aerolíneas o navieras',
    defaultPercentage: 0.0,
    group: 'No Sujetas a Retención (0%)',
  },
  {
    code: '332E',
    description: 'Valores entregados por las cooperativas de transporte a sus socios',
    defaultPercentage: 0.0,
    group: 'No Sujetas a Retención (0%)',
  },
  {
    code: '332F',
    description: 'Compraventa de divisas distintas al dólar de los Estados Unidos de América',
    defaultPercentage: 0.0,
    group: 'No Sujetas a Retención (0%)',
  },
  {
    code: '332G',
    description: 'Pagos con tarjeta de crédito',
    defaultPercentage: 0.0,
    group: 'No Sujetas a Retención (0%)',
  },
  {
    code: '332H',
    description: 'Pago al exterior tarjeta de crédito reportada por la Emisora, solo recap',
    defaultPercentage: 0.0,
    group: 'No Sujetas a Retención (0%)',
  },
  {
    code: '332I',
    description: 'Pago a través de convenio de débito (Clientes IFIs)',
    defaultPercentage: 0.0,
    group: 'No Sujetas a Retención (0%)',
  },
  {
    code: '323E2',
    description: 'Rendimientos financieros depósito a plazo fijo exentos',
    defaultPercentage: 0.0,
    group: 'No Sujetas a Retención (0%)',
  },
  {
    code: '323N',
    description: 'Rendimientos financieros Inversiones en títulos valores en renta fija exentos',
    defaultPercentage: 0.0,
    group: 'No Sujetas a Retención (0%)',
  },
  {
    code: '323O',
    description: 'Intereses y rendimientos pagados a bancos y entidades controladas por SB y SEPS',
    defaultPercentage: 0.0,
    group: 'No Sujetas a Retención (0%)',
  },
  {
    code: '323R',
    description: 'Otros intereses y rendimientos financieros exentos',
    defaultPercentage: 0.0,
    group: 'No Sujetas a Retención (0%)',
  },
  {
    code: '323T',
    description: 'Rendimientos financieros originados en la deuda pública ecuatoriana',
    defaultPercentage: 0.0,
    group: 'No Sujetas a Retención (0%)',
  },
  {
    code: '323U',
    description: 'Rendimientos financieros de títulos de 360 días o más para APP',
    defaultPercentage: 0.0,
    group: 'No Sujetas a Retención (0%)',
  },
  {
    code: '3250',
    description: 'Dividendos exentos (por no llegar a franja exenta o beneficio de otras leyes)',
    defaultPercentage: 0.0,
    group: 'No Sujetas a Retención (0%)',
  },
  {
    code: '328',
    description: 'Dividendos distribuidos a sociedades residentes',
    defaultPercentage: 0.0,
    group: 'No Sujetas a Retención (0%)',
  },
  {
    code: '329',
    description: 'Dividendos distribuidos a fideicomisos residentes',
    defaultPercentage: 0.0,
    group: 'No Sujetas a Retención (0%)',
  },
  {
    code: '331',
    description: 'Dividendos en acciones (capitalización de utilidades)',
    defaultPercentage: 0.0,
    group: 'No Sujetas a Retención (0%)',
  },

  // -------------------------------------------------------------------------
  // PAGOS AL EXTERIOR / NO RESIDENTES (SERIE 500)
  // -------------------------------------------------------------------------
  {
    code: '500',
    description: 'Pago a no residentes - Rentas Inmobiliarias',
    defaultPercentage: 25.0,
    group: 'Pagos al Exterior (No Residentes)',
  },
  {
    code: '501',
    description: 'Pago a no residentes - Beneficios / Servicios Empresariales',
    defaultPercentage: 25.0,
    group: 'Pagos al Exterior (No Residentes)',
  },
  {
    code: '501A',
    description: 'Pago a no residentes - Servicios técnicos, administrativos o de consultoría y regalías',
    defaultPercentage: 25.0,
    group: 'Pagos al Exterior (No Residentes)',
  },
  {
    code: '503',
    description: 'Pago a no residentes - Navegación Marítima y/o aérea',
    defaultPercentage: 25.0,
    group: 'Pagos al Exterior (No Residentes)',
  },
  {
    code: '504',
    description: 'Pago a no residentes - Dividendos distribuidos a personas naturales',
    defaultPercentage: 10.0,
    group: 'Pagos al Exterior (No Residentes)',
  },
  {
    code: '504A',
    description: 'Pago a no residentes - Dividendos a sociedades con beneficiario persona natural residente',
    defaultPercentage: 10.0,
    group: 'Pagos al Exterior (No Residentes)',
  },
]

/**
 * Busca un concepto AIR por su código oficial exacto.
 */
export function findAirConcept(code: string | null | undefined): SriAirConcept | undefined {
  if (!code) return undefined
  const normalized = code.trim().toUpperCase()
  return SRI_AIR_CATALOG.find((c) => c.code.toUpperCase() === normalized)
}

/**
 * Formato amigable para Selects y Tooltips: "312 — Transferencia de bienes muebles... (2.00%)"
 */
export function formatAirLabel(concept: SriAirConcept): string {
  const pctStr = concept.defaultPercentage != null ? ` (${concept.defaultPercentage.toFixed(2)}%)` : ''
  return `${concept.code} — ${concept.description}${pctStr}`
}
