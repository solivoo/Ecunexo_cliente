namespace EcuNexo.Core.Identity;

/// <summary>
/// User email — normalized storage (lowercase trim).
/// </summary>
public sealed class Email : IEquatable<Email>
{
    public const int MaxLength = 320;

    /// <summary>EF materialization.</summary>
#pragma warning disable CS8618
    private Email()
#pragma warning restore CS8618
    {
        Value = string.Empty;
    }

    public string Value { get; }

    public Email(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        var trimmed = value.Trim();
        if (trimmed.Length > MaxLength)
        {
            throw new ArgumentException($"El correo no puede superar {MaxLength} caracteres.", nameof(value));
        }

        if (trimmed.AsSpan().IndexOf('@') <= 0 || trimmed.AsSpan().LastIndexOf('@') == trimmed.Length - 1)
        {
            throw new ArgumentException("El correo no tiene un formato válido.", nameof(value));
        }

        Value = trimmed.ToLowerInvariant();
    }

    public bool Equals(Email? other) => other is not null && string.Equals(Value, other.Value, StringComparison.Ordinal);

    public override bool Equals(object? obj) => obj is Email e && Equals(e);

    public override int GetHashCode() => Value.GetHashCode(StringComparison.Ordinal);
}
