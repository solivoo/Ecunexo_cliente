using EcuNexo.Core.Common;

namespace EcuNexo.Business.Tenancy.BrandLogos;

public static class BrandLogoContent
{
    public static bool IsAllowedContentType(string contentType) =>
        contentType is "image/png" or "image/jpeg" or "image/jpg" or "image/webp" or "image/svg+xml";

    public static string InferContentType(string fileName)
    {
        var ext = Path.GetExtension(fileName).TrimStart('.').ToLowerInvariant();
        return ext switch
        {
            "png" => "image/png",
            "jpg" or "jpeg" => "image/jpeg",
            "webp" => "image/webp",
            "svg" => "image/svg+xml",
            _ => string.Empty,
        };
    }

    public static string NormalizeContentType(string contentType)
    {
        var type = contentType.Trim().ToLowerInvariant();
        return type == "image/jpg" ? "image/jpeg" : type;
    }

    public static string ResolveContentType(string contentType, string fileName)
    {
        var normalized = NormalizeContentType(contentType);
        return string.IsNullOrWhiteSpace(normalized) ? InferContentType(fileName) : normalized;
    }

    public static string ExtensionFromContentType(string contentType, string fileName)
    {
        var fromName = Path.GetExtension(fileName).TrimStart('.').ToLowerInvariant();
        return contentType switch
        {
            "image/png" => "png",
            "image/jpeg" => fromName is "jpg" or "jpeg" ? fromName : "jpg",
            "image/webp" => "webp",
            "image/svg+xml" => "svg",
            _ => string.IsNullOrWhiteSpace(fromName) ? "bin" : fromName,
        };
    }

    public static Result ValidatePayload(string contentType, byte[] bytes)
    {
        if (contentType != "image/svg+xml")
        {
            return Result.Success();
        }

        var text = System.Text.Encoding.UTF8.GetString(bytes);
        if (text.Contains("<script", StringComparison.OrdinalIgnoreCase)
            || text.Contains("javascript:", StringComparison.OrdinalIgnoreCase)
            || text.Contains("onerror=", StringComparison.OrdinalIgnoreCase))
        {
            return Result.Failure(
                new Error(
                    "brand_logo.svg.unsafe",
                    "El SVG no puede incluir scripts ni manejadores de eventos.",
                    ErrorType.Validation));
        }

        return Result.Success();
    }
}
