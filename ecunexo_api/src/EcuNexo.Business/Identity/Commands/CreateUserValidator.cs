using EcuNexo.Core.Identity;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class CreateUserValidator : AbstractValidator<CreateUserCommand>
{
    public CreateUserValidator()
    {
        RuleFor(x => x.TenantId)
            .NotEmpty();

        RuleFor(x => x.Email)
            .NotEmpty()
            .MaximumLength(Email.MaxLength)
            .EmailAddress();

        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(User.NameMaxLength);

        RuleFor(x => x.Password)
            .NotEmpty()
            .MinimumLength(8)
            .WithMessage("La contraseña debe tener al menos 8 caracteres.");

        RuleFor(x => x.Department)
            .MaximumLength(User.DepartmentMaxLength)
            .When(x => x.Department is not null);

        RuleFor(x => x.Phone!)
            .MaximumLength(User.PhoneMaxLength)
            .When(x => x.Phone is not null);

        RuleFor(x => x.JobTitle!)
            .MaximumLength(User.JobTitleMaxLength)
            .When(x => x.JobTitle is not null);
    }
}
