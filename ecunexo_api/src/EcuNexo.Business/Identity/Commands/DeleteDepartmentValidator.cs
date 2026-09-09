using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class DeleteDepartmentValidator : AbstractValidator<DeleteDepartmentCommand>
{
    public DeleteDepartmentValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.DepartmentId).NotEmpty();
    }
}
