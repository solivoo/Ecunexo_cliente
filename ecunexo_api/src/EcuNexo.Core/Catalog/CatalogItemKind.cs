namespace EcuNexo.Core.Catalog;

/// <summary>Tipo de ítem maestro. El físico es el único que podrá tener stock (ADR-009).</summary>
public enum CatalogItemKind
{
    Physical = 0,
    Service = 1,
}
