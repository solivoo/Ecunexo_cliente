using FluentValidation;

namespace EcuNexo.Business.Inventory.Commands.SetStockMinimum;

public sealed class SetStockMinimumValidator : AbstractValidator<SetStockMinimumCommand>
{
    public SetStockMinimumValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.StockId).NotEmpty();
        RuleFor(x => x.MinimumQuantity)
            .GreaterThanOrEqualTo(0)
            .When(x => x.MinimumQuantity.HasValue);
    }
}
