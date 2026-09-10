using System.Text.Json;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Customers;

namespace EcuNexo.Core.Repairs;

/// <summary>
/// Plantilla dinámica que define qué columnas componen el archivo Excel para un lote de equipos.
/// Permite generar el archivo .xlsx y parsear columnas adicionales en JSONB.
/// </summary>
public sealed class RepairBatchTemplate : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    public const int NameMaxLength = 150;

    private RepairBatchTemplate()
    {
    }

    public Guid TenantId { get; private set; }

    /// <summary>Cliente corporativo específico para el cual aplica la plantilla (null = plantilla general del taller).</summary>
    public Guid? CustomerId { get; private set; }

    public Customer? Customer { get; private set; }

    public string Name { get; private set; } = string.Empty;

    /// <summary>Definición del esquema de columnas en formato JSONB.</summary>
    public string ColumnDefinitionsJson { get; private set; } = "{\"columns\":[]}";

    public bool IsActive { get; private set; } = true;

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<RepairBatchTemplate> Create(
        Guid id,
        Guid tenantId,
        string name,
        string columnDefinitionsJson,
        Guid? customerId = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<RepairBatchTemplate>(new Error("repairs.template.id.empty", "El Id de la plantilla es obligatorio.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<RepairBatchTemplate>(new Error("repairs.template.tenant.empty", "El TenantId es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure<RepairBatchTemplate>(new Error("repairs.template.name.empty", "El nombre de la plantilla es obligatorio.", ErrorType.Validation));
        }

        var trimmedName = name.Trim();
        if (trimmedName.Length > NameMaxLength)
        {
            return Result.Failure<RepairBatchTemplate>(new Error("repairs.template.name.toolong", $"El nombre no puede exceder {NameMaxLength} caracteres.", ErrorType.Validation));
        }

        var normalizedJson = NormalizeSchemaJson(columnDefinitionsJson);
        if (normalizedJson.IsFailure)
        {
            return Result.Failure<RepairBatchTemplate>(normalizedJson.Error!);
        }

        return new RepairBatchTemplate
        {
            Id = id,
            TenantId = tenantId,
            CustomerId = customerId,
            Name = trimmedName,
            ColumnDefinitionsJson = normalizedJson.Value!,
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }

    public Result Update(string name, string columnDefinitionsJson, Guid? customerId = null)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure(new Error("repairs.template.name.empty", "El nombre de la plantilla es obligatorio.", ErrorType.Validation));
        }

        var trimmedName = name.Trim();
        if (trimmedName.Length > NameMaxLength)
        {
            return Result.Failure(new Error("repairs.template.name.toolong", $"El nombre no puede exceder {NameMaxLength} caracteres.", ErrorType.Validation));
        }

        var normalizedJson = NormalizeSchemaJson(columnDefinitionsJson);
        if (normalizedJson.IsFailure)
        {
            return Result.Failure(normalizedJson.Error!);
        }

        Name = trimmedName;
        ColumnDefinitionsJson = normalizedJson.Value!;
        CustomerId = customerId;
        UpdatedAt = DateTimeOffset.UtcNow;

        return Result.Success();
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void Activate()
    {
        IsActive = true;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    private static Result<string> NormalizeSchemaJson(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return "{\"columns\":[]}";
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.ValueKind == JsonValueKind.Object
                ? json.Trim()
                : "{\"columns\":[]}";
        }
        catch (JsonException ex)
        {
            return Result.Failure<string>(new Error("repairs.template.json.invalid", $"El formato JSON del esquema no es válido: {ex.Message}", ErrorType.Validation));
        }
    }
}
