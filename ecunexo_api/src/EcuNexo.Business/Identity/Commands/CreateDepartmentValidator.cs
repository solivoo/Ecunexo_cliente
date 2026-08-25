using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class CreateDepartmentValidator : AbstractValidator<CreateDepartmentCommand>
{
    public CreateDepartmentValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(Core.Identity.Department.NameMaxLength);
        RuleFor(x => x.Description)
            .MaximumLength(Core.Identity.Department.DescriptionMaxLength)
            .When(x => x.Description is not null);
    }
}
