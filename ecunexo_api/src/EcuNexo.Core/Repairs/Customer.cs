using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Repairs;

/// <summary>
/// Cliente corporativo o fabricante aliado que contrata el servicio de reparación (ej. Whirlpool del Ecuador S.A.).
/// </summary>
public sealed class Customer : AggregateRoot<Guid>, ITenantEntity, IAuditable, ISoftDeletable
{
    public const int NameMaxLength = 200;
    public const int TaxIdMaxLength = 20;

    private Customer()
    {
    }

    public Guid TenantId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    /// <summary>RUC o identificación fiscal de la empresa.</summary>
    public string? TaxId { get; private set; }

    public string? ContactEmail { get; private set; }

    public string? ContactPhone { get; private set; }

    public string? Address { get; private set; }

    public string? ContactPerson { get; private set; }

    public string? Notes { get; private set; }

    public bool IsActive { get; private set; } = true;

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public DateTimeOffset? DeletedAt { get; private set; }

    public Guid? DeletedBy { get; private set; }

    public static Result<Customer> Create(
        Guid id,
        Guid tenantId,
        string name,
        string? taxId = null,
        string? contactEmail = null,
        string? contactPhone = null,
        string? address = null,
        string? contactPerson = null,
        string? notes = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<Customer>(new Error("repairs.customer.id.empty", "El Id del cliente es obligatorio.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<Customer>(new Error("repairs.customer.tenant.empty", "El TenantId es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure<Customer>(new Error("repairs.customer.name.empty", "El nombre de la empresa cliente es obligatorio.", ErrorType.Validation));
        }

        var trimmedName = name.Trim();
        if (trimmedName.Length > NameMaxLength)
        {
            return Result.Failure<Customer>(new Error("repairs.customer.name.toolong", $"El nombre no puede exceder {NameMaxLength} caracteres.", ErrorType.Validation));
        }

        return new Customer
        {
            Id = id,
            TenantId = tenantId,
            Name = trimmedName,
            TaxId = taxId?.Trim(),
            ContactEmail = contactEmail?.Trim(),
            ContactPhone = contactPhone?.Trim(),
            Address = address?.Trim(),
            ContactPerson = contactPerson?.Trim(),
            Notes = notes?.Trim(),
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }

    public Result Update(
        string name,
        string? taxId,
        string? contactEmail,
        string? contactPhone,
        string? address,
        string? contactPerson,
        string? notes)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure(new Error("repairs.customer.name.empty", "El nombre de la empresa cliente es obligatorio.", ErrorType.Validation));
        }

        var trimmedName = name.Trim();
        if (trimmedName.Length > NameMaxLength)
        {
            return Result.Failure(new Error("repairs.customer.name.toolong", $"El nombre no puede exceder {NameMaxLength} caracteres.", ErrorType.Validation));
        }

        Name = trimmedName;
        TaxId = taxId?.Trim();
        ContactEmail = contactEmail?.Trim();
        ContactPhone = contactPhone?.Trim();
        Address = address?.Trim();
        ContactPerson = contactPerson?.Trim();
        Notes = notes?.Trim();
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

    public void SoftDelete(Guid? deletedBy = null)
    {
        DeletedAt = DateTimeOffset.UtcNow;
        DeletedBy = deletedBy;
    }
}
