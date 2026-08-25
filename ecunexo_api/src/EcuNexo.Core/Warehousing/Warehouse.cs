using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.Warehousing;

/// <summary>Ubicación de stock (ADR-009). La de tránsito es de sistema y no se usa en recepción/egreso (ADR-010).</summary>
public sealed class Warehouse : AggregateRoot<Guid>, ITenantEntity, IAuditable, ISoftDeletable
{
    public const int NameMaxLength = 120;
    public const int CodeMaxLength = 32;
    public const string MainDefaultName = "Principal";
    public const string MainDefaultCode = "PRINCIPAL";
    public const string TransitDefaultName = "En tránsito";
    public const string TransitDefaultCode = "TRANSITO";

    private Warehouse()
    {
        Name = string.Empty;
        AddressJson = "{}";
    }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public string Name { get; private set; }

    public string? Code { get; private set; }

    public string AddressJson { get; private set; }

    public bool IsMain { get; private set; }

    public bool IsSystem { get; private set; }

    public WarehouseSystemRole SystemRole { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public DateTimeOffset? DeletedAt { get; private set; }

    public Guid? DeletedBy { get; private set; }

    public bool IsTransit => IsSystem && SystemRole == WarehouseSystemRole.Transit;

    public static Result<Warehouse> Create(
        Guid id,
        Guid tenantId,
        string name,
        string? code = null,
        string? addressJson = null,
        bool isMain = false)
    {
        if (tenantId == Guid.Empty)
        {
            return Result.Failure<Warehouse>(
                new Error("warehousing.warehouse.tenant_id.invalid", "El tenant es obligatorio.", ErrorType.Validation));
        }

        var nameResult = NormalizeName(name);
        if (nameResult.IsFailure)
        {
            return Result.Failure<Warehouse>(nameResult.Error!);
        }

        var codeResult = NormalizeCode(code);
        if (codeResult.IsFailure)
        {
            return Result.Failure<Warehouse>(codeResult.Error!);
        }

        var address = NormalizeAddress(addressJson);
        if (address.IsFailure)
        {
            return Result.Failure<Warehouse>(address.Error!);
        }

        return new Warehouse
        {
            Id = id,
            TenantId = tenantId,
            Name = nameResult.Value!,
            Code = codeResult.Value,
            AddressJson = address.Value!,
            IsMain = isMain,
            IsSystem = false,
            SystemRole = WarehouseSystemRole.None,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }

    public static Result<Warehouse> CreateSystem(
        Guid id,
        Guid tenantId,
        string name,
        WarehouseSystemRole role,
        string? code,
        bool isMain)
    {
        if (role == WarehouseSystemRole.None)
        {
            return Result.Failure<Warehouse>(
                new Error(
                    "warehousing.warehouse.system.role",
                    "Una bodega de sistema requiere un rol (p. ej. tránsito).",
                    ErrorType.Validation));
        }

        var created = Create(id, tenantId, name, code, null, isMain);
        if (created.IsFailure)
        {
            return created;
        }

        var warehouse = created.Value!;
        warehouse.IsSystem = true;
        warehouse.SystemRole = role;
        return Result.Success(warehouse);
    }

    public Result Rename(string name, string? code, Guid? updatedBy)
    {
        if (IsSystem)
        {
            return Result.Failure(
                new Error(
                    "warehousing.warehouse.system.locked",
                    "Las bodegas de sistema no se renombran.",
                    ErrorType.Forbidden));
        }

        var nameResult = NormalizeName(name);
        if (nameResult.IsFailure)
        {
            return Result.Failure(nameResult.Error!);
        }

        var codeResult = NormalizeCode(code);
        if (codeResult.IsFailure)
        {
            return Result.Failure(codeResult.Error!);
        }

        Name = nameResult.Value!;
        Code = codeResult.Value;
        Touch(updatedBy);
        return Result.Success();
    }

    /// <summary>Corrige ficha operativa (nombre, código, dirección jsonb). No toca stock ni rol de sistema.</summary>
    public Result UpdateDetails(string name, string? code, string? addressJson, Guid? updatedBy)
    {
        var renamed = Rename(name, code, updatedBy);
        if (renamed.IsFailure)
        {
            return renamed;
        }

        var address = NormalizeAddress(addressJson);
        if (address.IsFailure)
        {
            return Result.Failure(address.Error!);
        }

        AddressJson = address.Value!;
        Touch(updatedBy);
        return Result.Success();
    }

    public Result EnsureOperational()
    {
        if (IsTransit)
        {
            return Result.Failure(
                new Error(
                    "warehousing.warehouse.transit.locked",
                    "La bodega en tránsito no admite recepción ni egreso directo.",
                    ErrorType.Validation));
        }

        return Result.Success();
    }

    /// <summary>Marca una bodega operativa ya existente como principal (p. ej. el usuario la creó sin IsMain).</summary>
    public Result DesignateAsMain()
    {
        if (DeletedAt is not null)
        {
            return Result.Failure(
                new Error(
                    "warehousing.warehouse.deleted",
                    "No se puede promover una bodega dada de baja.",
                    ErrorType.Conflict));
        }

        if (IsTransit)
        {
            return Result.Failure(
                new Error(
                    "warehousing.warehouse.transit.not_main",
                    "La bodega en tránsito no puede ser la principal.",
                    ErrorType.Validation));
        }

        IsMain = true;
        if (string.IsNullOrWhiteSpace(Code))
        {
            Code = MainDefaultCode;
        }

        Touch(null);
        return Result.Success();
    }

    /// <summary>Adopta una fila ya creada (mismo código o nombre) como bodega de sistema en tránsito.</summary>
    public Result DesignateAsSystemTransit()
    {
        if (DeletedAt is not null)
        {
            return Result.Failure(
                new Error(
                    "warehousing.warehouse.deleted",
                    "No se puede promover una bodega dada de baja.",
                    ErrorType.Conflict));
        }

        if (IsMain)
        {
            return Result.Failure(
                new Error(
                    "warehousing.warehouse.main.not_transit",
                    "La bodega principal no se convierte en tránsito.",
                    ErrorType.Validation));
        }

        IsSystem = true;
        SystemRole = WarehouseSystemRole.Transit;
        if (string.IsNullOrWhiteSpace(Code))
        {
            Code = TransitDefaultCode;
        }

        Touch(null);
        return Result.Success();
    }

    private void Touch(Guid? updatedBy)
    {
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
    }

    private static Result<string> NormalizeName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure<string>(
                new Error("warehousing.warehouse.name.required", "El nombre de la bodega es obligatorio.", ErrorType.Validation));
        }

        var trimmed = name.Trim();
        if (trimmed.Length > NameMaxLength)
        {
            return Result.Failure<string>(
                new Error(
                    "warehousing.warehouse.name.length",
                    $"El nombre no puede superar {NameMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        return Result.Success(trimmed);
    }

    private static Result<string?> NormalizeCode(string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return Result.Success<string?>(null);
        }

        var trimmed = code.Trim().ToUpperInvariant();
        if (trimmed.Length > CodeMaxLength)
        {
            return Result.Failure<string?>(
                new Error(
                    "warehousing.warehouse.code.length",
                    $"El código no puede superar {CodeMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        return Result.Success<string?>(trimmed);
    }

    private static Result<string> NormalizeAddress(string? addressJson)
    {
        var json = string.IsNullOrWhiteSpace(addressJson) ? "{}" : addressJson.Trim();
        if (json.Length == 0)
        {
            json = "{}";
        }

        return Result.Success(json);
    }
}
