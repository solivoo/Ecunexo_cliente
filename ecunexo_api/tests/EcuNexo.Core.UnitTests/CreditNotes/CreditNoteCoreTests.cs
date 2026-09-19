using EcuNexo.Core.CreditNotes;
using EcuNexo.Core.Purchases.Services;

namespace EcuNexo.Core.UnitTests.CreditNotes;

public class CreditNoteCoreTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    [Fact]
    public void Create_WithValidParameters_ReturnsSuccessAndDraftStatus()
    {
        // Arrange
        var id = Guid.NewGuid();
        var issueDate = new DateOnly(2026, 9, 18);
        var sustentoDate = new DateOnly(2026, 9, 10);

        // Act
        var result = CreditNote.Create(
            id: id,
            tenantId: TenantId,
            establishment: "001",
            emissionPoint: "002",
            sequential: "000000105",
            issueDate: issueDate,
            reasonType: CreditNoteReasonType.MerchandiseReturn,
            reason: "DEVOLUCIÓN DE MERCADERÍA DENTRO DEL PLAZO",
            modifiedDocumentType: "01",
            modifiedDocumentNumber: "001-002-000000050",
            modifiedDocumentIssueDate: sustentoDate,
            buyerIdentificationType: "04",
            buyerIdentification: "1792146739001",
            buyerName: "EMPRESA DE PRUEBA S.A.",
            buyerAddress: "AV. DE LOS SHYRIS Y PORTUGAL",
            buyerEmail: "cliente@prueba.com"
        );

        // Assert
        result.IsSuccess.Should().BeTrue();
        var creditNote = result.Value!;
        creditNote.Id.Should().Be(id);
        creditNote.TenantId.Should().Be(TenantId);
        creditNote.Establishment.Should().Be("001");
        creditNote.EmissionPoint.Should().Be("002");
        creditNote.Sequential.Should().Be("000000105");
        creditNote.DocumentNumber.Should().Be("001-002-000000105");
        creditNote.Status.Should().Be(CreditNoteStatus.Draft);
        creditNote.ReasonType.Should().Be(CreditNoteReasonType.MerchandiseReturn);
        creditNote.Reason.Should().Be("DEVOLUCIÓN DE MERCADERÍA DENTRO DEL PLAZO");
        creditNote.ModifiedDocumentType.Should().Be("01");
        creditNote.ModifiedDocumentNumber.Should().Be("001-002-000000050");
        creditNote.ModifiedDocumentIssueDate.Should().Be(sustentoDate);
        creditNote.BuyerIdentification.Should().Be("1792146739001");
    }

    [Fact]
    public void Create_WithInvalidModifiedDocumentNumber_ReturnsFailure()
    {
        // Act
        var result = CreditNote.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            establishment: "001",
            emissionPoint: "001",
            sequential: "000000001",
            issueDate: new DateOnly(2026, 9, 18),
            reasonType: CreditNoteReasonType.PriceAdjustment,
            reason: "DESCUENTO POSTERIOR EN FACTURA",
            modifiedDocumentType: "01",
            modifiedDocumentNumber: "12345", // Inválido
            modifiedDocumentIssueDate: new DateOnly(2026, 9, 15),
            buyerIdentificationType: "04",
            buyerIdentification: "1792146739001",
            buyerName: "EMPRESA PRUEBA",
            buyerAddress: "QUITO"
        );

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("credit_note.modified_document_format_invalid");
    }

    [Fact]
    public void Create_WhenIssueDateBeforeSustentoDate_ReturnsFailure()
    {
        // Act
        var result = CreditNote.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            establishment: "001",
            emissionPoint: "001",
            sequential: "000000001",
            issueDate: new DateOnly(2026, 9, 01), // Antes de la factura
            reasonType: CreditNoteReasonType.MerchandiseReturn,
            reason: "DEVOLUCIÓN PARCIAL",
            modifiedDocumentType: "01",
            modifiedDocumentNumber: "001-001-000000099",
            modifiedDocumentIssueDate: new DateOnly(2026, 9, 10), // Posterior
            buyerIdentificationType: "04",
            buyerIdentification: "1792146739001",
            buyerName: "EMPRESA PRUEBA",
            buyerAddress: "QUITO"
        );

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("credit_note.issue_date_before_sustento");
    }

    [Fact]
    public void AddItem_RecalculatesTotalsAndTaxBreakdownCorrectly()
    {
        // Arrange
        var creditNote = CreditNote.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            establishment: "001",
            emissionPoint: "001",
            sequential: "000000001",
            issueDate: new DateOnly(2026, 9, 18),
            reasonType: CreditNoteReasonType.MerchandiseReturn,
            reason: "DEVOLUCIÓN DE PRODUCTOS",
            modifiedDocumentType: "01",
            modifiedDocumentNumber: "001-001-000000001",
            modifiedDocumentIssueDate: new DateOnly(2026, 9, 15),
            buyerIdentificationType: "04",
            buyerIdentification: "1792146739001",
            buyerName: "CLIENTE TEST",
            buyerAddress: "GUAYAQUIL"
        ).Value!;

        // Item 1: IVA 15% (2 unidades x $50.00 = $100.00 subtotal, IVA $15.00)
        var item1 = CreditNoteItem.Create(
            id: Guid.NewGuid(),
            creditNoteId: creditNote.Id,
            lineNumber: 1,
            itemCode: "PROD-15",
            additionalCode: "SKU-15",
            description: "PRODUCTO TARIFA 15%",
            quantity: 2.0m,
            unitPrice: 50.0m,
            discount: 0.0m,
            vatPercentageCode: "4",
            vatRate: 15.0m
        ).Value!;

        // Item 2: IVA 0% (1 unidad x $20.00 = $20.00 subtotal, IVA $0.00)
        var item2 = CreditNoteItem.Create(
            id: Guid.NewGuid(),
            creditNoteId: creditNote.Id,
            lineNumber: 2,
            itemCode: "PROD-0",
            additionalCode: "SKU-0",
            description: "PRODUCTO TARIFA 0%",
            quantity: 1.0m,
            unitPrice: 20.0m,
            discount: 0.0m,
            vatPercentageCode: "0",
            vatRate: 0.0m
        ).Value!;

        // Act
        creditNote.AddItem(item1).IsSuccess.Should().BeTrue();
        creditNote.AddItem(item2).IsSuccess.Should().BeTrue();

        // Assert
        creditNote.Items.Should().HaveCount(2);
        creditNote.SubtotalWithoutTaxes.Should().Be(120.00m);
        creditNote.SubtotalVat15.Should().Be(100.00m);
        creditNote.SubtotalVat0.Should().Be(20.00m);
        creditNote.VatAmount.Should().Be(15.00m);
        creditNote.ModificationValue.Should().Be(135.00m);
    }

    [Fact]
    public void GenerateAccessKey_ForCreditNoteDocType04_Returns49DigitsWithModulo11CheckDigit()
    {
        // Act
        var accessKey = SriAccessKeyGenerator.Generate(
            issueDate: new DateOnly(2026, 9, 18),
            documentType: "04",
            emitterRuc: "1792146739001",
            environment: "2",
            establishment: "001",
            emissionPoint: "001",
            sequential: "000000001"
        );

        // Assert
        accessKey.Should().HaveLength(49);
        accessKey.Substring(8, 2).Should().Be("04"); // Tipo Comprobante
        accessKey[23].Should().Be('2'); // Ambiente Producción
    }
}
