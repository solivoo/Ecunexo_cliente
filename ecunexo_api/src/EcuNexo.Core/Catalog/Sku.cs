using System.Text.RegularExpressions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Catalog;

/// <summary>Código de artículo. Obligatorio solo para ítems físicos (ADR-010: 1 ítem = 1 SKU).</summary>
public sealed class Sku : IEquatable<Sku>
{
    public const int MinLength = 3;
    public const int MaxLength = 32;

    private static readonly Regex Pattern = new(
        @"^[A-Z0-9-]{3,32}$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public string Value { get; }

    private Sku(string value) => Value = value;

    public static Result<Sku> Create(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return Result.Failure<Sku>(
                new Error("sku.required", "El SKU es obligatorio.", ErrorType.Validation));
        }

        var normalized = raw.Trim().ToUpperInvariant();
        if (normalized.Length < MinLength || normalized.Length > MaxLength)
        {
            return Result.Failure<Sku>(
                new Error(
                    "sku.length",
                    $"El SKU debe tener entre {MinLength} y {MaxLength} caracteres.",
                    ErrorType.Validation));
        }

        if (!Pattern.IsMatch(normalized))
        {
            return Result.Failure<Sku>(
                new Error(
                    "sku.format",
                    "El SKU solo admite letras mayúsculas, dígitos y guiones.",
                    ErrorType.Validation));
        }

        return Result.Success(new Sku(normalized));
    }

    public bool Equals(Sku? other) =>
        other is not null && string.Equals(Value, other.Value, StringComparison.Ordinal);

    public override bool Equals(object? obj) => obj is Sku other && Equals(other);

    public override int GetHashCode() => Value.GetHashCode(StringComparison.Ordinal);

    public override string ToString() => Value;
}
