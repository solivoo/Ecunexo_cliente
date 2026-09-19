namespace EcuNexo.Core.CreditNotes;

/// <summary>
/// Campo de información adicional para la Nota de Crédito (Tag XML infoAdicional).
/// </summary>
public sealed record CreditNoteAdditionalField
{
    public string Name { get; init; }
    public string Value { get; init; }

    public CreditNoteAdditionalField()
    {
        Name = string.Empty;
        Value = string.Empty;
    }

    public CreditNoteAdditionalField(string name, string value)
    {
        Name = (name ?? string.Empty).Trim();
        Value = (value ?? string.Empty).Trim();
    }
}
