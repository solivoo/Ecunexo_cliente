using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Tenancy.Commands.BrandLogos;

public sealed class DeleteTenantBrandLogoHandler
    : ICommandHandler<DeleteTenantBrandLogoCommand, DeleteTenantBrandLogoResponse>
{
    private readonly ITenantRepository _tenants;
    private readonly ITenantBrandLogoRepository _logos;
    private readonly IUnitOfWork _unitOfWork;

    public DeleteTenantBrandLogoHandler(
        ITenantRepository tenants,
        ITenantBrandLogoRepository logos,
        IUnitOfWork unitOfWork)
    {
        _tenants = tenants;
        _logos = logos;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<DeleteTenantBrandLogoResponse>> Handle(
        DeleteTenantBrandLogoCommand command,
        CancellationToken ct)
    {
        var tenant = await _tenants.GetByIdForUpdateAsync(command.TenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<DeleteTenantBrandLogoResponse>(
                new Error("tenant.not_found", "La empresa no existe.", ErrorType.NotFound));
        }

        var logo = await _logos.GetByIdForUpdateAsync(command.TenantId, command.LogoId, ct)
            .ConfigureAwait(false);
        if (logo is null)
        {
            return Result.Failure<DeleteTenantBrandLogoResponse>(
                new Error("brand_logo.not_found", "El logo no existe.", ErrorType.NotFound));
        }

        var light = tenant.LogoLightId == command.LogoId ? null : tenant.LogoLightId;
        var dark = tenant.LogoDarkId == command.LogoId ? null : tenant.LogoDarkId;
        if (light != tenant.LogoLightId || dark != tenant.LogoDarkId)
        {
            var cleared = tenant.SetBrandMarks(light, dark, tenant.PreferWordmark);
            if (cleared.IsFailure)
            {
                return Result.Failure<DeleteTenantBrandLogoResponse>(cleared.Error!);
            }
        }

        _logos.Remove(logo);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new DeleteTenantBrandLogoResponse(command.LogoId));
    }
}
