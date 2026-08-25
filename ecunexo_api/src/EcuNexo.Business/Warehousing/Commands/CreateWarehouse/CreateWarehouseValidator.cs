using EcuNexo.Core.Warehousing;
using FluentValidation;

namespace EcuNexo.Business.Warehousing.Commands.CreateWarehouse;

public sealed class CreateWarehouseValidator : AbstractValidator<CreateWarehouseCommand>
{
    public CreateWarehouseValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(Warehouse.NameMaxLength);
        RuleFor(x => x.Code).MaximumLength(Warehouse.CodeMaxLength).When(x => x.Code is not null);
    }
}
