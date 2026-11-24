using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Pricing.Commands.BulkUpsertMatrixPrices;

public sealed record MatrixPriceUpsertEntryInput(
    Guid PriceListId,
    Guid CatalogItemId,
    decimal Price);

public sealed record BulkUpsertMatrixPricesCommand(
    Guid TenantId,
    DateOnly ValidFrom,
    DateOnly? ValidTo,
    string? Reason,
    IReadOnlyList<MatrixPriceUpsertEntryInput> Entries) : ICommand<BulkUpsertMatrixPricesResponse>;

public sealed record BulkUpsertMatrixPricesResponse(int UpdatedCount, int CreatedCount);
