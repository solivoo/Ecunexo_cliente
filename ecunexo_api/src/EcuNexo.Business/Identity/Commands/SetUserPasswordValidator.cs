using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class SetUserPasswordValidator : AbstractValidator<SetUserPasswordCommand>
{
    public SetUserPasswordValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Password)
            .NotEmpty()
            .MinimumLength(8)
            .WithMessage("La contraseña debe tener al menos 8 caracteres.");
    }
}
