using EcuNexo.Core.Common;

namespace EcuNexo.Core.Logistics;

/// <summary>
/// Provincia oficial del Ecuador (DPA INEC, códigos 01-24). Catálogo nacional compartido.
/// </summary>
public sealed class EcuadorProvince : AggregateRoot<Guid>
{
    public const int CodeMaxLength = 4;
    public const int NameMaxLength = 80;
    public const int RegionMaxLength = 40;

    private readonly List<EcuadorCanton> _cantons = [];

    private EcuadorProvince()
    {
        Code = string.Empty;
        Name = string.Empty;
        Region = string.Empty;
    }

    public string Code { get; private set; }

    public string Name { get; private set; }

    public string Region { get; private set; }

    public int SortOrder { get; private set; }

    public bool IsActive { get; private set; } = true;

    public IReadOnlyCollection<EcuadorCanton> Cantons => _cantons.AsReadOnly();

    public static EcuadorProvince Create(
        Guid id,
        string code,
        string name,
        string region,
        int sortOrder) =>
        new()
        {
            Id = id,
            Code = code.Trim(),
            Name = name.Trim(),
            Region = region.Trim(),
            SortOrder = sortOrder,
            IsActive = true,
        };
}
