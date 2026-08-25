using EcuNexo.Core.Identity;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class CreatePolicyValidator : AbstractValidator<CreatePolicyCommand>
{
    public CreatePolicyValidator()
    {
        RuleFor(x => x.PermissionId)
            .NotEmpty();

        RuleFor(x => x.Condition!)
            .MaximumLength(Policy.ConditionMaxLength)
            .When(x => x.Condition is not null);
    }
}
