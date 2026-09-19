using EcuNexo.Business.Abstractions;
using EcuNexo.Business.CreditNotes.Commands.CreateCreditNote;
using EcuNexo.Business.CreditNotes.Queries.GetCreditNoteById;
using EcuNexo.Business.CreditNotes.Queries.ListCreditNotes;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.CreditNotes;
using EcuNexo.Core.Tenancy;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.CreditNotes;

public class CreditNoteBusinessTests
{
    private readonly ICreditNoteRepository _repository = Substitute.For<ICreditNoteRepository>();
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly IIdGenerator _idGenerator = Substitute.For<IIdGenerator>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    public CreditNoteBusinessTests()
    {
        _idGenerator.NewId().Returns(_ => Guid.NewGuid());
    }

    [Fact]
    public async Task CreateCreditNoteHandler_WhenTenantNotFound_ReturnsNotFound()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns((Tenant?)null);

        var handler = new CreateCreditNoteHandler(_repository, _tenants, _idGenerator, _unitOfWork);
        var command = new CreateCreditNoteCommand(
            TenantId: tenantId,
            Establishment: "001",
            EmissionPoint: "001",
            Sequential: null,
            IssueDate: new DateOnly(2026, 9, 18),
            ReasonType: CreditNoteReasonType.MerchandiseReturn,
            Reason: "DEVOLUCIÓN DE MERCADERÍA",
            ModifiedDocumentType: "01",
            ModifiedDocumentNumber: "001-001-000000001",
            ModifiedDocumentIssueDate: new DateOnly(2026, 9, 10),
            BuyerIdentificationType: "04",
            BuyerIdentification: "1792146739001",
            BuyerName: "CLIENTE PRUEBA S.A.",
            BuyerAddress: "QUITO",
            Items: new[]
            {
                new CreateCreditNoteItemInput("PROD-1", "SKU-1", "DESCRIPCION", 1.0m, 10.0m)
            }
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error!.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task CreateCreditNoteHandler_WhenItemsEmpty_ReturnsValidationFailure()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var tenant = Tenant.Create(tenantId, "Empresa Ejemplo", new ServicePlan("Plan", 10, 5)).Value!;
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(tenant);

        var handler = new CreateCreditNoteHandler(_repository, _tenants, _idGenerator, _unitOfWork);
        var command = new CreateCreditNoteCommand(
            TenantId: tenantId,
            Establishment: "001",
            EmissionPoint: "001",
            Sequential: null,
            IssueDate: new DateOnly(2026, 9, 18),
            ReasonType: CreditNoteReasonType.MerchandiseReturn,
            Reason: "DEVOLUCIÓN DE MERCADERÍA",
            ModifiedDocumentType: "01",
            ModifiedDocumentNumber: "001-001-000000001",
            ModifiedDocumentIssueDate: new DateOnly(2026, 9, 10),
            BuyerIdentificationType: "04",
            BuyerIdentification: "1792146739001",
            BuyerName: "CLIENTE PRUEBA S.A.",
            BuyerAddress: "QUITO",
            Items: Array.Empty<CreateCreditNoteItemInput>()
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("credit_note.items.empty");
    }

    [Fact]
    public async Task CreateCreditNoteHandler_WithValidCommand_CreatesCreditNoteAndReturnsResponse()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var tenant = Tenant.Create(tenantId, "Distribuidora Nacional S.A.", new ServicePlan("Plan Enterprise", 10, 5)).Value!;
        tenant.UpdateSriLegalProfile(
            taxId: "1792146739001",
            legalName: "Distribuidora Nacional S.A.",
            city: "Quito",
            establishmentCode: "001",
            address: "Av. Galo Plaza Lasso N45-120",
            accountingRequired: true,
            rimpeKind: RimpeKind.None,
            preferElectronicInvoice: true,
            isExporter: false,
            isLargeTaxpayer: false,
            isSpecialTaxpayer: false,
            isWithholdingAgent: false
        );

        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(tenant);
        _repository.AllocateNextSequentialAsync(tenantId, "001", "001", "1", Arg.Any<CancellationToken>())
            .Returns("000000005");

        var handler = new CreateCreditNoteHandler(_repository, _tenants, _idGenerator, _unitOfWork);
        var command = new CreateCreditNoteCommand(
            TenantId: tenantId,
            Establishment: "001",
            EmissionPoint: "001",
            Sequential: null,
            IssueDate: new DateOnly(2026, 9, 18),
            ReasonType: CreditNoteReasonType.MerchandiseReturn,
            Reason: "DEVOLUCIÓN PARCIAL DE PRODUCTOS POR DEFECTO",
            ModifiedDocumentType: "01",
            ModifiedDocumentNumber: "001-001-000000050",
            ModifiedDocumentIssueDate: new DateOnly(2026, 9, 10),
            BuyerIdentificationType: "04",
            BuyerIdentification: "1713328506001",
            BuyerName: "CLIENTE FINAL COMPRADOR S.A.",
            BuyerAddress: "GUAYAQUIL",
            BuyerEmail: "ventas@cliente.com",
            Items: new[]
            {
                new CreateCreditNoteItemInput(
                    ItemCode: "ITEM-100",
                    AdditionalCode: "SKU-A100",
                    Description: "TECLADO MECÁNICO RGB",
                    Quantity: 2.0m,
                    UnitPrice: 40.0m,
                    Discount: 0.0m,
                    VatPercentageCode: "4",
                    VatRate: 15.0m
                )
            }
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var response = result.Value!;
        response.DocumentNumber.Should().Be("001-001-000000005");
        response.AccessKey.Should().HaveLength(49);
        response.Status.Should().Be(CreditNoteStatus.Draft);
        response.SubtotalWithoutTaxes.Should().Be(80.00m);
        response.VatAmount.Should().Be(12.00m);
        response.ModificationValue.Should().Be(92.00m);

        await _repository.Received(1).AddAsync(Arg.Any<CreditNote>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ListCreditNotesHandler_ReturnsPaginatedItemsAndKpis()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var cn1 = CreditNote.Create(
            id: Guid.NewGuid(),
            tenantId: tenantId,
            establishment: "001",
            emissionPoint: "001",
            sequential: "000000001",
            issueDate: new DateOnly(2026, 9, 18),
            reasonType: CreditNoteReasonType.MerchandiseReturn,
            reason: "DEVOLUCIÓN DE MERCADERÍA",
            modifiedDocumentType: "01",
            modifiedDocumentNumber: "001-001-000000010",
            modifiedDocumentIssueDate: new DateOnly(2026, 9, 10),
            buyerIdentificationType: "04",
            buyerIdentification: "1792146739001",
            buyerName: "CLIENTE A",
            buyerAddress: "QUITO"
        ).Value!;

        cn1.AddItem(CreditNoteItem.Create(Guid.NewGuid(), cn1.Id, 1, "P1", null, "PROD 1", 1m, 100m, 0m, "4", 15m).Value!);

        var creditNotesList = new List<CreditNote> { cn1 };
        _repository.ListAsync(tenantId, null, null, null, null, null, 1, 20, Arg.Any<CancellationToken>())
            .Returns((creditNotesList, 1));

        var handler = new ListCreditNotesHandler(_repository);
        var query = new ListCreditNotesQuery(tenantId);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var response = result.Value!;
        response.TotalCount.Should().Be(1);
        response.Items.Should().HaveCount(1);
        response.Kpis.TotalCount.Should().Be(1);
        response.Kpis.MerchandiseReturnsCount.Should().Be(1);
        response.Kpis.TotalModifiedValue.Should().Be(115.00m);
    }

    [Fact]
    public async Task GetCreditNoteByIdHandler_WhenNotFound_ReturnsNotFoundFailure()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var creditNoteId = Guid.NewGuid();
        _repository.GetByIdAsync(tenantId, creditNoteId, Arg.Any<CancellationToken>()).Returns((CreditNote?)null);

        var handler = new GetCreditNoteByIdHandler(_repository);

        // Act
        var result = await handler.Handle(new GetCreditNoteByIdQuery(tenantId, creditNoteId), CancellationToken.None);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error!.Type.Should().Be(ErrorType.NotFound);
    }
}
