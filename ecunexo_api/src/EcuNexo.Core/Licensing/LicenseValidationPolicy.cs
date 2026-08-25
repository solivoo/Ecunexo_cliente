namespace EcuNexo.Core.Licensing;

public static class LicenseValidationPolicy
{
    public const int DefaultIntervalDays = 30;
    public const int MinIntervalDays = 1;
    public const int MaxIntervalDays = 90;

    public static int NormalizeIntervalDays(int? value) =>
        value is null or <= 0
            ? DefaultIntervalDays
            : Math.Clamp(value.Value, MinIntervalDays, MaxIntervalDays);
}
