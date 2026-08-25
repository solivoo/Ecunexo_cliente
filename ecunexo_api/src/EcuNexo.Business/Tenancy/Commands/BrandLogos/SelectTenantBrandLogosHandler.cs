using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Tenancy.Commands.BrandLogos;

public sealed class SelectTenantBrandLogosHandler
    : ICommandHandler<SelectTenantBrandLogosCommand, SelectTenantBrandLogosResponse>
{
    private readonly ITenantRepository _tenants;
    private readonly ITenantBrandLogoRepository _logos;
    private readonly IUnitOfWork _unitOfWork;

    public SelectTenantBrandLogosHandler(
        ITenantRepository tenants,
        ITenantBrandLogoRepository logos,
        IUnitOfWork unitOfWork)
    {
        _tenants = tenants;
        _logos = logos;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<SelectTenantBrandLogosResponse>> Handle(
        SelectTenantBrandLogosCommand command,
        CancellationToken ct)
    {
        var tenant = await _tenants.GetByIdForUpdateAsync(command.TenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<SelectTenantBrandLogosResponse>(
                new Error("tenant.not_found", "La empresa no existe.", ErrorType.NotFound));
        }

        if (command.LightLogoId is { } light
            && !await _logos.ExistsAsync(command.TenantId, light, ct).ConfigureAwait(false))
        {
            return Result.Failure<SelectTenantBrandLogosResponse>(
                new Error("brand_logo.light.not_found", "El logo claro no existe.", ErrorType.NotFound));
        }

        if (command.DarkLogoId is { } dark
            && !await _logos.ExistsAsync(command.TenantId, dark, ct).ConfigureAwait(false))
        {
            return Result.Failure<SelectTenantBrandLogosResponse>(
                new Error("brand_logo.dark.not_found", "El logo oscuro no existe.", ErrorType.NotFound));
        }

        var applied = tenant.SetBrandMarks(command.LightLogoId, command.DarkLogoId, command.PreferWordmark);
        if (applied.IsFailure)
        {
            return Result.Failure<SelectTenantBrandLogosResponse>(applied.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(
            new SelectTenantBrandLogosResponse(
                tenant.LogoLightId,
                tenant.LogoDarkId,
                tenant.PreferWordmark,
                tenant.LogoUrl));
    }
}
