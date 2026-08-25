using EcuNexo.Core.Identity;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class CreateRoleValidator : AbstractValidator<CreateRoleCommand>
{
    public CreateRoleValidator()
    {
        RuleFor(x => x.TenantId)
            .NotEmpty();

        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(Role.NameMaxLength);

        RuleFor(x => x.Description!)
            .MaximumLength(Role.DescriptionMaxLength)
            .When(x => x.Description is not null);
    }
}
