using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class UnassignRolePermissionValidator : AbstractValidator<UnassignRolePermissionCommand>
{
    public UnassignRolePermissionValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.RoleId).NotEmpty();
        RuleFor(x => x.PermissionId).NotEmpty();
    }
}
