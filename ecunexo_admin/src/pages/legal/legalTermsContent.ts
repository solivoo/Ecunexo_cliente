/**
 * Textos legales oficiales de EcuNexo bajo la legislación de la República del Ecuador:
 * - Ley Orgánica de Protección de Datos Personales (LOPDP, R.O. Suplemento 459, 26-mayo-2021) y su Reglamento General.
 * - Ley de Comercio Electrónico, Firmas Electrónicas y Mensajes de Datos (LCEFMD, Ley 2002-67).
 * - Código Orgánico Tributario y Ley de Régimen Tributario Interno (LRTI) / Ficha Técnica SRI Comprobantes Electrónicos.
 * - Código Orgánico Integral Penal (COIP, Art. 298 Defraudación Tributaria).
 * - Ley Orgánica de Defensa del Consumidor (LODC).
 */

export const LEGAL_LAST_UPDATED = '13 de septiembre de 2026'

export interface LegalSectionItem {
  id: string
  title: string
  content: string[]
}

export const TERMS_AND_CONDITIONS_SECTIONS: LegalSectionItem[] = [
  {
    id: 'objeto-aceptacion',
    title: '1. Objeto y Aceptación de los Términos',
    content: [
      'El presente contrato regula el acceso y uso de la plataforma de software como servicio (SaaS) "EcuNexo", provista para la gestión empresarial, inventario, facturación electrónica y cumplimiento tributario ante el Servicio de Rentas Internas (SRI) del Ecuador.',
      'Al crear una cuenta, activar una licencia, iniciar sesión o utilizar cualquier funcionalidad de EcuNexo, la persona natural o jurídica (el "Usuario" o "Suscriptor") declara haber leído, comprendido y aceptado en su totalidad estos Términos y Condiciones, obligándose a su estricto cumplimiento conforme a la Ley de Comercio Electrónico, Firmas Electrónicas y Mensajes de Datos de la República del Ecuador.',
      'Si el Usuario actúa en representación de una sociedad mercantil, persona jurídica o establecimiento comercial, declara contar con plenos poderes de representación legal para vincularla a este contrato.',
    ],
  },
  {
    id: 'naturaleza-servicio',
    title: '2. Naturaleza del Servicio y Rol Tecnológico',
    content: [
      'EcuNexo es una plataforma exclusivamente tecnológica y de intermediación informática auxiliar que facilita el procesamiento de transacciones, inventarios, emisión de proformas y estructuración de archivos XML de comprobantes electrónicos (facturas, notas de crédito, notas de débito, retenciones en la fuente y liquidaciones de compra).',
      'EcuNexo NO es un estudio contable, firma de auditoría, asesor tributario ni entidad certificadora de firma electrónica. El uso de la plataforma no reemplaza la obligación legal del Usuario de contar con profesionales contables calificados ni exime al contribuyente de sus deberes formales y sustanciales ante la Administración Tributaria.',
    ],
  },
  {
    id: 'responsabilidad-tributaria',
    title: '3. Sujeto Pasivo Tributario y Responsabilidad Exclusiva ante el SRI',
    content: [
      'Conforme al Código Orgánico Tributario y la Ley de Régimen Tributario Interno (LRTI), el único sujeto pasivo de las obligaciones tributarias sustanciales y formales es el Usuario contribuyente emisor.',
      'El Usuario es el único y exclusivo responsable legal, civil, administrativo y tributario por:',
      'a) La veracidad, integridad, exactitud y legitimidad de los datos ingresados en la plataforma, incluyendo precios, tarifas de IVA (15%, 5%, 0%, exento), porcentajes de retención de Impuesto a la Renta e IVA, códigos de sustento de crédito tributario y categorizaciones contables.',
      'b) La emisión oportuna de facturas, retenciones y liquidaciones dentro de los plazos perentorios establecidos por las resoluciones del SRI.',
      'c) La verificación y custodia de que cada comprobante emitido obtenga el estado de "AUTORIZADO" por el SRI.',
      'd) El pago oportuno de tributos, retenciones practicadas, declaraciones de IVA y presentación de Anexos Transaccionales Simplificados (ATS).',
    ],
  },
  {
    id: 'firma-electronica',
    title: '4. Custodia y Uso de la Firma Electrónica (.p12 / .pfx)',
    content: [
      'De conformidad con los artículos 14, 17 y 20 de la Ley de Comercio Electrónico, Firmas Electrónicas y Mensajes de Datos del Ecuador, la firma electrónica tiene idéntica validez jurídica que la firma manuscrita, siendo el titular o custodio el único responsable de su uso y de mantener la debida confidencialidad de la clave privada.',
      'EcuNexo implementa salvaguardas técnicas de nivel bancario mediante cifrado autenticado AES-256-GCM para proteger los bytes del archivo .p12 y la contraseña asociada en la base de datos PostgreSQL.',
      'Sin embargo, el Usuario expresamente reconoce y acepta que:',
      'a) La firma electrónica se utiliza única y exclusivamente bajo las instrucciones directas del Usuario al momento de firmar y emitir comprobantes autorizados ante el SRI.',
      'b) El Usuario es el único responsable de asegurar que el certificado .p12 se encuentre vigente, emitido a nombre del contribuyente o representante legal acreditado ante una Entidad de Certificación autorizada (BCE, Security Data, ANFAC, Uanataca, Consejo de la Judicatura, etc.).',
      'c) EcuNexo no se hace responsable por firmas electrónicas revocadas, suspendidas, caducadas o utilizadas por personal no autorizado a quien el Usuario haya concedido credenciales en la plataforma.',
    ],
  },
  {
    id: 'exoneracion-webservices-sri',
    title: '5. Exoneración por Intermitencias de Servicios del SRI y de Terceros',
    content: [
      'La autorización de comprobantes electrónicos depende de los WebServices SOAP oficiales provistos por el Servicio de Rentas Internas del Ecuador (servidores de Recepción y Autorización).',
      'EcuNexo no garantiza la disponibilidad ininterrumpida, velocidad de respuesta ni funcionamiento continuo de los sistemas del SRI.',
      'En consecuencia, EcuNexo queda total y expresamente exento de cualquier responsabilidad por retrasos, rechazos, imposibilidad de autorización, demoras en la obtención de RIDE o generación de contingencias tributarias que deriven de:',
      'a) Caídas, mantenimientos o saturación de los servidores web del SRI.',
      'b) Fallas en las conexiones de Internet del Usuario o de sus proveedores de telecomunicaciones.',
      'c) Incompatibilidades por cambios normativos imprevistos en la Ficha Técnica del SRI no notificados con antelación razonable.',
    ],
  },
  {
    id: 'clausula-indemnidad',
    title: '6. Cláusula de Indemnidad (Hold Harmless) frente a Multas y Sanciones Estatales',
    content: [
      'El Usuario se compromete de manera irrevocable a mantener indemne, defender y deslindar a EcuNexo, sus accionistas, directores, representantes legales, empleados, desarrolladores y agentes de cualquier reclamo, demanda, investigación administrativa, glosa, determinación tributaria, multa pecuniaria, clausura de local o sanción emitida por el SRI, el Ministerio del Trabajo, la Superintendencia de Compañías, la Superintendencia de Protección de Datos Personales, el IESS o cualquier otra autoridad judicial o administrativa del Estado ecuatoriano, derivada de:',
      'a) Declaraciones tributarias erróneas, omisión de entrega de comprobantes o inconsistencias en los montos facturados o retenidos.',
      'b) Utilización indebida o fraudulenta de firmas electrónicas.',
      'c) Infracciones a la normativa de defensa del consumidor o venta de productos no autorizados o ilícitos.',
      'd) Violación de los derechos de propiedad intelectual o de datos personales de terceros cargados por el Usuario en la plataforma.',
    ],
  },
  {
    id: 'limite-responsabilidad',
    title: '7. Límite Cuantitativo de Responsabilidad (Liability Cap)',
    content: [
      'En la máxima medida permitida por el ordenamiento jurídico ecuatoriano, la responsabilidad acumulada total de EcuNexo frente al Usuario por cualquier causa, reclamo o acción contractual o extracontractual, no superará en ningún caso el valor equivalente a las tarifas efectivamente pagadas por el Usuario por el servicio SaaS en los tres (3) meses anteriores al hecho causante.',
      'En ningún caso EcuNexo será responsable por lucro cesante, pérdida de ingresos, pérdida de oportunidades de negocio, daños punitivos, daño emergente indirecto o multas impuestas por entidades públicas.',
    ],
  },
  {
    id: 'legislacion-jurisdiccion',
    title: '8. Legislación Aplicable y Resolución de Controversias',
    content: [
      'Estos Términos y Condiciones se rigen e interpretan exclusivamente conforme a las leyes de la República del Ecuador.',
      'Cualquier controversia o discrepancia derivada del presente contrato que no pueda resolverse de mutuo acuerdo en un plazo de treinta (30) días, será sometida al procedimiento de mediación y arbitraje en el Centro de Arbitraje y Mediación de la Cámara de Comercio de Quito (o la correspondiente al domicilio principal del proveedor del servicio), conforme a la Ley de Arbitraje y Mediación del Ecuador.',
    ],
  },
]

export const PRIVACY_POLICY_SECTIONS: LegalSectionItem[] = [
  {
    id: 'marco-legal-lopdp',
    title: '1. Marco Legal y Ámbito de Aplicación (LOPDP Ecuador)',
    content: [
      'La presente Política de Privacidad describe el tratamiento de datos personales realizado a través de la plataforma EcuNexo, en estricto cumplimiento de la Ley Orgánica de Protección de Datos Personales de la República del Ecuador (LOPDP, publicada en el R.O. Suplemento 459 de 26 de mayo de 2021) y su Reglamento General.',
      'Esta política aplica a todos los titulares de datos personales que interactúan con la plataforma, incluyendo usuarios administradores, operadores de tenant, clientes y proveedores cuyos datos son procesados mediante el sistema.',
    ],
  },
  {
    id: 'roles-tratamiento',
    title: '2. Delimitación de Roles: Responsable vs. Encargado del Tratamiento',
    content: [
      'Conforme a los artículos 4 y 48 de la LOPDP, se establece expresamente la siguiente distinción de roles:',
      'a) EcuNexo como Responsable del Tratamiento: Respecto a los datos de registro, facturación de la suscripción SaaS, correos corporativos de acceso y credenciales de los Usuarios directos de la plataforma.',
      'b) EcuNexo como Encargado del Tratamiento: Respecto a los datos personales de terceros (clientes finales, compradores, proveedores, dependientes) ingresados por el Usuario/Tenant en los módulos de facturación, compras, inventarios y clientes.',
      'El Usuario/Tenant actúa en calidad de Responsable del Tratamiento respecto a dichos terceros y garantiza que cuenta con la debida base de legitimación (consentimiento expreso, relación contractual previa o cumplimiento de mandato legal tributario del SRI) para recopilar e incorporar dichos datos en EcuNexo.',
    ],
  },
  {
    id: 'datos-recopilados',
    title: '3. Categorías de Datos Personales Objeto de Tratamiento',
    content: [
      'EcuNexo recopila y procesa las siguientes categorías de datos estrictamente necesarios para la ejecución del servicio:',
      'a) Datos de Identificación y Contacto del Usuario: Nombres, apellidos, cédula de identidad o RUC, correo electrónico, número telefónico y cargo en la organización.',
      'b) Datos Fiscales y Tributarios: Razón social, nombre comercial, dirección del establecimiento, número de resolución SRI, certificados de firma electrónica (.p12) y comprobantes electrónicos emitidos o recibidos.',
      'c) Datos de Clientes y Proveedores (ingresados por el Tenant): RUC/Cédula, nombre/razón social, correo para entrega de comprobantes electrónicos, dirección y detalle de consumos o adquisiciones.',
      'd) Datos Técnicos y de Registro: Direcciones IP, registros de acceso (logs), agente de usuario y huellas de tiempo con fines de trazabilidad de seguridad y auditoría.',
    ],
  },
  {
    id: 'finalidades-legitimacion',
    title: '4. Finalidades y Bases de Legitimación del Tratamiento',
    content: [
      'Los datos personales son tratados con las siguientes finalidades y bases jurídicas (Art. 7 LOPDP):',
      'a) Ejecución Contractual: Prestación del servicio SaaS, autenticación de sesiones, control de límites por plan de suscripción y soporte técnico.',
      'b) Cumplimiento de Obligaciones Legales y Tributarias: Generación, firmado y transmisión de comprobantes electrónicos conforme a las resoluciones del Servicio de Rentas Internas (SRI).',
      'c) Seguridad y Prevención de Fraude: Detección de intrusiones, auditoría de accesos y prevención de uso ilícito de firmas electrónicas.',
    ],
  },
  {
    id: 'seguridad-cifrado',
    title: '5. Medidas de Seguridad Técnicas y Organizativas (Art. 41 LOPDP)',
    content: [
      'EcuNexo aplica rigurosos estándares de seguridad de la información para proteger la confidencialidad, integridad y disponibilidad de los datos personales:',
      'a) Cifrado Autenticado AES-256-GCM: Los certificados digitales de firma electrónica (.p12) y sus contraseñas se almacenan cifrados en reposo en la base de datos PostgreSQL, sin que jamás se almacenen en texto claro ni en archivos temporales no protegidos.',
      'b) Cifrado en Tránsito: Todo el tráfico entre el navegador del usuario, la API y los servicios externos se realiza mediante protocolos seguros TLS 1.3 con certificados SSL/TLS válidos.',
      'c) Hashing Criptográfico de Credenciales: Las contraseñas de los usuarios se almacenan aplicando algoritmos de derivación de claves criptográficas seguras (PBKDF2/Argon2 con sal única por usuario).',
      'd) Segregación Lógica Multi-Tenant: Los datos de cada empresa están aislados lógicamente, impidiendo el acceso no autorizado de un tenant a la información de otro.',
    ],
  },
  {
    id: 'derechos-arco',
    title: '6. Ejercicio de Derechos del Titular (ARCO y Portabilidad)',
    content: [
      'De acuerdo con los artículos 21 al 26 de la LOPDP, los titulares de datos personales tienen derecho a ejercer sus derechos de Acceso, Rectificación, Actualización, Eliminación, Oposición y Portabilidad.',
      'Para ejercer estos derechos:',
      'a) Si usted es usuario directo de EcuNexo: Puede solicitar el ejercicio de sus derechos enviando una comunicación escrita con copia de su documento de identidad a: privacidad@ecunexo.com.',
      'b) Si usted es un cliente o consumidor final de una empresa que usa EcuNexo: Debe dirigir su requerimiento directamente a la empresa emisora del comprobante (Responsable del Tratamiento). EcuNexo canalizará cualquier solicitud recibida al respectivo Tenant.',
      'Nota legal: La eliminación o supresión de datos no aplicará respecto a comprobantes tributarios que deban conservarse durante el período de prescripción legal establecido en el Código Orgánico Tributario (7 años).',
    ],
  },
  {
    id: 'conservacion-datos',
    title: '7. Plazos de Conservación de la Información',
    content: [
      'Los datos personales se conservarán mientras dure la relación contractual con el Suscriptor y, posteriormente, durante los plazos legalmente exigibles por la normativa fiscal ecuatoriana (mínimo 7 años para registros y comprobantes contables conforme al Art. 55 del Código Tributario), tras lo cual serán eliminados o anonimizados de forma segura.',
    ],
  },
  {
    id: 'modificaciones-contacto',
    title: '8. Modificaciones a la Política y Contacto',
    content: [
      'EcuNexo se reserva el derecho de actualizar la presente Política de Privacidad para adecuarla a reformas normativas o mejoras técnicas. Toda modificación sustancial será notificada a través del portal de acceso o vía correo electrónico a los administradores de tenant.',
      'Para consultas relativas a la privacidad o al Delegado de Protección de Datos Personales (DPO), contáctenos en: soporte@ecunexo.com o privacidad@ecunexo.com.',
    ],
  },
]
