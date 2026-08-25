using EcuNexo.Core.Warehousing;
using FluentValidation;

namespace EcuNexo.Business.Warehousing.Commands.UpdateWarehouse;

public sealed class UpdateWarehouseValidator : AbstractValidator<UpdateWarehouseCommand>
{
    public UpdateWarehouseValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.WarehouseId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(Warehouse.NameMaxLength);
        RuleFor(x => x.Code).MaximumLength(Warehouse.CodeMaxLength).When(x => x.Code is not null);
        RuleFor(x => x.AddressLine1).MaximumLength(200).When(x => x.AddressLine1 is not null);
        RuleFor(x => x.City).MaximumLength(80).When(x => x.City is not null);
        RuleFor(x => x.Notes).MaximumLength(240).When(x => x.Notes is not null);
    }
}
