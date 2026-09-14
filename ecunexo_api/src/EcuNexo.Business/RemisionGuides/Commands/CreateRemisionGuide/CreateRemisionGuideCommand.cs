using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Purchases.Services;
using EcuNexo.Core.RemisionGuides;

namespace EcuNexo.Business.RemisionGuides.Commands.CreateRemisionGuide;

public sealed record CreateRemisionGuideItemInput(
    string ItemCode,
    string Description,
    decimal Quantity,
    string? UnitOfMeasure = null,
    string? InternalReference = null);

public sealed record CreateRemisionGuideCommand(
    Guid TenantId,
    string Establishment,
    string EmissionPoint,
    string? Sequential,
    DateOnly IssueDate,
    string StartingAddress,
    DateOnly StartDate,
    DateOnly EndDate,
    string CarrierIdentificationType,
    string CarrierIdentification,
    string CarrierName,
    string LicensePlate,
    string RecipientIdentificationType,
    string RecipientIdentification,
    string RecipientName,
    string RecipientAddress,
    string TransferReason,
    string RouteDescription,
    string? CarrierEmail = null,
    string? CarrierPhone = null,
    string? SupportDocumentType = null,
    string? SupportDocumentNumber = null,
    string? SupportDocumentAuth = null,
    string? CustomsDocumentNumber = null,
    IReadOnlyList<CreateRemisionGuideItemInput>? Items = null,
    bool EmitSri = false,
    Guid? UserId = null) : ICommand<CreateRemisionGuideResponse>;

public sealed record CreateRemisionGuideResponse(
    Guid GuideId,
    string DocumentNumber,
    string AccessKey,
    RemisionGuideStatus Status,
    string? AuthorizationNumber,
    string? XmlContent);

public sealed class CreateRemisionGuideHandler : ICommandHandler<CreateRemisionGuideCommand, CreateRemisionGuideResponse>
{
    private readonly IRemisionGuideRepository _repository;
    private readonly ITenantRepository _tenants;
    private readonly IIdGenerator _idGenerator;
    private readonly IUnitOfWork _unitOfWork;

    public CreateRemisionGuideHandler(
        IRemisionGuideRepository repository,
        ITenantRepository tenants,
        IIdGenerator idGenerator,
        IUnitOfWork unitOfWork)
    {
        _repository = repository;
        _tenants = tenants;
        _idGenerator = idGenerator;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CreateRemisionGuideResponse>> Handle(CreateRemisionGuideCommand command, CancellationToken ct = default)
    {
        if (command.TenantId == Guid.Empty)
        {
            return Result.Failure<CreateRemisionGuideResponse>(new Error("remision_guide.tenant_id.empty", "El tenantId es obligatorio.", ErrorType.Validation));
        }

        var tenant = await _tenants.GetByIdAsync(command.TenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<CreateRemisionGuideResponse>(new Error("remision_guide.tenant.not_found", "La empresa no existe.", ErrorType.NotFound));
        }

        var estab = (command.Establishment?.Trim() ?? "001").PadLeft(3, '0');
        var pto = (command.EmissionPoint?.Trim() ?? "001").PadLeft(3, '0');
        string seq;

        if (string.IsNullOrWhiteSpace(command.Sequential))
        {
            seq = await _repository.GetNextSequentialAsync(command.TenantId, estab, pto, ct).ConfigureAwait(false);
        }
        else
        {
            seq = command.Sequential.Trim().PadLeft(9, '0');
            var exists = await _repository.ExistsSequentialAsync(command.TenantId, estab, pto, seq, null, ct).ConfigureAwait(false);
            if (exists)
            {
                return Result.Failure<CreateRemisionGuideResponse>(
                    new Error("remision_guide.sequential.duplicate", $"Ya existe una guía de remisión registrada con el número '{estab}-{pto}-{seq}'.", ErrorType.Conflict));
            }
        }

        var tenantRuc = string.IsNullOrWhiteSpace(tenant.TaxId) ? "1790016919001" : tenant.TaxId.Trim();
        var env = "1";

        // Generar clave de acceso reglamentaria SRI Módulo 11 para tipo '06'
        var accessKey = SriAccessKeyGenerator.Generate(
            issueDate: command.IssueDate,
            documentType: "06",
            emitterRuc: tenantRuc,
            environment: env,
            establishment: estab,
            emissionPoint: pto,
            sequential: seq);

        var guideId = _idGenerator.NewId();
        var guideResult = RemisionGuide.Create(
            id: guideId,
            tenantId: command.TenantId,
            establishment: estab,
            emissionPoint: pto,
            sequential: seq,
            issueDate: command.IssueDate,
            startingAddress: string.IsNullOrWhiteSpace(command.StartingAddress) ? (tenant.Address ?? "Quito, Ecuador") : command.StartingAddress.Trim(),
            startDate: command.StartDate,
            endDate: command.EndDate,
            carrierIdentificationType: command.CarrierIdentificationType,
            carrierIdentification: command.CarrierIdentification,
            carrierName: command.CarrierName,
            licensePlate: command.LicensePlate,
            recipientIdentificationType: command.RecipientIdentificationType,
            recipientIdentification: command.RecipientIdentification,
            recipientName: command.RecipientName,
            recipientAddress: command.RecipientAddress,
            transferReason: command.TransferReason,
            routeDescription: command.RouteDescription,
            carrierEmail: command.CarrierEmail,
            carrierPhone: command.CarrierPhone,
            supportDocumentType: command.SupportDocumentType,
            supportDocumentNumber: command.SupportDocumentNumber,
            supportDocumentAuth: command.SupportDocumentAuth,
            customsDocumentNumber: command.CustomsDocumentNumber,
            accessKey: accessKey,
            createdBy: command.UserId);

        if (guideResult.IsFailure)
        {
            return Result.Failure<CreateRemisionGuideResponse>(guideResult.Error!);
        }

        var guide = guideResult.Value!;

        // Agregar ítems transportados
        if (command.Items is not null && command.Items.Count > 0)
        {
            foreach (var itemInput in command.Items)
            {
                var itemId = _idGenerator.NewId();
                var itemResult = RemisionGuideItem.Create(
                    id: itemId,
                    remisionGuideId: guide.Id,
                    itemCode: itemInput.ItemCode,
                    description: itemInput.Description,
                    quantity: itemInput.Quantity,
                    unitOfMeasure: itemInput.UnitOfMeasure,
                    internalReference: itemInput.InternalReference);

                if (itemResult.IsFailure)
                {
                    return Result.Failure<CreateRemisionGuideResponse>(itemResult.Error!);
                }

                if (itemResult.Value is not null)
                {
                    guide.AddItem(itemResult.Value);
                }
            }
        }
        else
        {
            // Mínimo 1 ítem por defecto si no se especificaron
            var itemId = _idGenerator.NewId();
            var itemResult = RemisionGuideItem.Create(
                id: itemId,
                remisionGuideId: guide.Id,
                itemCode: "FLETE-01",
                description: "Carga general / mercadería transportada",
                quantity: 1m,
                unitOfMeasure: "UNID");

            if (itemResult.IsSuccess && itemResult.Value is not null)
            {
                guide.AddItem(itemResult.Value);
            }
        }

        // Generar XML reglamentario SRI v1.1.0
        var xml = SriRemisionGuideXmlGenerator.GenerateXml(
            guide: guide,
            emitterRuc: tenantRuc,
            emitterRazonSocial: tenant.LegalName ?? tenant.Name,
            emitterNombreComercial: tenant.Name != tenant.LegalName ? tenant.Name : null,
            emitterDirMatriz: tenant.Address ?? "Quito, Ecuador",
            environment: env,
            obligatedAccounting: tenant.AccountingRequired,
            isRimpe: tenant.IsRimpe);

        guide.SetXmlContent(xml);

        // Si se solicita emisión inmediata al SRI
        if (command.EmitSri)
        {
            // En flujo offline SRI, un documento emitido genera autorización vinculada a la clave de acceso
            guide.MarkAuthorized(accessKey, DateTimeOffset.UtcNow, command.UserId);
        }

        await _repository.AddAsync(guide, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new CreateRemisionGuideResponse(
            guide.Id,
            guide.DocumentNumber,
            guide.AccessKey,
            guide.Status,
            guide.AuthorizationNumber,
            guide.XmlContent));
    }
}
