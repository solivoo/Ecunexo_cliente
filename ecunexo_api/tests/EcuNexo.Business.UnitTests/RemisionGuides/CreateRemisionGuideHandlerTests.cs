using EcuNexo.Business.Abstractions;
using EcuNexo.Business.RemisionGuides;
using EcuNexo.Business.RemisionGuides.Commands.CreateRemisionGuide;
using EcuNexo.Business.RemisionGuides.Commands.UpdateRemisionGuideStatus;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.RemisionGuides;
using EcuNexo.Core.Tenancy;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.RemisionGuides;

public sealed class CreateRemisionGuideHandlerTests
{
    private readonly IRemisionGuideRepository _repository = Substitute.For<IRemisionGuideRepository>();
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly IIdGenerator _idGenerator = Substitute.For<IIdGenerator>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private CreateRemisionGuideHandler CreateSut()
    {
        _idGenerator.NewId().Returns(_ => Guid.NewGuid());
        return new CreateRemisionGuideHandler(_repository, _tenants, _idGenerator, _unitOfWork);
    }

    [Fact(DisplayName = "CreateRemisionGuideHandler crea la guía, genera clave y XML correctamente")]
    public async Task Handle_ValidCommand_CreatesGuideAndReturnsResponse()
    {
        var tenantId = Guid.NewGuid();
        var issueDate = new DateOnly(2026, 9, 14);

        var tenant = Tenant.Create(
            tenantId,
            "TransLogística del Ecuador Cía. Ltda.",
            new ServicePlan("Empresa", 10, 5)).Value!;
        tenant.UpdateSriLegalProfile(
            taxId: "1790016919001",
            legalName: "TransLogística S.A.",
            city: "Quito",
            establishmentCode: "001",
            address: "Av. Galo Plaza Lasso",
            accountingRequired: true,
            rimpeKind: RimpeKind.None,
            preferElectronicInvoice: true,
            isExporter: false,
            isLargeTaxpayer: false,
            isSpecialTaxpayer: false,
            isWithholdingAgent: false);

        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(tenant);
        _repository.GetNextSequentialAsync(tenantId, "001", "001", Arg.Any<CancellationToken>()).Returns("000000005");
        _repository.ExistsSequentialAsync(tenantId, "001", "001", "000000005", null, Arg.Any<CancellationToken>()).Returns(false);

        var sut = CreateSut();

        var command = new CreateRemisionGuideCommand(
            TenantId: tenantId,
            Establishment: "001",
            EmissionPoint: "001",
            Sequential: "000000005",
            IssueDate: issueDate,
            StartingAddress: "Quito, Bodega Norte",
            StartDate: issueDate,
            EndDate: issueDate.AddDays(1),
            CarrierIdentificationType: "04",
            CarrierIdentification: "1791122334001",
            CarrierName: "Logística Andina Express",
            LicensePlate: "PBX-9000",
            RecipientIdentificationType: "04",
            RecipientIdentification: "0990001234001",
            RecipientName: "Comercializadora Guayaquil",
            RecipientAddress: "Guayaquil, Vía a Daule Km 12",
            TransferReason: "Venta de mercadería al por mayor",
            RouteDescription: "Quito - Guayaquil vía Calacalí",
            CarrierEmail: "despacho@andina.ec",
            CarrierPhone: "0991234567",
            SupportDocumentType: "01",
            SupportDocumentNumber: "001-001-000005432",
            SupportDocumentAuth: "1409202601179001691900110010010000054321234567812",
            Items:
            [
                new CreateRemisionGuideItemInput("PALLET-01", "Pallets de bebidas y alimentos", 12m, "PALLETS")
            ],
            EmitSri: true);

        var result = await sut.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        var resp = result.Value;
        Assert.NotNull(resp);
        Assert.Equal("001-001-000000005", resp.DocumentNumber);
        Assert.Equal(49, resp.AccessKey.Length);
        Assert.Equal(RemisionGuideStatus.Authorized, resp.Status);
        Assert.NotNull(resp.AuthorizationNumber);
        Assert.Contains("<guiaRemision", resp.XmlContent);
        Assert.Contains("PBX-9000", resp.XmlContent);

        await _repository.Received(1).AddAsync(Arg.Is<RemisionGuide>(g => g.LicensePlate == "PBX-9000"), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "CreateRemisionGuideHandler rechaza secuencial duplicado")]
    public async Task Handle_DuplicateSequential_ReturnsConflict()
    {
        var tenantId = Guid.NewGuid();
        var issueDate = new DateOnly(2026, 9, 14);

        var tenant = Tenant.Create(
            tenantId,
            "Empresa Transporte",
            new ServicePlan("Empresa", 10, 5)).Value!;

        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(tenant);
        _repository.ExistsSequentialAsync(tenantId, "001", "001", "000000010", null, Arg.Any<CancellationToken>()).Returns(true);

        var sut = CreateSut();

        var command = new CreateRemisionGuideCommand(
            TenantId: tenantId,
            Establishment: "001",
            EmissionPoint: "001",
            Sequential: "000000010",
            IssueDate: issueDate,
            StartingAddress: "Quito",
            StartDate: issueDate,
            EndDate: issueDate,
            CarrierIdentificationType: "04",
            CarrierIdentification: "1791122334001",
            CarrierName: "Logística Andina",
            LicensePlate: "PBX-9000",
            RecipientIdentificationType: "04",
            RecipientIdentification: "0990001234001",
            RecipientName: "Comercializadora Guayaquil",
            RecipientAddress: "Guayaquil",
            TransferReason: "Venta",
            RouteDescription: "Quito - Guayaquil");

        var result = await sut.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("remision_guide.sequential.duplicate", result.Error?.Code);
    }

    [Fact(DisplayName = "UpdateRemisionGuideStatusHandler cambia estado a En Tránsito y Entregada")]
    public async Task Handle_StatusTransitions_Succeeds()
    {
        var tenantId = Guid.NewGuid();
        var guideId = Guid.NewGuid();
        var guide = RemisionGuide.Create(
            guideId,
            tenantId,
            "001",
            "001",
            "000000001",
            new DateOnly(2026, 9, 14),
            "Quito",
            new DateOnly(2026, 9, 14),
            new DateOnly(2026, 9, 15),
            "04",
            "1791122334001",
            "Transportista",
            "PBA-1234",
            "04",
            "0990001234001",
            "Cliente",
            "Guayaquil",
            "Venta",
            "Quito - Guayaquil").Value!;

        guide.MarkAuthorized("1409202606179001691900110010010000000011234567812");

        _repository.GetByIdAsync(tenantId, guideId, Arg.Any<CancellationToken>()).Returns(guide);

        var handler = new UpdateRemisionGuideStatusHandler(_repository, _unitOfWork);

        // 1. Poner en tránsito
        var transitCmd = new UpdateRemisionGuideStatusCommand(tenantId, guideId, RemisionGuideStatus.InTransit);
        var transitResult = await handler.Handle(transitCmd, CancellationToken.None);
        Assert.True(transitResult.IsSuccess);
        Assert.Equal(RemisionGuideStatus.InTransit, guide.Status);

        // 2. Marcar entregada
        var deliveredCmd = new UpdateRemisionGuideStatusCommand(tenantId, guideId, RemisionGuideStatus.Delivered);
        var deliveredResult = await handler.Handle(deliveredCmd, CancellationToken.None);
        Assert.True(deliveredResult.IsSuccess);
        Assert.Equal(RemisionGuideStatus.Delivered, guide.Status);
    }
}
