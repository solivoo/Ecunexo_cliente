using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Tenancy;

/// <summary>Dominio público (subdominio o personalizado) asociado a la vitrina del tenant.</summary>
public sealed class StorefrontDomain : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    public const int DomainMaxLength = 253;
    public const int LabelMaxLength = 63;
    public const int TokenMaxLength = 64;
    public const int MaxPerTenant = 10;
    public const string VerificationPrefix = "ecunexo-site-verification=";

    private StorefrontDomain()
    {
        Domain = string.Empty;
        VerificationToken = string.Empty;
    }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public string Domain { get; private set; }

    public bool IsPrimary { get; private set; }

    public string VerificationToken { get; private set; }

    public DateTimeOffset? VerifiedAt { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public bool IsVerified => VerifiedAt is not null;

    public string TxtRecordName => $"_ecunexo.{Domain}";

    public string TxtRecordValue => $"{VerificationPrefix}{VerificationToken}";

    public static Result<StorefrontDomain> Create(
        Guid id,
        Guid tenantId,
        string? domain,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty || tenantId == Guid.Empty)
        {
            return Result.Failure<StorefrontDomain>(
                new Error(
                    "storefront.domain.ids.invalid",
                    "El identificador del dominio no es válido.",
                    ErrorType.Validation));
        }

        var normalized = NormalizeDomain(domain);
        if (normalized.IsFailure)
        {
            return Result.Failure<StorefrontDomain>(normalized.Error!);
        }

        return new StorefrontDomain
        {
            Id = id,
            TenantId = tenantId,
            Domain = normalized.Value!,
            VerificationToken = GenerateToken(),
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
        };
    }

    public Result MarkVerified(DateTimeOffset utcNow, Guid? updatedBy = null)
    {
        VerifiedAt = utcNow;
        Touch(updatedBy);
        return Result.Success();
    }

    public Result ResetVerification(Guid? updatedBy = null)
    {
        VerifiedAt = null;
        Touch(updatedBy);
        return Result.Success();
    }

    public Result SetPrimary(bool isPrimary, Guid? updatedBy = null)
    {
        IsPrimary = isPrimary;
        Touch(updatedBy);
        return Result.Success();
    }

    public Result RotateVerificationToken(Guid? updatedBy = null)
    {
        VerificationToken = GenerateToken();
        VerifiedAt = null;
        Touch(updatedBy);
        return Result.Success();
    }

    public static Result<string> NormalizeDomain(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return Result.Failure<string>(
                new Error("storefront.domain.required", "El dominio es obligatorio.", ErrorType.Validation));
        }

        var value = raw.Trim().ToLowerInvariant();
        if (value.Contains("://", StringComparison.Ordinal)
            || value.Contains('/', StringComparison.Ordinal)
            || value.Contains('@', StringComparison.Ordinal)
            || value.Contains(' ', StringComparison.Ordinal))
        {
            return InvalidDomain();
        }

        value = value.TrimEnd('.');
        var colon = value.IndexOf(':');
        if (colon >= 0)
        {
            value = value[..colon];
        }

        if (IPAddress.TryParse(value, out _))
        {
            return InvalidDomain();
        }

        try
        {
            value = new IdnMapping().GetAscii(value).ToLowerInvariant();
        }
        catch (ArgumentException)
        {
            return InvalidDomain();
        }

        if (value.Length is 0 or > DomainMaxLength)
        {
            return InvalidDomain();
        }

        var labels = value.Split('.');
        if (labels.Length < 2)
        {
            return InvalidDomain();
        }

        foreach (var label in labels)
        {
            if (label.Length is 0 or > LabelMaxLength
                || label[0] == '-'
                || label[^1] == '-'
                || !label.All(static c => char.IsAsciiLetterOrDigit(c) || c == '-'))
            {
                return InvalidDomain();
            }
        }

        return Result.Success(value);
    }

    private static Result<string> InvalidDomain() =>
        Result.Failure<string>(
            new Error(
                "storefront.domain.invalid",
                "El dominio no es válido. Usa un nombre como tienda.empresa.com.",
                ErrorType.Validation));

    private static string GenerateToken() =>
        Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();

    private void Touch(Guid? updatedBy)
    {
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
    }
}
