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
}
