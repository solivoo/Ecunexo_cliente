using EcuNexo.Core.Identity;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class UpdateUserValidator : AbstractValidator<UpdateUserCommand>
{
    public UpdateUserValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(User.NameMaxLength);
        RuleFor(x => x.Email!)
            .NotEmpty()
            .MaximumLength(Email.MaxLength)
            .When(x => x.Email is not null);
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
