using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class ReplaceRolePermissionsValidator : AbstractValidator<ReplaceRolePermissionsCommand>
{
    public ReplaceRolePermissionsValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.RoleId).NotEmpty();
        RuleFor(x => x.PermissionIds).NotNull();
        RuleForEach(x => x.PermissionIds).NotEmpty();
    }
}
