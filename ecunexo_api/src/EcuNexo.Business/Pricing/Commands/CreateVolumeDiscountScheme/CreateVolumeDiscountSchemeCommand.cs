using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Pricing;

namespace EcuNexo.Business.Pricing.Commands.CreateVolumeDiscountScheme;

public sealed record CreateVolumeDiscountSchemeCommand(
    Guid TenantId,
    string Name,
    string? Description,
    VolumeDiscountSchemeType Type,
    IReadOnlyList<VolumeDiscountTierInput>? Tiers = null) : ICommand<CreateVolumeDiscountSchemeResponse>;

public sealed record CreateVolumeDiscountSchemeResponse(Guid SchemeId, Guid TenantId);

public sealed class CreateVolumeDiscountSchemeHandler : ICommandHandler<CreateVolumeDiscountSchemeCommand, CreateVolumeDiscountSchemeResponse>
{
    private readonly IIdGenerator _idGenerator;
    private readonly ICallerContext _caller;
    private readonly IVolumeDiscountSchemeRepository _schemes;
    private readonly IUnitOfWork _unitOfWork;

    public CreateVolumeDiscountSchemeHandler(
        IIdGenerator idGenerator,
        ICallerContext caller,
        IVolumeDiscountSchemeRepository schemes,
        IUnitOfWork unitOfWork)
    {
        _idGenerator = idGenerator;
        _caller = caller;
        _schemes = schemes;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CreateVolumeDiscountSchemeResponse>> Handle(
        CreateVolumeDiscountSchemeCommand command,
        CancellationToken ct)
    {
        var normalizedName = command.Name.Trim();
        if (await _schemes.NameExistsAsync(command.TenantId, normalizedName, null, ct).ConfigureAwait(false))
        {
            return Result.Failure<CreateVolumeDiscountSchemeResponse>(
                new Error("catalog.pricing.volume_scheme.name.duplicate", "Ya existe un esquema de descuento con el mismo nombre.", ErrorType.Conflict));
        }

        var schemeId = _idGenerator.NewId();
        var created = VolumeDiscountScheme.Create(
            schemeId,
            command.TenantId,
            normalizedName,
            command.Description,
            command.Type,
            _caller.UserId);

        if (created.IsFailure)
        {
            return Result.Failure<CreateVolumeDiscountSchemeResponse>(created.Error!);
        }

        var scheme = created.Value!;

        if (command.Tiers is not null)
        {
            foreach (var tier in command.Tiers.OrderBy(t => t.QuantityFrom))
            {
                var tierResult = scheme.AddTier(
                    _idGenerator.NewId(),
                    tier.QuantityFrom,
                    tier.QuantityTo,
                    tier.Value,
                    _caller.UserId);

                if (tierResult.IsFailure)
                {
                    return Result.Failure<CreateVolumeDiscountSchemeResponse>(tierResult.Error!);
                }
            }
        }

        await _schemes.AddAsync(scheme, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new CreateVolumeDiscountSchemeResponse(scheme.Id, scheme.TenantId));
    }
}
