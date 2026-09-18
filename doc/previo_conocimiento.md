Sí. Si tu objetivo es programar el ATS dentro de un sistema contable web, no te conviene aprenderlo como “llenar un formulario”. Debes entender primero qué representa cada transacción tributaria y recién después aprender el XML.

Revisé la documentación vigente publicada por el SRI. A septiembre de 2026, el SRI publica el ATS 1.18.0, el Catálogo ATS actualizado el 6 de agosto de 2026, la ficha técnica, el XSD at.xsd y ejemplos XML/Excel. Esos documentos deberían ser la fuente de verdad de tu software.

1. Primero entiende qué es realmente el ATS

El Anexo Transaccional Simplificado — ATS es un reporte detallado de las operaciones tributarias realizadas durante un período.

No es exactamente la contabilidad.

Piensa así:

DOCUMENTOS
   ↓
Facturas / NC / ND / Retenciones / Importaciones / Exportaciones
   ↓
REGISTRO TRIBUTARIO
   ↓
IVA / Renta / Retenciones / Sustento tributario
   ↓
CONTABILIDAD
   ↓
Asientos / Libro mayor
   ↓
DECLARACIONES
   ↓
IVA / Retenciones
   ↓
ATS

El propio SRI define los anexos como información detallada que sirve para sustentar declaraciones, incluyendo compras, ventas, importaciones, exportaciones y retenciones.

Para desarrollar software, esta distinción es muy importante:

el ATS debería generarse a partir de tus documentos tributarios normalizados, no directamente de los asientos contables.

2. Conceptos que debes aprender, en este orden
1. RUC e identificación de contribuyentes

Debes comprender:

RUC.
Cédula.
Pasaporte.
Identificación del exterior.
Persona natural.
Sociedad.
Residente / no residente.
Parte relacionada.
Establecimiento y punto de emisión.

Por ejemplo:

RUC proveedor:
0999999999001

Establecimiento:
001

Punto emisión:
002

Secuencial:
000000125

Tu base de datos debería separar esos conceptos.

No hagas simplemente:

numero_factura = "001-002-000000125"

Mejor:

establecimiento = "001"
punto_emision   = "002"
secuencial      = "000000125"

porque el ATS los trata como campos independientes.

La ficha exige, entre otros datos, RUC, período, número de establecimientos y total de ventas del informante.

2. Tipos de comprobantes

Este es uno de los catálogos fundamentales.

Debes distinguir entre:

Comprobantes de venta

Factura
Nota de venta
Liquidación de compra
Tiquetes
Pasajes
Documentos autorizados
etc.

Documentos complementarios

Nota de crédito
Nota de débito

Comprobantes de retención

Retención de IR
Retención de IVA

El SRI también reconoce otros documentos autorizados, como documentos de instituciones financieras, importaciones/exportaciones, pasajes, documentos de instituciones públicas, etc.

Aquí hay una regla de arquitectura importante:

no guardes estos códigos solamente como enums en el código fuente.

Haz tablas como:

sri_tipo_comprobante

codigo
descripcion
fecha_desde
fecha_hasta
aplica_compras
aplica_ventas

porque el catálogo del SRI cambia.

3. IVA: probablemente el concepto más importante

Para cada documento debes saber separar el valor de la transacción según su tratamiento de IVA.

El ATS contempla campos distintos como:

baseNoGraIva
baseImponible
baseImpGrav
baseImpExe
montoIva
montoIce

La ficha distingue explícitamente:

Base no objeto de IVA
Base tarifa 0 %
Base tarifa distinta de 0 %
Base exenta de IVA
Monto IVA
Monto ICE

Esto significa que no debes guardar únicamente subtotal + IVA.

Un modelo mejor sería:

Documento
 └── Impuestos
      ├── base_no_objeto
      ├── base_iva_0
      ├── base_iva_gravada
      ├── base_exenta
      ├── iva
      └── ice

Y todavía mejor, para evitar problemas con cambios futuros:

document_tax_detail

document_id
tax_type
tax_code
percentage
taxable_base
tax_amount

Así soportas distintas tarifas sin rediseñar tu sistema.

Esto es especialmente importante porque las tarifas cambian con el tiempo. El SRI mantiene tarifas y tratamientos diferenciados; por eso tu sistema debería determinar la tarifa según fecha y régimen, no mediante algo como:

const IVA = 0.15;

La página actual del SRI sobre IVA muestra precisamente tratamientos y tarifas diferenciadas.

4. Crédito tributario ≠ gasto deducible

Este concepto suele confundir mucho al desarrollar sistemas.

Una compra puede tener dos efectos diferentes:

IVA
└─ ¿da derecho a crédito tributario?

Impuesto a la Renta
└─ ¿es costo/gasto deducible?

No son lo mismo.

Por eso existe el concepto de:

Sustento tributario

En ATS aparece como:

<codSustento>

La ficha establece que el codSustento es obligatorio en compras.

Conceptualmente puede representar casos como:

Crédito tributario de IVA
Costo/gasto para IR
Activo fijo
Inventario
Reembolso
Gastos de viaje
Pagos al exterior
Servicios digitales
etc.

La tabla oficial contiene, entre otros, sustento para activos fijos, inventarios, gastos de viaje y reembolsos.

Para tu sistema esta relación debería existir:

Compra
 ├── tipo_comprobante
 └── sustento_tributario

No intentes determinar el sustento únicamente por el tipo de factura.

Una factura puede tener diferente tratamiento dependiendo de para qué fue utilizada la compra.

5. Retenciones de Impuesto a la Renta

Aquí necesitas aprender:

Base de retención
Concepto de retención
Código SRI
Porcentaje
Valor retenido
Fecha
Comprobante de retención

Ejemplo conceptual:

Compra de servicio

Base:                 1.000,00
Código retención:     XXX
Porcentaje:           X %
Valor retenido:       XX,XX

El ATS no debería deducir solamente:

valor_retencion = base × porcentaje

Debe conservar además qué concepto tributario originó la retención:

codRetAir
baseImpAir
porcentajeAir
valRetAir

La ficha define esos campos individualmente.

Y nuevamente: los códigos y porcentajes deben manejarse por vigencia.

6. Retenciones de IVA

Es otro impuesto independiente.

Una compra puede tener simultáneamente:

Retención IR
+
Retención IVA

Por eso tu estructura no debería hacer algo como:

factura.retencion = 50

Debería ser:

Factura
 └── Retenciones
      ├── IR
      │    ├── código
      │    ├── base
      │    ├── %
      │    └── valor
      │
      └── IVA
           ├── base
           ├── %
           └── valor
7. Formas de pago

También forman parte de la información tributaria.

Ejemplos conceptuales:

Sistema financiero
Sin utilización del sistema financiero
Tarjetas
Transferencias
etc.

Una sola operación puede tener más de una forma de pago.

La ficha vigente establece que, para compras, desde el 20 de diciembre de 2023 este campo se genera cuando la suma de bases e impuestos supera USD 500, y permite reportar varias formas de pago para una misma transacción.

Por tanto, tampoco diseñes:

factura.forma_pago

sino algo parecido a:

factura
   ↓
document_payment_method[]

relación uno-a-muchos.

8. Compras

Ahora sí puedes entender el módulo de compras del ATS.

Conceptualmente una compra contiene:

Proveedor
+
Identificación
+
Sustento tributario
+
Tipo comprobante
+
Número del comprobante
+
Fecha
+
Autorización
+
Bases IVA
+
IVA
+
ICE
+
Pago local/exterior
+
Forma de pago
+
Retenciones IR
+
Retenciones IVA

En términos aproximados de modelo:

purchase
 ├── supplier
 ├── document
 ├── tax_support
 ├── tax_details[]
 ├── payments[]
 └── withholdings[]

El ATS exige precisamente identificación del sustento, proveedor, tipo de comprobante, identificación y detalles tributarios.

9. Ventas

Una venta contiene información parecida, pero desde la perspectiva del cliente:

Cliente
Tipo identificación
Tipo comprobante
Base no objeto
Base 0 %
Base gravada
IVA
Retenciones que te efectuaron
Forma de cobro
Establecimiento

Aquí aparece una diferencia muy importante.

La base de datos de tu sistema debería guardar cada factura individualmente.

Pero el ATS puede requerir información consolidada por cliente y tipo de comprobante.

La ficha, por ejemplo, contiene el campo numeroComprobantes y establece que, para el ATS mensual, se consideran los comprobantes emitidos durante ese mes.

Por tanto:

BASE DE DATOS

cliente A
 factura 1
 factura 2
 factura 3

puede transformarse al generar el ATS en:

CLIENTE A
numeroComprobantes = 3

base0     = Σ facturas
baseGrav  = Σ facturas
iva       = Σ facturas

No consolides las facturas cuando las guardas.

Consolídalas únicamente en la capa del generador ATS.

10. Notas de crédito y notas de débito

Este punto es indispensable.

Una NC/ND debe conocer el documento que modifica.

Ejemplo:

Nota de crédito
       ↓
Factura original

Por eso tu modelo necesita:

modified_document_id

y conservar:

tipo documento original
establecimiento
punto emisión
secuencial
autorización

La ficha ATS exige esos datos para notas de crédito y débito.

11. Exportaciones e ingresos del exterior

Si tu sistema pretende ser contable completo, diseña esto desde el principio aunque inicialmente no lo utilices.

El ATS contempla un módulo separado de:

Exportaciones y otros ingresos del exterior.

Puede requerir:

Cliente exterior
Identificación exterior
País
Tipo de régimen fiscal
Tipo de exportación
Refrendo aduanero
Documento transporte
Fecha
Valor FOB
Factura exportación
Ingreso exterior

Por ejemplo, diferencia:

Exportación de bienes con refrendo
Exportación de bienes sin refrendo
Exportación de servicios
Otros ingresos del exterior

La ficha oficial contempla esos tres tipos principales.

12. Documentos anulados

También existe una sección específica:

tipoComprobante
establecimiento
puntoEmision
secuencialInicio
secuencialFin
autorizacion

La ficha indica que allí se informan los comprobantes anulados del período y excluye los comprobantes dados de baja mediante SRI en Línea.

Esto significa que en tu sistema una factura no debería simplemente desaparecer.

Utiliza estados:

BORRADOR
EMITIDO
AUTORIZADO
ANULADO

y conserva auditoría.

Nunca:

DELETE FROM factura
WHERE id = 123;

cuando representa un documento tributario real.

13. El detalle importantísimo de los comprobantes electrónicos

Esto te interesa especialmente porque estás construyendo software.

La ficha ATS establece una regla especial para contribuyentes que emiten comprobantes electrónicos: cuando sus comprobantes electrónicos implementan la información y versiones requeridas por las especificaciones XML/XSD, determinada información no tiene que volver a registrarse de manera redundante en compras y ventas del ATS; cuando no se cumplen esas condiciones, debe reportarse en el anexo.

Por eso sería un error programar simplemente:

for (const factura of todasLasFacturas) {
    ats.compras.push(factura);
}

Necesitas un motor de reglas:

Documento
    ↓
¿Debe reportarse en ATS?
    ↓
sí / no
    ↓
¿En qué módulo?
    ↓
¿Cómo debe consolidarse?
14. Cómo diseñaría yo tu sistema web

Yo separaría el proyecto en estas capas:

┌─────────────────────────┐
│ FACTURACIÓN             │
│ Facturas / NC / ND      │
└───────────┬─────────────┘
            ↓
┌─────────────────────────┐
│ DOCUMENTOS TRIBUTARIOS  │
│ Datos normalizados      │
└───────────┬─────────────┘
            ↓
┌─────────────────────────┐
│ MOTOR TRIBUTARIO        │
│ IVA                     │
│ IR                      │
│ Retenciones             │
│ Sustentos               │
│ Catálogos SRI           │
└───────────┬─────────────┘
            ↓
┌─────────────────────────┐
│ CONTABILIDAD            │
│ Asientos contables      │
└───────────┬─────────────┘
            ↓
┌─────────────────────────┐
│ REPORTES TRIBUTARIOS    │
│ IVA                     │
│ Retenciones             │
│ ATS                     │
└───────────┬─────────────┘
            ↓
┌─────────────────────────┐
│ XML ATS                 │
│ validación at.xsd       │
└─────────────────────────┘

Así el ATS es simplemente una proyección de información que tu sistema ya conoce.

Ese es un diseño bastante más sólido.

15. Qué deberías guardar en la base de datos

Como mínimo yo tendría entidades aproximadamente así:

Taxpayer
ThirdParty
Establishment

TaxDocument
TaxDocumentDetail
TaxDocumentTax

Purchase
Sale

CreditNote
DebitNote

WithholdingDocument
WithholdingDetail

Payment
PaymentMethod

TaxSupport

ExportTransaction
ImportTransaction

SriCatalog
SriCatalogValue

AccountingEntry
AccountingEntryDetail

AtsGeneration
AtsGenerationDetail

Y especialmente:

SriCatalogValue
----------------------------
catalog
code
description
valid_from
valid_to

Porque tu aplicación debería poder decir:

Para una factura emitida el 15/05/2024 usa las reglas vigentes el 15/05/2024.

No:

usa las reglas que existen hoy.

Ese detalle evita muchos problemas tributarios históricos.

16. Validación del ATS

Tu generador debería hacer tres niveles de validación.

1. Validación de datos
       ↓
RUC válido
fechas
secuenciales
autorizaciones
campos obligatorios

2. Validación tributaria
       ↓
tipo comprobante permitido
sustento permitido
retención válida para la fecha
forma de pago
bases IVA coherentes

3. Validación técnica
       ↓
XML
       ↓
XSD oficial del SRI

El SRI publica precisamente at.xsd para esta validación.

En desarrollo podrías tener algo como:

AtsValidator
 ├── validateHeader()
 ├── validatePurchases()
 ├── validateSales()
 ├── validateExports()
 ├── validateVoidedDocuments()
 └── validateXsd()
17. La prueba definitiva

No confíes únicamente en que:

el XML es válido contra el XSD

Eso solo demuestra que la estructura XML es correcta.

También debes comprobar las reglas tributarias.

Tu flujo de pruebas debería ser:

Sistema
 ↓
genera ATS.xml
 ↓
valida XSD
 ↓
valida reglas internas
 ↓
prueba con programa ATS/DIMM del SRI
 ↓
comparar Talón Resumen

El SRI indica que DIMM permite verificar los archivos elaborados por otros sistemas y genera el Talón Resumen cuando están correctamente construidos.

18. Qué documentos debes considerar: resumen final

Para que tu sistema pueda generar correctamente un ATS, piensa en este mapa:

Documento / información	¿Para qué sirve?
Facturas de proveedores	Compras
Facturas emitidas	Ventas
Notas de crédito recibidas	Ajustar compras
Notas de crédito emitidas	Ajustar ventas
Notas de débito recibidas	Ajustar compras
Notas de débito emitidas	Ajustar ventas
Liquidaciones de compra	Compras especiales
Notas de venta y otros comprobantes autorizados	Compras/ventas según caso
Comprobantes de retención emitidos	IR e IVA retenido al proveedor
Comprobantes de retención recibidos	Retenciones que hicieron a tu empresa
Documentación de importación	Importaciones, crédito tributario y compras cuando corresponda
Facturas/documentación de exportación	Exportaciones
Documentos/refrendos aduaneros	Exportaciones de bienes
Documentos anulados	Sección de anulados
Formas de pago/cobro	Información ATS cuando corresponda
Documentos de reembolso	Operaciones de reembolso
Documentos bancarios autorizados	Determinadas compras/gastos
Pasajes/documentos de transporte autorizados	Determinadas compras/gastos

Y existen documentos que sirven principalmente para conciliación, aunque no necesariamente constituyen por sí mismos una transacción ATS:

Libro diario
Libro mayor
Balance de comprobación
Estados de cuenta bancarios
Auxiliar de proveedores
Auxiliar de clientes
Cuentas por pagar
Cuentas por cobrar

La idea central es:

El documento tributario origina el ATS; la contabilidad sirve para controlar que todo cuadre.

19. Qué debes conciliar cada mes

Antes de permitir el botón:

“Generar ATS”

yo pondría una pantalla:

CIERRE TRIBUTARIO — AGOSTO 2026

Ventas documentos             $ xxx
Ventas ATS                    $ xxx
Diferencia                    $ 0.00

IVA ventas                    $ xxx
IVA calculado ATS             $ xxx
Diferencia                    $ 0.00

Compras documentos            $ xxx
Compras ATS                   $ xxx

IVA compras                   $ xxx
Crédito tributario            $ xxx

Retención Renta emitida       $ xxx
Retención Renta ATS           $ xxx

Retención IVA emitida         $ xxx
Retención IVA ATS             $ xxx

⚠ 2 documentos pendientes
✓ XML estructuralmente válido
✓ Catálogo SRI vigente

Eso convertiría tu sistema en algo mucho más confiable que un simple generador de XML.

20. Dónde aprender gratis

No necesitas pagar un curso para comenzar.

El mejor material está directamente en el SRI.

Primero descarga estos cuatro archivos:

Catálogo ATS 2026 → Ficha técnica → at.xsd → Ejemplo XML.

El portal del SRI tiene actualmente el Catálogo ATS actualizado a agosto de 2026, la ficha técnica, el XSD y ejemplos.

Documentación oficial, catálogo, XSD y ejemplos ATS del SRI

Después utiliza la plataforma gratuita de capacitación del SRI. Tiene cursos de autoestudio y materiales gratuitos, incluyendo facturación electrónica.

Cursos gratuitos del SRI

Y también existen los Núcleos de Apoyo Contable y Fiscal (NAF), que brindan orientación tributaria y contable gratuita.

Núcleos de Apoyo Contable y Fiscal — NAF

El orden que te recomiendo estudiar

Como estás desarrollando un sistema contable/facturación web, seguiría exactamente esta ruta:

1. Comprobantes tributarios
        ↓
2. IVA
        ↓
3. Crédito tributario
        ↓
4. Sustento tributario
        ↓
5. Retenciones IR
        ↓
6. Retenciones IVA
        ↓
7. Formas de pago
        ↓
8. Compras
        ↓
9. Ventas
        ↓
10. Notas crédito/débito
        ↓
11. Exportaciones/importaciones
        ↓
12. ATS
        ↓
13. Catálogo ATS
        ↓
14. XML ATS
        ↓
15. XSD
        ↓
16. Conciliación ATS ↔ declaraciones ↔ contabilidad

No empezaría programando el XML. Empezaría diseñando correctamente Compra → IVA → Sustento → Retenciones → Pago, porque si ese modelo está bien construido, generar el ATS después resulta mucho más sencillo.

Si quieres, en el siguiente paso puedo enseñarte el ATS campo por campo usando una empresa ficticia, haciendo durante un mes unas 5 compras, 5 ventas, una nota de crédito y varias retenciones, y al final construir contigo el XML ATS completo tal como debería generarlo tu sistema web.