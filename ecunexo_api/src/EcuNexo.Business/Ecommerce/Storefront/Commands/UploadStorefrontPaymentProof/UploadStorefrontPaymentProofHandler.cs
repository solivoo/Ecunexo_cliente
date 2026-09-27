using System.Security.Cryptography;
using System.Text;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Business.Storage;
using EcuNexo.Business.Storefront;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Ecommerce.Storefront.Commands.UploadStorefrontPaymentProof;

public sealed class UploadStorefrontPaymentProofHandler
    : ICommandHandler<UploadStorefrontPaymentProofCommand, StorefrontPaymentProofUploadedDto>
{
    public const long MaxFileSizeBytes = 5 * 1024 * 1024;

    private static readonly Dictionary<string, string> ExtensionByContentType =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = ".jpg",
            ["image/png"] = ".png",
            ["image/webp"] = ".webp",
            ["application/pdf"] = ".pdf",
        };

    private static readonly Dictionary<string, string> ContentTypeByExtension =
        new(StringComparer.OrdinalIgnoreCase)
        {
            [".jpg"] = "image/jpeg",
            [".jpeg"] = "image/jpeg",
            [".png"] = "image/png",
            [".webp"] = "image/webp",
            [".pdf"] = "application/pdf",
        };

    private static readonly Error TokenInvalid = new(
        "ecommerce.checkout.proof_token_invalid",
        "El enlace para subir el comprobante no es válido.",
        ErrorType.Forbidden);

    private static readonly Error NotAllowed = new(
        "ecommerce.checkout.proof_not_allowed",
        "Este pedido ya no permite subir el comprobante de pago.",
        ErrorType.Conflict);

    private static readonly Error InvalidFile = new(
        "ecommerce.checkout.proof_invalid_file",
        "El comprobante debe ser una imagen JPG, PNG, WEBP o un PDF.",
        ErrorType.Validation);

    private static readonly Error TooLarge = new(
        "ecommerce.checkout.proof_too_large",
        "El comprobante no puede superar los 5 MB.",
        ErrorType.PayloadTooLarge);

    private readonly ITenantRepository _tenants;
    private readonly IEcommerceOrderRepository _orders;
    private readonly IStorageService _storage;
    private readonly EcommerceOrderEmailNotifier _orderEmailNotifier;
    private readonly IUnitOfWork _unitOfWork;

    public UploadStorefrontPaymentProofHandler(
        ITenantRepository tenants,
        IEcommerceOrderRepository orders,
        IStorageService storage,
        EcommerceOrderEmailNotifier orderEmailNotifier,
        IUnitOfWork unitOfWork)
    {
        _tenants = tenants;
        _orders = orders;
        _storage = storage;
        _orderEmailNotifier = orderEmailNotifier;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<StorefrontPaymentProofUploadedDto>> Handle(
        UploadStorefrontPaymentProofCommand command,
        CancellationToken ct)
    {
        var tenantError = await StorefrontTenantGuard
            .ValidateAsync(_tenants, command.TenantId, ct)
            .ConfigureAwait(false);
        if (tenantError is not null)
        {
            return Result.Failure<StorefrontPaymentProofUploadedDto>(tenantError);
        }

        var order = await _orders
            .GetTrackedWithDetailsAsync(command.TenantId, command.OrderId, ct)
            .ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure<StorefrontPaymentProofUploadedDto>(new Error(
                "ecommerce.order.not_found",
                "La orden especificada no existe.",
                ErrorType.NotFound));
        }

        if (!TokenMatches(order.PaymentProofToken, command.Token))
        {
            return Result.Failure<StorefrontPaymentProofUploadedDto>(TokenInvalid);
        }

        if (!order.CanUploadPaymentProof)
        {
            return Result.Failure<StorefrontPaymentProofUploadedDto>(NotAllowed);
        }

        var contentType = (command.ContentType ?? string.Empty).Trim();
        var extension = Path.GetExtension(command.FileName ?? string.Empty).ToLowerInvariant();

        if (!ExtensionByContentType.ContainsKey(contentType)
            || !ContentTypeByExtension.TryGetValue(extension, out var expectedContentType)
            || !string.Equals(expectedContentType, contentType, StringComparison.OrdinalIgnoreCase))
        {
            return Result.Failure<StorefrontPaymentProofUploadedDto>(InvalidFile);
        }

        if (command.Length <= 0)
        {
            return Result.Failure<StorefrontPaymentProofUploadedDto>(InvalidFile);
        }

        if (command.Length > MaxFileSizeBytes)
        {
            return Result.Failure<StorefrontPaymentProofUploadedDto>(TooLarge);
        }

        var uploadedAtUtc = DateTimeOffset.UtcNow;
        var objectKey =
            $"tenants/{command.TenantId}/ecommerce/orders/{command.OrderId}/comprobante-{uploadedAtUtc:yyyyMMddHHmmss}{extension}";

        await _storage
            .UploadPrivateAsync(objectKey, command.Content, contentType, ct)
            .ConfigureAwait(false);

        var registered = order.RegisterPaymentProof(objectKey, contentType, uploadedAtUtc);
        if (registered.IsFailure)
        {
            return Result.Failure<StorefrontPaymentProofUploadedDto>(registered.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        await _orderEmailNotifier
            .NotifyPaymentProofUploadedAsync(order, ct)
            .ConfigureAwait(false);

        return Result.Success(new StorefrontPaymentProofUploadedDto(
            uploadedAtUtc,
            Path.GetFileName(command.FileName ?? string.Empty),
            contentType));
    }

    private static bool TokenMatches(string expected, string? provided)
    {
        if (string.IsNullOrWhiteSpace(expected) || string.IsNullOrWhiteSpace(provided))
        {
            return false;
        }

        var expectedHash = SHA256.HashData(Encoding.UTF8.GetBytes(expected));
        var providedHash = SHA256.HashData(Encoding.UTF8.GetBytes(provided.Trim()));
        return CryptographicOperations.FixedTimeEquals(expectedHash, providedHash);
    }
}
