using EcuNexo.Core.Identity;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class CreatePermissionValidator : AbstractValidator<CreatePermissionCommand>
{
    public CreatePermissionValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty()
            .MaximumLength(Permission.CodeMaxLength);

        RuleFor(x => x.Description!)
            .MaximumLength(Permission.DescriptionMaxLength)
            .When(x => x.Description is not null);

        RuleFor(x => x.DisplayName!)
            .MaximumLength(Permission.DisplayNameMaxLength)
            .When(x => x.DisplayName is not null);

        RuleFor(x => x.Module!)
            .MaximumLength(Permission.ModuleMaxLength)
            .When(x => x.Module is not null);

        RuleFor(x => x.SortOrder)
            .GreaterThanOrEqualTo(0);
    }
}
