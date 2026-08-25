using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class UnassignUserRoleValidator : AbstractValidator<UnassignUserRoleCommand>
{
    public UnassignUserRoleValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.RoleId).NotEmpty();
    }
}
