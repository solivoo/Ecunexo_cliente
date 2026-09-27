using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Commands.AdoptVariantDimensionTemplate;

/// <summary>
/// Reasigna a este atributo todos los productos que hoy usan otro atributo de origen:
/// renombra la clave en la ficha, dimensiones de matriz y ruta jerárquica de cada ítem.
/// </summary>
public sealed record AdoptVariantDimensionTemplateCommand(
    Guid TemplateId,
    Guid TenantId,
    string SourceAttributeName,
    Guid? UpdatedBy = null) : ICommand<AdoptVariantDimensionTemplateResponse>;

public sealed record AdoptVariantDimensionTemplateResponse(
    Guid Id,
    Guid TenantId,
    string SourceAttributeName,
    int ReassignedItems = 0);
