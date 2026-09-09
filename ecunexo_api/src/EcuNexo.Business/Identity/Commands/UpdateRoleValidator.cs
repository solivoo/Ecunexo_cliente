using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class UpdateRoleValidator : AbstractValidator<UpdateRoleCommand>
{
    public UpdateRoleValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.RoleId).NotEmpty();
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(Core.Identity.Role.NameMaxLength);
        RuleFor(x => x.Description)
            .MaximumLength(Core.Identity.Role.DescriptionMaxLength)
            .When(x => x.Description is not null);
    }
}
