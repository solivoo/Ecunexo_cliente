using FluentValidation;

namespace EcuNexo.Business.Identity.Commands.Login;

public sealed class LoginValidator : AbstractValidator<LoginCommand>
{
    public LoginValidator()
    {
        RuleFor(c => c.Email).NotEmpty().MaximumLength(320);
        RuleFor(c => c.Password).NotEmpty().MaximumLength(200);
    }
}
