using EcuNexo.Core.Purchases;
using EcuNexo.Core.Purchases.Services;

namespace EcuNexo.Core.UnitTests.Purchases;

public sealed class PurchaseAndXmlParserTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid SupplierId = Guid.NewGuid();

    [Fact(DisplayName = "Purchase.Create con campos válidos es exitoso")]
    public void Purchase_Create_Valid_Succeeds()
    {
        var purchaseId = Guid.NewGuid();
        var issueDate = new DateOnly(2026, 9, 10);

        var result = Purchase.Create(
            id: purchaseId,
            tenantId: TenantId,
            supplierId: SupplierId,
            invoiceNumber: "001-002-000123456",
            issueDate: issueDate,
            authorizationNumber: "1009202601179001691900120010020001234561234567818",
            sriSustentoCode: "01",
            creditDays: 30);

        result.IsSuccess.Should().BeTrue();
        var purchase = result.Value!;
        purchase.Id.Should().Be(purchaseId);
        purchase.InvoiceNumber.Should().Be("001-002-000123456");
        purchase.AuthorizationNumber.Should().Be("1009202601179001691900120010020001234561234567818");
        purchase.IssueDate.Should().Be(issueDate);
        purchase.Status.Should().Be(PurchaseStatus.Draft);
        purchase.CreditDays.Should().Be(30);
    }

    [Fact(DisplayName = "Purchase.Create con clave de acceso que no tiene 49 dígitos falla")]
    public void Purchase_Create_InvalidAuthNumber_Fails()
    {
        var result = Purchase.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            supplierId: SupplierId,
            invoiceNumber: "001-002-000123456",
            issueDate: new DateOnly(2026, 9, 10),
            authorizationNumber: "12345"); // longitud inválida

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("purchase.authorization_number.invalid");
    }

    [Fact(DisplayName = "Purchase.Create con número de factura continuo de 15 dígitos lo formatea con guiones automáticamente")]
    public void Purchase_Create_Raw15DigitsInvoiceNumber_FormatsWithHyphens_Succeeds()
    {
        var result = Purchase.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            supplierId: SupplierId,
            invoiceNumber: "001002000123456",
            issueDate: new DateOnly(2026, 9, 10));

        result.IsSuccess.Should().BeTrue();
        result.Value!.InvoiceNumber.Should().Be("001-002-000123456");
    }

    [Fact(DisplayName = "Purchase.Create con formato de factura inválido falla")]
    public void Purchase_Create_InvalidInvoiceNumberFormat_Fails()
    {
        var result = Purchase.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            supplierId: SupplierId,
            invoiceNumber: "001-002-123", // Secuencial no tiene 9 dígitos
            issueDate: new DateOnly(2026, 9, 10));

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("purchase.invoice_number.invalid_format");
    }

    [Fact(DisplayName = "Purchase.Create con fecha de emisión futura falla con error")]
    public void Purchase_Create_FutureIssueDate_Fails()
    {
        var futureDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10));
        var result = Purchase.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            supplierId: SupplierId,
            invoiceNumber: "001-002-000123456",
            issueDate: futureDate);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("purchase.issue_date.future");
    }

    [Fact(DisplayName = "Purchase.Create con valores numéricos negativos falla")]
    public void Purchase_Create_NegativeAmounts_Fails()
    {
        var result = Purchase.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            supplierId: SupplierId,
            invoiceNumber: "001-002-000123456",
            issueDate: new DateOnly(2026, 9, 10),
            subtotalTaxed: -150m);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("purchase.amounts.negative");
    }

    [Fact(DisplayName = "Purchase.AddItem calcula subtotales, IVA y total correctamente")]
    public void Purchase_AddItem_CalculatesTotals()
    {
        var purchase = Purchase.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            supplierId: SupplierId,
            invoiceNumber: "001-001-000000001",
            issueDate: new DateOnly(2026, 9, 10)).Value!;

        // Ítem 1: 2 unidades a $100 con 15% IVA = $200 subtotal, $30 IVA
        var item1 = PurchaseItem.Create(
            id: Guid.NewGuid(),
            purchaseId: purchase.Id,
            description: "Laptop Corporativa",
            quantity: 2,
            unitPrice: 100m,
            discount: 0m,
            taxRate: 15m,
            itemCode: "LAP-01",
            affectsInventory: true).Value!;

        // Ítem 2: 1 servicio a $50 con 0% IVA = $50 subtotal 0%
        var item2 = PurchaseItem.Create(
            id: Guid.NewGuid(),
            purchaseId: purchase.Id,
            description: "Capacitación / Servicio Exento",
            quantity: 1,
            unitPrice: 50m,
            discount: 0m,
            taxRate: 0m,
            itemCode: "SERV-01",
            affectsInventory: false).Value!;

        purchase.AddItem(item1).IsSuccess.Should().BeTrue();
        purchase.AddItem(item2).IsSuccess.Should().BeTrue();

        purchase.SubtotalTaxed.Should().Be(200m);
        purchase.SubtotalZero.Should().Be(50m);
        purchase.TaxAmount.Should().Be(30m);
        purchase.TotalAmount.Should().Be(280m);
    }

    [Fact(DisplayName = "Purchase.MarkAsReceived cambia estado y asigna InventoryDocumentId")]
    public void Purchase_MarkAsReceived_TransitionsState()
    {
        var purchase = Purchase.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            supplierId: SupplierId,
            invoiceNumber: "001-001-000000001",
            issueDate: new DateOnly(2026, 9, 10)).Value!;

        var inventoryDocId = Guid.NewGuid();
        var result = purchase.MarkAsReceived(inventoryDocId);

        result.IsSuccess.Should().BeTrue();
        purchase.Status.Should().Be(PurchaseStatus.Received);
        purchase.InventoryDocumentId.Should().Be(inventoryDocId);
    }

    [Fact(DisplayName = "SriPurchaseXmlParser parsea correctamente factura estándar SRI")]
    public void SriPurchaseXmlParser_Parse_ValidStandardXml_Succeeds()
    {
        const string xml = """
            <?xml version="1.0" encoding="UTF-8"?>
            <factura id="comprobante" version="1.1.0">
              <infoTributaria>
                <ambiente>2</ambiente>
                <tipoEmision>1</tipoEmision>
                <razonSocial>DISTRIBUIDORA ECUATORIANA TEC S.A.</razonSocial>
                <nombreComercial>ECUATEC</nombreComercial>
                <ruc>1790016919001</ruc>
                <claveAcceso>1009202601179001691900120010020000012341234567819</claveAcceso>
                <codDoc>01</codDoc>
                <estab>001</estab>
                <ptoEmi>002</ptoEmi>
                <secuencial>000001234</secuencial>
                <dirMatriz>Av. Amazonas y Colon, Quito</dirMatriz>
              </infoTributaria>
              <infoFactura>
                <fechaEmision>10/09/2026</fechaEmision>
                <dirEstablecimiento>Av. Amazonas y Colon</dirEstablecimiento>
                <obligadoContabilidad>SI</obligadoContabilidad>
                <tipoIdentificacionComprador>04</tipoIdentificacionComprador>
                <razonSocialComprador>EMPRESA COMPRADORA S.A.S.</razonSocialComprador>
                <identificacionComprador>1792223334001</identificacionComprador>
                <totalSinImpuestos>250.00</totalSinImpuestos>
                <totalDescuento>10.00</totalDescuento>
                <totalConImpuestos>
                  <totalImpuesto>
                    <codigo>2</codigo>
                    <codigoPorcentaje>4</codigoPorcentaje>
                    <baseImponible>250.00</baseImponible>
                    <valor>37.50</valor>
                  </totalImpuesto>
                </totalConImpuestos>
                <importeTotal>287.50</importeTotal>
                <moneda>DOLAR</moneda>
                <pagos>
                  <pago>
                    <formaPago>20</formaPago>
                    <total>287.50</total>
                    <plazo>30</plazo>
                    <unidadTiempo>dias</unidadTiempo>
                  </pago>
                </pagos>
              </infoFactura>
              <detalles>
                <detalle>
                  <codigoPrincipal>PROD-001</codigoPrincipal>
                  <descripcion>Memoria RAM 16GB DDR5 Kingston</descripcion>
                  <cantidad>5.00</cantidad>
                  <precioUnitario>52.00</precioUnitario>
                  <descuento>10.00</descuento>
                  <precioTotalSinImpuesto>250.00</precioTotalSinImpuesto>
                  <impuestos>
                    <impuesto>
                      <codigo>2</codigo>
                      <codigoPorcentaje>4</codigoPorcentaje>
                      <tarifa>15.00</tarifa>
                      <baseImponible>250.00</baseImponible>
                      <valor>37.50</valor>
                    </impuesto>
                  </impuestos>
                </detalle>
              </detalles>
            </factura>
            """;

        var result = SriPurchaseXmlParser.Parse(xml);

        result.IsSuccess.Should().BeTrue();
        var parsed = result.Value!;
        parsed.SupplierTaxId.Should().Be("1790016919001");
        parsed.SupplierBusinessName.Should().Be("DISTRIBUIDORA ECUATORIANA TEC S.A.");
        parsed.SupplierTradeName.Should().Be("ECUATEC");
        parsed.InvoiceNumber.Should().Be("001-002-000001234");
        parsed.AuthorizationNumber.Should().Be("1009202601179001691900120010020000012341234567819");
        parsed.IssueDate.Should().Be(new DateOnly(2026, 9, 10));
        parsed.SubtotalTaxed.Should().Be(250.00m);
        parsed.TaxRate.Should().Be(15.00m);
        parsed.TaxAmount.Should().Be(37.50m);
        parsed.TotalAmount.Should().Be(287.50m);
        parsed.CreditDays.Should().Be(30);
        parsed.Lines.Should().HaveCount(1);
        parsed.Lines[0].ItemCode.Should().Be("PROD-001");
        parsed.Lines[0].Description.Should().Be("Memoria RAM 16GB DDR5 Kingston");
        parsed.Lines[0].Quantity.Should().Be(5.00m);
        parsed.Lines[0].UnitPrice.Should().Be(52.00m);
        parsed.Lines[0].Total.Should().Be(287.50m);
    }

    [Fact(DisplayName = "SriPurchaseXmlParser parsea comprobante envuelto en autorización SRI")]
    public void SriPurchaseXmlParser_Parse_WrappedAutorizacionXml_Succeeds()
    {
        const string wrappedXml = """
            <?xml version="1.0" encoding="UTF-8"?>
            <autorizacion>
              <estado>AUTORIZADO</estado>
              <numeroAutorizacion>1009202601179001691900120010020000012341234567819</numeroAutorizacion>
              <fechaAutorizacion class="fechaAutorizacion">10/09/2026 15:30:00</fechaAutorizacion>
              <comprobante><![CDATA[<?xml version="1.0" encoding="UTF-8"?>
                <factura id="comprobante" version="1.1.0">
                  <infoTributaria>
                    <ambiente>2</ambiente>
                    <tipoEmision>1</tipoEmision>
                    <razonSocial>PAPELERIA Y SUMINISTROS S.A.</razonSocial>
                    <ruc>1791112223001</ruc>
                    <claveAcceso>1009202601179001691900120010020000012341234567819</claveAcceso>
                    <codDoc>01</codDoc>
                    <estab>002</estab>
                    <ptoEmi>001</ptoEmi>
                    <secuencial>000005555</secuencial>
                  </infoTributaria>
                  <infoFactura>
                    <fechaEmision>10/09/2026</fechaEmision>
                    <totalSinImpuestos>100.00</totalSinImpuestos>
                    <importeTotal>115.00</importeTotal>
                    <totalConImpuestos>
                      <totalImpuesto>
                        <codigo>2</codigo>
                        <codigoPorcentaje>4</codigoPorcentaje>
                        <baseImponible>100.00</baseImponible>
                        <valor>15.00</valor>
                      </totalImpuesto>
                    </totalConImpuestos>
                  </infoFactura>
                  <detalles>
                    <detalle>
                      <codigoPrincipal>RESMA-A4</codigoPrincipal>
                      <descripcion>Resma de papel bond A4 75g</descripcion>
                      <cantidad>20.00</cantidad>
                      <precioUnitario>5.00</precioUnitario>
                      <precioTotalSinImpuesto>100.00</precioTotalSinImpuesto>
                      <impuestos>
                        <impuesto>
                          <codigo>2</codigo>
                          <codigoPorcentaje>4</codigoPorcentaje>
                          <tarifa>15.00</tarifa>
                          <valor>15.00</valor>
                        </impuesto>
                      </impuestos>
                    </detalle>
                  </detalles>
                </factura>
              ]]></comprobante>
            </autorizacion>
            """;

        var result = SriPurchaseXmlParser.Parse(wrappedXml);

        result.IsSuccess.Should().BeTrue();
        var parsed = result.Value!;
        parsed.SupplierTaxId.Should().Be("1791112223001");
        parsed.SupplierBusinessName.Should().Be("PAPELERIA Y SUMINISTROS S.A.");
        parsed.InvoiceNumber.Should().Be("002-001-000005555");
        parsed.AuthorizationNumber.Should().Be("1009202601179001691900120010020000012341234567819");
        parsed.TotalAmount.Should().Be(115.00m);
        parsed.Lines.Should().HaveCount(1);
    }

    [Fact(DisplayName = "SriPurchaseXmlParser con XML no correspondiente a factura falla")]
    public void SriPurchaseXmlParser_Parse_NonInvoiceXml_Fails()
    {
        const string xml = "<guiaRemision><infoTributaria></infoTributaria></guiaRemision>";
        var result = SriPurchaseXmlParser.Parse(xml);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("sri_xml.not_factura");
    }

    [Fact(DisplayName = "SriPurchaseXmlParser parsea correctamente RespuestaAutorizacion del SRI (Servientrega con XML embebido)")]
    public void SriPurchaseXmlParser_Parse_ServientregaRespuestaAutorizacion_Succeeds()
    {
        const string xml = """
            <?xml version="1.0" encoding="utf-8" standalone="yes"?>
            <ns2:RespuestaAutorizacion xsi:type="ns2:autorizacion" xmlns:ns2="http://ec.gob.sri.ws.autorizacion" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
                <estado>AUTORIZADO</estado>
                <numeroAutorizacion>1009202601099128567900126650210000214721234567810</numeroAutorizacion>
                <fechaAutorizacion>2026-09-10T20:39:27-05:00</fechaAutorizacion>
                <ambiente>PRODUCCIÓN</ambiente>
                <comprobante>&lt;?xml version="1.0" encoding="UTF-8" standalone="no"?&gt;&lt;factura xmlns:ns2="http://www.w3.org/2000/09/xmldsig#" id="comprobante" version="2.1.0"&gt;&lt;infoTributaria&gt;&lt;ambiente&gt;2&lt;/ambiente&gt;&lt;tipoEmision&gt;1&lt;/tipoEmision&gt;&lt;razonSocial&gt;SERVIENTREGA ECUADOR S.A.&lt;/razonSocial&gt;&lt;nombreComercial&gt;SERVIENTREGA ECUADOR S.A.&lt;/nombreComercial&gt;&lt;ruc&gt;0991285679001&lt;/ruc&gt;&lt;claveAcceso&gt;1009202601099128567900126650210000214721234567810&lt;/claveAcceso&gt;&lt;codDoc&gt;01&lt;/codDoc&gt;&lt;estab&gt;665&lt;/estab&gt;&lt;ptoEmi&gt;021&lt;/ptoEmi&gt;&lt;secuencial&gt;000021472&lt;/secuencial&gt;&lt;dirMatriz&gt;AV JUAN TANCA MARENGO Y DR CAMILO PONCE ENRIQUE&lt;/dirMatriz&gt;&lt;/infoTributaria&gt;&lt;infoFactura&gt;&lt;fechaEmision&gt;10/09/2026&lt;/fechaEmision&gt;&lt;dirEstablecimiento&gt;URB MUCHO LOTE 1 VIGESIMO QUINTA ETAPA VII E ISIDRO AYORA PLAZA CORONEL&lt;/dirEstablecimiento&gt;&lt;contribuyenteEspecial&gt;198&lt;/contribuyenteEspecial&gt;&lt;obligadoContabilidad&gt;SI&lt;/obligadoContabilidad&gt;&lt;tipoIdentificacionComprador&gt;04&lt;/tipoIdentificacionComprador&gt;&lt;razonSocialComprador&gt;EVERCHIC SAS&lt;/razonSocialComprador&gt;&lt;identificacionComprador&gt;0993397804001&lt;/identificacionComprador&gt;&lt;totalSinImpuestos&gt;2.25&lt;/totalSinImpuestos&gt;&lt;totalDescuento&gt;0.00&lt;/totalDescuento&gt;&lt;totalConImpuestos&gt;&lt;totalImpuesto&gt;&lt;codigo&gt;2&lt;/codigo&gt;&lt;codigoPorcentaje&gt;4&lt;/codigoPorcentaje&gt;&lt;baseImponible&gt;2.2500&lt;/baseImponible&gt;&lt;tarifa&gt;15&lt;/tarifa&gt;&lt;valor&gt;0.3400&lt;/valor&gt;&lt;/totalImpuesto&gt;&lt;totalImpuesto&gt;&lt;codigo&gt;2&lt;/codigo&gt;&lt;codigoPorcentaje&gt;0&lt;/codigoPorcentaje&gt;&lt;baseImponible&gt;0.0000&lt;/baseImponible&gt;&lt;tarifa&gt;0&lt;/tarifa&gt;&lt;valor&gt;0.00&lt;/valor&gt;&lt;/totalImpuesto&gt;&lt;/totalConImpuestos&gt;&lt;propina&gt;0.00&lt;/propina&gt;&lt;importeTotal&gt;2.59&lt;/importeTotal&gt;&lt;moneda&gt;DOLAR&lt;/moneda&gt;&lt;pagos&gt;&lt;pago&gt;&lt;formaPago&gt;01&lt;/formaPago&gt;&lt;total&gt;2.59&lt;/total&gt;&lt;plazo&gt;0&lt;/plazo&gt;&lt;unidadTiempo&gt;dias&lt;/unidadTiempo&gt;&lt;/pago&gt;&lt;/pagos&gt;&lt;/infoFactura&gt;&lt;detalles&gt;&lt;detalle&gt;&lt;codigoPrincipal&gt;000000001&lt;/codigoPrincipal&gt;&lt;codigoAuxiliar&gt;000000001&lt;/codigoAuxiliar&gt;&lt;descripcion&gt;MERCANCIA PREMIER/Guía: 9036027492&lt;/descripcion&gt;&lt;cantidad&gt;1&lt;/cantidad&gt;&lt;precioUnitario&gt;2.2500&lt;/precioUnitario&gt;&lt;descuento&gt;0.0000&lt;/descuento&gt;&lt;precioTotalSinImpuesto&gt;2.2500&lt;/precioTotalSinImpuesto&gt;&lt;detallesAdicionales&gt;&lt;detAdicional nombre="ENVIOS" valor=" 1"/&gt;&lt;detAdicional nombre="PORCENTAJE" valor=" 15.00"/&gt;&lt;/detallesAdicionales&gt;&lt;impuestos&gt;&lt;impuesto&gt;&lt;codigo&gt;2&lt;/codigo&gt;&lt;codigoPorcentaje&gt;4&lt;/codigoPorcentaje&gt;&lt;tarifa&gt;15&lt;/tarifa&gt;&lt;baseImponible&gt;2.2500&lt;/baseImponible&gt;&lt;valor&gt;0.3400&lt;/valor&gt;&lt;/impuesto&gt;&lt;/impuestos&gt;&lt;/detalle&gt;&lt;/detalles&gt;&lt;infoAdicional&gt;&lt;campoAdicional nombre="Correo 1"&gt;contabilidad@everchic.ec&lt;/campoAdicional&gt;&lt;/infoAdicional&gt;&lt;/factura&gt;</comprobante>
                <mensajes/>
            </ns2:RespuestaAutorizacion>
            """;

        var result = SriPurchaseXmlParser.Parse(xml);

        result.IsSuccess.Should().BeTrue();
        var parsed = result.Value!;
        parsed.SupplierTaxId.Should().Be("0991285679001");
        parsed.SupplierBusinessName.Should().Be("SERVIENTREGA ECUADOR S.A.");
        parsed.SupplierTradeName.Should().Be("SERVIENTREGA ECUADOR S.A.");
        parsed.InvoiceNumber.Should().Be("665-021-000021472");
        parsed.AuthorizationNumber.Should().Be("1009202601099128567900126650210000214721234567810");
        parsed.IssueDate.Should().Be(new DateOnly(2026, 9, 10));
        parsed.SubtotalTaxed.Should().Be(2.25m);
        parsed.SubtotalZero.Should().Be(0.00m);
        parsed.TaxRate.Should().Be(15.00m);
        parsed.TaxAmount.Should().Be(0.34m);
        parsed.TotalAmount.Should().Be(2.59m);
        parsed.Lines.Should().HaveCount(1);
        parsed.Lines[0].ItemCode.Should().Be("000000001");
        parsed.Lines[0].Description.Should().Be("MERCANCIA PREMIER/Guía: 9036027492");
        parsed.Lines[0].Quantity.Should().Be(1.00m);
        parsed.Lines[0].UnitPrice.Should().Be(2.25m);
        parsed.Lines[0].TaxAmount.Should().Be(0.34m);
        parsed.Lines[0].Total.Should().Be(2.59m);

        parsed.ValidationReport.Should().NotBeNull();
        parsed.ValidationReport!.IsAuthorizedBySri.Should().BeTrue();
        parsed.ValidationReport.IsAccessKeyValid.Should().BeTrue();
        parsed.ValidationReport.IsMathConsistent.Should().BeTrue();
        parsed.ValidationReport.TaxRateStatus.Should().Be("VIGENTE_15");
        parsed.ValidationReport.OverallStatus.Should().Be("valid");
    }

    [Fact(DisplayName = "Purchase.Create con autorización física preimpresa de 10 dígitos es exitoso")]
    public void Purchase_Create_Physical10DigitAuth_Succeeds()
    {
        var result = Purchase.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            supplierId: SupplierId,
            invoiceNumber: "001-001-000000045",
            issueDate: new DateOnly(2026, 9, 10),
            authorizationNumber: "1123456789", // 10 dígitos de imprenta SRI
            sriSustentoCode: "01");

        result.IsSuccess.Should().BeTrue();
        result.Value!.AuthorizationNumber.Should().Be("1123456789");
    }

    [Fact(DisplayName = "SriPurchaseAuditor.ValidateAccessKeyModulo11 valida clave correcta e invalida dígito alterado")]
    public void SriPurchaseAuditor_ValidateAccessKeyModulo11_WorksCorrectly()
    {
        // Clave válida de Servientrega
        const string validKey = "1009202601099128567900126650210000214721234567810";
        var (valid, expected, err) = SriPurchaseAuditor.ValidateAccessKeyModulo11(validKey);
        valid.Should().BeTrue();
        err.Should().BeNull();

        // Clave con dígito verificador alterado (de 0 a 9)
        const string corruptKey = "1009202601099128567900126650210000214721234567819";
        var (corruptValid, corruptExpected, corruptErr) = SriPurchaseAuditor.ValidateAccessKeyModulo11(corruptKey);
        corruptValid.Should().BeFalse();
        corruptExpected.Should().Be(0);
        corruptErr.Should().Contain("Dígito verificador inválido");
    }

    [Fact(DisplayName = "SriPurchaseAuditor detecta XML sin contenedor de autorización (contingencia SRI) y genera advertencia")]
    public void SriPurchaseAuditor_Detects_MissingSriAuthorizationContainer()
    {
        const string rawFacturaXml = """
            <factura id="comprobante" version="1.1.0">
                <infoTributaria>
                    <ambiente>2</ambiente>
                    <tipoEmision>1</tipoEmision>
                    <razonSocial>PROVEEDOR CONTINGENCIA S.A.</razonSocial>
                    <ruc>1790016919001</ruc>
                    <claveAcceso>1009202601099128567900126650210000214721234567810</claveAcceso>
                    <codDoc>01</codDoc>
                    <estab>001</estab>
                    <ptoEmi>001</ptoEmi>
                    <secuencial>000000010</secuencial>
                </infoTributaria>
                <infoFactura>
                    <fechaEmision>10/09/2026</fechaEmision>
                    <totalSinImpuestos>100.00</totalSinImpuestos>
                    <totalConImpuestos>
                        <totalImpuesto>
                            <codigo>2</codigo>
                            <codigoPorcentaje>4</codigoPorcentaje>
                            <baseImponible>100.00</baseImponible>
                            <tarifa>15</tarifa>
                            <valor>15.00</valor>
                        </totalImpuesto>
                    </totalConImpuestos>
                    <importeTotal>115.00</importeTotal>
                </infoFactura>
            </factura>
            """;

        var result = SriPurchaseXmlParser.Parse(rawFacturaXml);
        result.IsSuccess.Should().BeTrue();
        var report = result.Value!.ValidationReport!;
        report.IsAuthorizedBySri.Should().BeFalse();
        report.SriStatus.Should().Be("SIN_CONTENEDOR_SRI");
        report.OverallStatus.Should().Be("warning");
        report.Alerts.Should().Contain(a => a.Code == "NO_SRI_CONTAINER");
    }

    [Fact(DisplayName = "SriPurchaseAuditor detecta discrepancia matemática entre bases declaradas e importe total")]
    public void SriPurchaseAuditor_Detects_MathDiscrepancy()
    {
        const string mathErrorXml = """
            <factura id="comprobante" version="1.1.0">
                <infoTributaria>
                    <ambiente>2</ambiente>
                    <tipoEmision>1</tipoEmision>
                    <razonSocial>PROVEEDOR ERROR MATEMATICO S.A.</razonSocial>
                    <ruc>1790016919001</ruc>
                    <claveAcceso>1009202601099128567900126650210000214721234567810</claveAcceso>
                    <codDoc>01</codDoc>
                    <estab>001</estab>
                    <ptoEmi>001</ptoEmi>
                    <secuencial>000000011</secuencial>
                </infoTributaria>
                <infoFactura>
                    <fechaEmision>10/09/2026</fechaEmision>
                    <totalSinImpuestos>100.00</totalSinImpuestos>
                    <totalConImpuestos>
                        <totalImpuesto>
                            <codigo>2</codigo>
                            <codigoPorcentaje>4</codigoPorcentaje>
                            <baseImponible>100.00</baseImponible>
                            <tarifa>15</tarifa>
                            <valor>15.00</valor>
                        </totalImpuesto>
                    </totalConImpuestos>
                    <importeTotal>200.00</importeTotal> <!-- ERROR: 100 + 15 = 115 != 200 -->
                </infoFactura>
            </factura>
            """;

        var result = SriPurchaseXmlParser.Parse(mathErrorXml);
        result.IsSuccess.Should().BeTrue();
        var report = result.Value!.ValidationReport!;
        report.IsMathConsistent.Should().BeFalse();
        report.MathDiscrepancy.Should().Be(85.00m);
        report.OverallStatus.Should().Be("danger");
        report.Alerts.Should().Contain(a => a.Code == "MATH_TOTAL_MISMATCH");
    }
}

