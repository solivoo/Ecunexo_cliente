using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class GrantRolePermissionValidator : AbstractValidator<GrantRolePermissionCommand>
{
    public GrantRolePermissionValidator()
    {
        RuleFor(x => x.TenantId)
            .NotEmpty();

        RuleFor(x => x.RoleId)
            .NotEmpty();

        RuleFor(x => x.PermissionId)
            .NotEmpty();
    }
}
