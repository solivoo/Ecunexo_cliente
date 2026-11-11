using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Queries.ListSystemBaseAttributes;

public sealed class ListSystemBaseAttributesHandler
    : IQueryHandler<ListSystemBaseAttributesQuery, ListSystemBaseAttributesResponse>
{
    public Task<Result<ListSystemBaseAttributesResponse>> Handle(
        ListSystemBaseAttributesQuery query,
        CancellationToken ct)
    {
        // Catálogo de dominio (no depende del tenant); TenantId solo mantiene el contrato de rutas autenticadas.
        _ = query.TenantId;

        IReadOnlyList<SystemBaseAttributeResponse> attributes = SystemBaseAttributes.All
            .Select(a => new SystemBaseAttributeResponse(
                a.Id,
                a.Name,
                a.DimensionType,
                a.DataType,
                a.PredefinedValues,
                a.Unit,
                a.IsVariantAxis,
                a.SystemRole,
                a.Description,
                a.Aliases))
            .ToList();

        IReadOnlyList<UnitOfMeasureOptionResponse> units = SystemBaseAttributes.UnitOfMeasureOptions
            .Select(u => new UnitOfMeasureOptionResponse(u.Value, u.Label))
            .ToList();

        return Task.FromResult(
            Result.Success(new ListSystemBaseAttributesResponse(attributes, units)));
    }
}
