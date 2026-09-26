using EcuNexo.Business.Pricing.Commands.CreatePriceList;
using EcuNexo.Business.Pricing.Commands.UpdatePriceList;

namespace EcuNexo.Api.Contracts.V1.Pricing;

public sealed record CreatePriceListRequest(
    string Code,
    string Name,
    string? Description,
    string? Currency,
    bool PricesIncludeTax,
    DateOnly ValidFrom,
    DateOnly? ValidTo,
    int Priority,
    bool IsDefault)
{
    public CreatePriceListCommand ToCommand(Guid tenantId) =>
        new(tenantId, Code, Name, Description, Currency, PricesIncludeTax, ValidFrom, ValidTo, Priority, IsDefault);
}

public sealed record UpdatePriceListRequest(
    string Name,
    string? Description,
    string? Currency,
    bool PricesIncludeTax,
    DateOnly ValidFrom,
    DateOnly? ValidTo,
    int Priority,
    bool IsDefault)
{
    public UpdatePriceListCommand ToCommand(Guid tenantId, Guid priceListId) =>
        new(tenantId, priceListId, Name, Description, Currency, PricesIncludeTax, ValidFrom, ValidTo, Priority, IsDefault);
}
