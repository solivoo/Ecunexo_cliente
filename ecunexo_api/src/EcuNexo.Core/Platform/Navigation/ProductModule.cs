namespace EcuNexo.Core.Platform.Navigation;

public sealed class ProductModule
{
    public const int CodeMaxLength = 64;
    public const int DisplayNameMaxLength = 120;

    public string Code { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
}
