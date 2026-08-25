using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy.BrandLogos;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;
using FluentValidation;

namespace EcuNexo.Business.Tenancy.Commands.BrandLogos;

public sealed class UploadTenantBrandLogoHandler
    : ICommandHandler<UploadTenantBrandLogoCommand, UploadTenantBrandLogoResponse>
{
    private readonly IValidator<UploadTenantBrandLogoCommand> _validator;
    private readonly IIdGenerator _ids;
    private readonly ITenantRepository _tenants;
    private readonly ITenantBrandLogoRepository _logos;
    private readonly IUnitOfWork _unitOfWork;

    public UploadTenantBrandLogoHandler(
        IValidator<UploadTenantBrandLogoCommand> validator,
        IIdGenerator ids,
        ITenantRepository tenants,
        ITenantBrandLogoRepository logos,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _ids = ids;
        _tenants = tenants;
        _logos = logos;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UploadTenantBrandLogoResponse>> Handle(
        UploadTenantBrandLogoCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<UploadTenantBrandLogoResponse>(
                new Error("brand_logo.upload.validation", message, ErrorType.Validation));
        }

        var contentType = BrandLogoContent.ResolveContentType(command.ContentType, command.OriginalFileName);
        if (!BrandLogoContent.IsAllowedContentType(contentType))
        {
            contentType = BrandLogoContent.InferContentType(command.OriginalFileName);
        }
        if (!BrandLogoContent.IsAllowedContentType(contentType))
        {
            return Result.Failure<UploadTenantBrandLogoResponse>(
                new Error(
                    "brand_logo.content_type.unsupported",
                    "Usa PNG, JPG, WebP o SVG.",
                    ErrorType.Validation));
        }

        var payload = BrandLogoContent.ValidatePayload(contentType, command.ImageBytes);
        if (payload.IsFailure)
        {
            return Result.Failure<UploadTenantBrandLogoResponse>(payload.Error!);
        }

        var tenant = await _tenants.GetByIdForUpdateAsync(command.TenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<UploadTenantBrandLogoResponse>(
                new Error("tenant.not_found", "La empresa no existe.", ErrorType.NotFound));
        }

        var count = await _logos.CountByTenantAsync(command.TenantId, ct).ConfigureAwait(false);
        if (count >= TenantBrandLogo.MaxPerTenant)
        {
            return Result.Failure<UploadTenantBrandLogoResponse>(
                new Error(
                    "brand_logo.limit",
                    $"Puedes guardar hasta {TenantBrandLogo.MaxPerTenant} logos. Elimina uno para subir otro.",
                    ErrorType.Validation));
        }

        var extension = BrandLogoContent.ExtensionFromContentType(contentType, command.OriginalFileName);
        var created = TenantBrandLogo.Create(
            _ids.NewId(),
            command.TenantId,
            command.OriginalFileName,
            extension,
            contentType,
            command.ImageBytes);
        if (created.IsFailure)
        {
            return Result.Failure<UploadTenantBrandLogoResponse>(created.Error!);
        }

        var logo = created.Value!;
        await _logos.AddAsync(logo, ct).ConfigureAwait(false);

        if (tenant.LogoLightId is null && tenant.LogoDarkId is null && !tenant.PreferWordmark)
        {
            var assigned = tenant.SetBrandMarks(logo.Id, logo.Id, preferWordmark: false);
            if (assigned.IsFailure)
            {
                return Result.Failure<UploadTenantBrandLogoResponse>(assigned.Error!);
            }
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(
            new UploadTenantBrandLogoResponse(
                logo.Id,
                $"/api/v1/tenants/{command.TenantId}/brand-logos/{logo.Id}/file"));
    }
}
