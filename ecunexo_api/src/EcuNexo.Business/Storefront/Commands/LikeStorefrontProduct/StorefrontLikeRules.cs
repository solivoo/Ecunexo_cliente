using EcuNexo.Core.Common;

namespace EcuNexo.Business.Storefront.Commands.LikeStorefrontProduct;

/// <summary>Reglas compartidas por el alta y la baja del "me gusta" de vitrina.</summary>
internal static class StorefrontLikeRules
{
    private const int VisitorIdMinLength = 8;
    private const int VisitorIdMaxLength = 64;

    public static Result<string> NormalizeVisitorId(string? visitorId)
    {
        var normalized = visitorId?.Trim() ?? string.Empty;
        if (normalized.Length < VisitorIdMinLength || normalized.Length > VisitorIdMaxLength)
        {
            return Result.Failure<string>(
                new Error(
                    "ecommerce.like.visitor_invalid",
                    $"El visitante debe tener entre {VisitorIdMinLength} y {VisitorIdMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        return Result.Success(normalized);
    }
}
