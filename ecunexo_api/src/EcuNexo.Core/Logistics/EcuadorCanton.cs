using EcuNexo.Core.Common;

namespace EcuNexo.Core.Logistics;

/// <summary>
/// Cantón oficial del Ecuador (DPA INEC), relacionado a su provincia.
/// </summary>
public sealed class EcuadorCanton : AggregateRoot<Guid>
{
    public const int CodeMaxLength = 8;
    public const int NameMaxLength = 100;

    private EcuadorCanton()
    {
        Code = string.Empty;
        Name = string.Empty;
    }

    public Guid ProvinceId { get; private set; }

    public EcuadorProvince? Province { get; private set; }

    public string Code { get; private set; }

    public string Name { get; private set; }

    public bool IsProvincialCapital { get; private set; }

    public int SortOrder { get; private set; }

    public bool IsActive { get; private set; } = true;

    public static EcuadorCanton Create(
        Guid id,
        Guid provinceId,
        string code,
        string name,
        bool isProvincialCapital,
        int sortOrder) =>
        new()
        {
            Id = id,
            ProvinceId = provinceId,
            Code = code.Trim(),
            Name = name.Trim(),
            IsProvincialCapital = isProvincialCapital,
            SortOrder = sortOrder,
            IsActive = true,
        };
}
