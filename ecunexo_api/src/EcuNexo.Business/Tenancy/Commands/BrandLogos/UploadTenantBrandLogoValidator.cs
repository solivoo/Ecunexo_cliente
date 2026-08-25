using FluentValidation;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy.Commands.BrandLogos;

public sealed class UploadTenantBrandLogoValidator : AbstractValidator<UploadTenantBrandLogoCommand>
{
    public UploadTenantBrandLogoValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.OriginalFileName).NotEmpty().MaximumLength(TenantBrandLogo.FileNameMaxLength);
        RuleFor(x => x.ContentType).MaximumLength(TenantBrandLogo.ContentTypeMaxLength);
        RuleFor(x => x.ImageBytes).NotEmpty();
        RuleFor(x => x.ImageBytes.Length)
            .LessThanOrEqualTo(TenantBrandLogo.MaxBytes)
            .WithMessage($"El logo no puede superar {TenantBrandLogo.MaxBytes / 1024} KB.");
    }
}
