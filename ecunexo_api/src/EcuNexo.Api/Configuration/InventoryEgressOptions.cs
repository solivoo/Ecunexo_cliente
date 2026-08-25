namespace EcuNexo.Api.Configuration;

public sealed class InventoryEgressOptions
{
    public const string SectionName = "InventoryEgress";

    /// <summary>Clave compartida Billing → tenant (header X-EcuNexo-Inventory-Key).</summary>
    public string? ApiKey { get; set; }
}
