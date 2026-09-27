using System.Globalization;
using System.Text.Json;
using EcuNexo.Business.Platform.Settings;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Ecommerce;
using EcuNexo.Core.Platform;

namespace EcuNexo.Business.Ecommerce.Storefront;

/// <summary>
/// Resuelve la configuración de la tienda combinando global/plan/tenant y sanitizando valores inválidos.
/// </summary>
public sealed class EcommerceStorefrontSettingsReader : IEcommerceStorefrontSettingsReader
{
    public const int DefaultPaymentHoldHours = 2;
    public const int MinPaymentHoldHours = 1;
    public const int MaxPaymentHoldHours = 720;
    public const bool DefaultReserveOnOrder = true;
    public const int DefaultMaxPendingOrders = 3;
    public const int MinMaxPendingOrders = 1;
    public const int MaxMaxPendingOrders = 50;

    private static readonly IReadOnlyList<EcommercePaymentMethod> DefaultPaymentMethods =
        [EcommercePaymentMethod.BankTransfer];

    private static readonly IReadOnlyList<ShippingMethodOption> DefaultShippingMethods =
        [new ShippingMethodOption(EcommerceShippingMethod.Courier, 0m)];

    private readonly ISettingsResolver _settings;
    private readonly ITenantRepository _tenants;

    public EcommerceStorefrontSettingsReader(
        ISettingsResolver settings,
        ITenantRepository tenants)
    {
        _settings = settings;
        _tenants = tenants;
    }

    public async Task<EcommerceStorefrontSettings> ResolveAsync(Guid tenantId, CancellationToken ct)
    {
        var planName = string.Empty;
        if (tenantId != Guid.Empty)
        {
            var tenant = await _tenants.GetByIdAsync(tenantId, ct).ConfigureAwait(false);
            planName = tenant?.ServicePlan?.Name ?? string.Empty;
        }

        var values = await _settings
            .ResolveAsync(tenantId, Guid.Empty, planName, ct)
            .ConfigureAwait(false);

        return new EcommerceStorefrontSettings(
            ReadPaymentMethods(values),
            ReadShippingMethods(values),
            ReadBankTransferInstructions(values),
            ReadPaymentHoldHours(values),
            ReadReserveOnOrder(values),
            ReadContactWhatsapp(values),
            ReadOrdersNotificationEmail(values),
            ReadMaxPendingOrders(values));
    }

    internal static bool TryParsePaymentMethod(string? raw, out EcommercePaymentMethod method)
    {
        method = default;
        return !string.IsNullOrWhiteSpace(raw)
            && Enum.TryParse(raw.Trim(), ignoreCase: true, out method)
            && Enum.IsDefined(method);
    }

    internal static bool TryParseShippingMethod(string? raw, out EcommerceShippingMethod method)
    {
        method = default;
        return !string.IsNullOrWhiteSpace(raw)
            && Enum.TryParse(raw.Trim(), ignoreCase: true, out method)
            && Enum.IsDefined(method);
    }

    private static IReadOnlyList<EcommercePaymentMethod> ReadPaymentMethods(
        IReadOnlyDictionary<string, JsonElement> values)
    {
        if (!values.TryGetValue(EcommerceSettingCodes.StorefrontPaymentMethods, out var element)
            || element.ValueKind != JsonValueKind.Array)
        {
            return DefaultPaymentMethods;
        }

        var methods = new List<EcommercePaymentMethod>();
        foreach (var item in element.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.String
                || !TryParsePaymentMethod(item.GetString(), out var method)
                || methods.Contains(method))
            {
                continue;
            }

            methods.Add(method);
        }

        return methods.Count == 0 ? DefaultPaymentMethods : methods;
    }

    private static IReadOnlyList<ShippingMethodOption> ReadShippingMethods(
        IReadOnlyDictionary<string, JsonElement> values)
    {
        if (!values.TryGetValue(EcommerceSettingCodes.StorefrontShippingMethods, out var element)
            || element.ValueKind != JsonValueKind.Array)
        {
            return DefaultShippingMethods;
        }

        var options = new List<ShippingMethodOption>();
        foreach (var item in element.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object
                || !TryGetPropertyIgnoreCase(item, "code", out var codeElement)
                || codeElement.ValueKind != JsonValueKind.String
                || !TryParseShippingMethod(codeElement.GetString(), out var method)
                || options.Exists(option => option.Method == method))
            {
                continue;
            }

            options.Add(new ShippingMethodOption(method, Math.Max(0m, ReadCost(item))));
        }

        return options.Count == 0 ? DefaultShippingMethods : options;
    }

    private static string ReadBankTransferInstructions(IReadOnlyDictionary<string, JsonElement> values)
    {
        if (!values.TryGetValue(EcommerceSettingCodes.StorefrontBankTransferInstructions, out var element)
            || element.ValueKind != JsonValueKind.String)
        {
            return string.Empty;
        }

        return element.GetString()?.Trim() ?? string.Empty;
    }

    private static int ReadPaymentHoldHours(IReadOnlyDictionary<string, JsonElement> values)
    {
        if (!values.TryGetValue(EcommerceSettingCodes.StorefrontPaymentHoldHours, out var element))
        {
            return DefaultPaymentHoldHours;
        }

        var holdHours = element.ValueKind switch
        {
            JsonValueKind.Number when element.TryGetInt32(out var parsed) => parsed,
            JsonValueKind.Number when element.TryGetDouble(out var parsed) =>
                (int)Math.Round(parsed, MidpointRounding.AwayFromZero),
            JsonValueKind.String when int.TryParse(
                element.GetString(),
                NumberStyles.Integer,
                CultureInfo.InvariantCulture,
                out var parsed) => parsed,
            _ => DefaultPaymentHoldHours,
        };

        return Math.Clamp(holdHours, MinPaymentHoldHours, MaxPaymentHoldHours);
    }

    private static bool ReadReserveOnOrder(IReadOnlyDictionary<string, JsonElement> values)
    {
        if (!values.TryGetValue(EcommerceSettingCodes.StorefrontReserveOnOrder, out var element))
        {
            return DefaultReserveOnOrder;
        }

        return element.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String when bool.TryParse(element.GetString(), out var parsed) => parsed,
            _ => DefaultReserveOnOrder,
        };
    }

    private static string ReadContactWhatsapp(IReadOnlyDictionary<string, JsonElement> values)
    {
        if (!values.TryGetValue(EcommerceSettingCodes.StorefrontContactWhatsapp, out var element)
            || element.ValueKind != JsonValueKind.String)
        {
            return string.Empty;
        }

        return EcommerceContactNormalizer.NormalizeWhatsapp(element.GetString());
    }

    private static string ReadOrdersNotificationEmail(IReadOnlyDictionary<string, JsonElement> values)
    {
        if (!values.TryGetValue(EcommerceSettingCodes.StorefrontOrdersNotificationEmail, out var element)
            || element.ValueKind != JsonValueKind.String)
        {
            return string.Empty;
        }

        return EcommerceContactNormalizer.NormalizeEmail(element.GetString());
    }

    private static int ReadMaxPendingOrders(IReadOnlyDictionary<string, JsonElement> values)
    {
        if (!values.TryGetValue(EcommerceSettingCodes.StorefrontMaxPendingOrders, out var element))
        {
            return DefaultMaxPendingOrders;
        }

        var maxPendingOrders = element.ValueKind switch
        {
            JsonValueKind.Number when element.TryGetInt32(out var parsed) => parsed,
            JsonValueKind.Number when element.TryGetDouble(out var parsed) =>
                (int)Math.Round(parsed, MidpointRounding.AwayFromZero),
            JsonValueKind.String when int.TryParse(
                element.GetString(),
                NumberStyles.Integer,
                CultureInfo.InvariantCulture,
                out var parsed) => parsed,
            _ => DefaultMaxPendingOrders,
        };

        return Math.Clamp(maxPendingOrders, MinMaxPendingOrders, MaxMaxPendingOrders);
    }

    private static decimal ReadCost(JsonElement element)
    {
        if (!TryGetPropertyIgnoreCase(element, "cost", out var costElement))
        {
            return 0m;
        }

        return costElement.ValueKind switch
        {
            JsonValueKind.Number when costElement.TryGetDecimal(out var parsed) => parsed,
            JsonValueKind.String when decimal.TryParse(
                costElement.GetString(),
                NumberStyles.Number,
                CultureInfo.InvariantCulture,
                out var parsed) => parsed,
            _ => 0m,
        };
    }

    private static bool TryGetPropertyIgnoreCase(JsonElement element, string name, out JsonElement value)
    {
        foreach (var property in element.EnumerateObject())
        {
            if (string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase))
            {
                value = property.Value;
                return true;
            }
        }

        value = default;
        return false;
    }
}
