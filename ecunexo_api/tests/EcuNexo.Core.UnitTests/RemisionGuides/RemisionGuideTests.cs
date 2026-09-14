using EcuNexo.Core.Purchases.Services;
using EcuNexo.Core.RemisionGuides;

namespace EcuNexo.Core.UnitTests.RemisionGuides;

public sealed class RemisionGuideTests
{
    [Fact(DisplayName = "RemisionGuide.Create crea correctamente con datos válidos")]
    public void RemisionGuide_Create_Valid_ReturnsSuccess()
    {
        var id = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var issueDate = new DateOnly(2026, 9, 14);

        var result = RemisionGuide.Create(
            id: id,
            tenantId: tenantId,
            establishment: "001",
            emissionPoint: "002",
            sequential: "000000045",
            issueDate: issueDate,
            startingAddress: "Av. 10 de Agosto y Colón, Quito",
            startDate: issueDate,
            endDate: issueDate.AddDays(2),
            carrierIdentificationType: "04",
            carrierIdentification: "1791234567001",
            carrierName: "Transportes Andinos S.A.",
            licensePlate: "PDA-7890",
            recipientIdentificationType: "04",
            recipientIdentification: "0990001234001",
            recipientName: "Distribuidora Guayaquil Cía. Ltda.",
            recipientAddress: "Av. 9 de Octubre y Malecón, Guayaquil",
            transferReason: "Venta de mercadería",
            routeDescription: "Quito - Guayaquil vía Santo Domingo",
            carrierEmail: "operaciones@andinos.ec",
            carrierPhone: "0998877665",
            supportDocumentType: "01",
            supportDocumentNumber: "001-001-000012345",
            supportDocumentAuth: "1409202601179001691900110010010000123451234567812");

        Assert.True(result.IsSuccess);
        var guide = result.Value;
        Assert.NotNull(guide);
        Assert.Equal("001-002-000000045", guide.DocumentNumber);
        Assert.Equal(RemisionGuideStatus.Draft, guide.Status);
        Assert.Equal("PDA-7890", guide.LicensePlate);
        Assert.Equal("1791234567001", guide.CarrierIdentification);
        Assert.Equal("Distribuidora Guayaquil Cía. Ltda.", guide.RecipientName);
    }

    [Fact(DisplayName = "RemisionGuide.Create falla cuando las fechas de transporte son inválidas")]
    public void RemisionGuide_Create_EndDateBeforeStartDate_ReturnsFailure()
    {
        var id = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var issueDate = new DateOnly(2026, 9, 14);

        var result = RemisionGuide.Create(
            id: id,
            tenantId: tenantId,
            establishment: "001",
            emissionPoint: "001",
            sequential: "1",
            issueDate: issueDate,
            startingAddress: "Quito",
            startDate: issueDate,
            endDate: issueDate.AddDays(-1), // Fecha fin anterior a fecha inicio
            carrierIdentificationType: "04",
            carrierIdentification: "1791234567001",
            carrierName: "Transportes Andinos S.A.",
            licensePlate: "PDA-7890",
            recipientIdentificationType: "04",
            recipientIdentification: "0990001234001",
            recipientName: "Cliente Guayaquil",
            recipientAddress: "Guayaquil",
            transferReason: "Venta",
            routeDescription: "Quito - Guayaquil");

        Assert.True(result.IsFailure);
        Assert.Equal("remision_guide.dates.invalid", result.Error?.Code);
    }

    [Fact(DisplayName = "RemisionGuideItem.Create valida cantidad positiva y campos obligatorios")]
    public void RemisionGuideItem_Create_Validations()
    {
        var guideId = Guid.NewGuid();
        var validItem = RemisionGuideItem.Create(Guid.NewGuid(), guideId, "PROD-01", "Cajas de repuestos", 15.5m, "CAJAS");
        Assert.True(validItem.IsSuccess);
        Assert.Equal(15.5m, validItem.Value?.Quantity);

        var zeroQuantity = RemisionGuideItem.Create(Guid.NewGuid(), guideId, "PROD-01", "Cajas", 0m);
        Assert.True(zeroQuantity.IsFailure);
        Assert.Equal("remision_item.quantity.invalid", zeroQuantity.Error?.Code);

        var emptyDesc = RemisionGuideItem.Create(Guid.NewGuid(), guideId, "PROD-01", "  ", 5m);
        Assert.True(emptyDesc.IsFailure);
        Assert.Equal("remision_item.description.empty", emptyDesc.Error?.Code);
    }

    [Fact(DisplayName = "SriAccessKeyGenerator genera clave válida para Guía de Remisión (Tipo 06)")]
    public void SriAccessKeyGenerator_ForRemisionGuide_ProducesValidModulo11()
    {
        var issueDate = new DateOnly(2026, 9, 14);
        var ruc = "1790016919001";
        var accessKey = SriAccessKeyGenerator.Generate(
            issueDate: issueDate,
            documentType: "06",
            emitterRuc: ruc,
            environment: "1",
            establishment: "001",
            emissionPoint: "002",
            sequential: "000000045");

        Assert.Equal(49, accessKey.Length);
        Assert.Equal("06", accessKey.Substring(8, 2)); // Tipo 06
        Assert.Equal(ruc, accessKey.Substring(10, 13)); // RUC

        // Verificar validez Módulo 11 con el auditor oficial
        var (isValid, expectedCheckDigit, error) = SriPurchaseAuditor.ValidateAccessKeyModulo11(accessKey);
        Assert.True(isValid);
        Assert.Null(error);
    }

    [Fact(DisplayName = "SriRemisionGuideXmlGenerator genera estructura XML oficial conforme a norma SRI")]
    public void SriRemisionGuideXmlGenerator_GeneratesCompliantXml()
    {
        var guide = RemisionGuide.Create(
            id: Guid.NewGuid(),
            tenantId: Guid.NewGuid(),
            establishment: "001",
            emissionPoint: "001",
            sequential: "000000010",
            issueDate: new DateOnly(2026, 9, 14),
            startingAddress: "Bodega Matriz Quito",
            startDate: new DateOnly(2026, 9, 14),
            endDate: new DateOnly(2026, 9, 15),
            carrierIdentificationType: "04",
            carrierIdentification: "1790011223001",
            carrierName: "Flota Express Ecuador C.A.",
            licensePlate: "PBY-1234",
            recipientIdentificationType: "05",
            recipientIdentification: "1712345678",
            recipientName: "Juan Pérez",
            recipientAddress: "Ambato, Av. Cevallos 100",
            transferReason: "Venta directa de mercadería",
            routeDescription: "Quito - Ambato",
            carrierEmail: "chofer@express.ec",
            carrierPhone: "0987654321",
            supportDocumentType: "01",
            supportDocumentNumber: "001-001-000000999",
            supportDocumentAuth: "1409202601179001691900110010010000009991234567819").Value!;

        guide.SetAccessKey("1409202606179001691900110010010000000101234567812");

        var item = RemisionGuideItem.Create(Guid.NewGuid(), guide.Id, "REP-500", "Filtros de combustible para camión", 25m, "UNID").Value!;
        guide.AddItem(item);

        var xml = SriRemisionGuideXmlGenerator.GenerateXml(
            guide: guide,
            emitterRuc: "1790016919001",
            emitterRazonSocial: "EMPRESA DE TRANSPORTE Y LOGISTICA S.A.",
            emitterNombreComercial: "LOGISTICA EXPRESS",
            emitterDirMatriz: "Av. Amazonas N24-100, Quito",
            environment: "1",
            obligatedAccounting: true,
            isRimpe: false);

        Assert.NotNull(xml);
        Assert.Contains("<guiaRemision id=\"comprobante\" version=\"1.1.0\">", xml);
        Assert.Contains("<codDoc>06</codDoc>", xml);
        Assert.Contains("<placa>PBY-1234</placa>", xml);
        Assert.Contains("<razonSocialTransportista>Flota Express Ecuador C.A.</razonSocialTransportista>", xml);
        Assert.Contains("<dirPartida>Bodega Matriz Quito</dirPartida>", xml);
        Assert.Contains("<dirDestinatario>Ambato, Av. Cevallos 100</dirDestinatario>", xml);
        Assert.Contains("<motivoTraslado>Venta directa de mercadería</motivoTraslado>", xml);
        Assert.Contains("<ruta>Quito - Ambato</ruta>", xml);
        Assert.Contains("<codigoInterno>REP-500</codigoInterno>", xml);
        Assert.Contains("<cantidad>25.00</cantidad>", xml);
    }
}
