using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Commands.CreateEcommerceOrder;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Business.Ecommerce.Storefront.Turnstile;
using EcuNexo.Business.Storefront;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Common;
using EcuNexo.Core.Ecommerce;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace EcuNexo.Business.Ecommerce.Storefront.Commands.CreateStorefrontOrder;

internal static partial class StorefrontOrderLogger
{
    [LoggerMessage(
        EventId = 1001,
        Level = LogLevel.Information,
        Message = "Checkout público tenant {TenantId} requestId {RequestId} email {MaskedEmail} IP {ClientIp} UA {UserAgent}")]
    public static partial void OrderReceived(
        ILogger logger,
        Guid tenantId,
        string requestId,
        string maskedEmail,
        string clientIp,
        string userAgent);

    [LoggerMessage(
        EventId = 1002,
        Level = LogLevel.Warning,
        Message = "No se pudieron enviar los avisos por correo del pedido {OrderId}. El flujo continúa.")]
    public static partial void NotificationFailed(
        ILogger logger,
        Guid orderId,
        Exception ex);
}

public sealed class CreateStorefrontOrderHandler
    : ICommandHandler<CreateStorefrontOrderCommand, StorefrontOrderCreatedDto>
{
    public const string SystemCustomerName = "Tienda online";
    public const string DefaultConsumerTaxId = "9999999999999";
    public const string DefaultConsumerTaxIdType = "07";

    private static readonly Error StockConflict = new(
        "ecommerce.order.stock_conflict",
        "El producto se agotó mientras comprabas.",
        ErrorType.Conflict);

    private static readonly Error WarehouseMissing = new(
        "ecommerce.checkout.warehouse_missing",
        "La tienda no tiene una bodega principal configurada para reservar stock.",
        ErrorType.Conflict);

    private static readonly Error MethodNotAvailable = new(
        "ecommerce.checkout.method_not_available",
        "El método de pago o de envío seleccionado no está disponible.",
        ErrorType.Validation);

    private static readonly Error InvalidForm = new(
        CreateStorefrontOrderValidator.InvalidFormErrorCode,
        "No podemos procesar este pedido.",
        ErrorType.Validation);

    private static readonly Error PrivacyRequired = new(
        CreateStorefrontOrderValidator.PrivacyRequiredErrorCode,
        "Debes aceptar la política de tratamiento de datos personales.",
        ErrorType.Validation);

    private static readonly Error BlockedContact = new(
        "ecommerce.checkout.blocked_contact",
        "No podemos procesar este pedido. Contacta a la tienda.",
        ErrorType.Forbidden);

    private static readonly Error TooManyPending = new(
        "ecommerce.checkout.too_many_pending",
        "Tienes demasiados pedidos pendientes de pago. Completa o cancela los existentes e inténtalo de nuevo.",
        ErrorType.Conflict);

    private static readonly Error CaptchaFailed = new(
        "ecommerce.checkout.captcha_failed",
        "No pudimos verificar que eres humano. Intenta de nuevo.",
        ErrorType.Validation);

    private readonly IValidator<CreateStorefrontOrderCommand> _validator;
    private readonly ITenantRepository _tenants;
    private readonly IWarehouseRepository _warehouses;
    private readonly IEcommerceStorefrontSettingsReader _settings;
    private readonly IEcommerceOrderRepository _orders;
    private readonly IEcommerceBlockedContactRepository _blockedContacts;
    private readonly ITurnstileVerifier _turnstile;
    private readonly EcommerceOrderEmailNotifier _orderEmailNotifier;
    private readonly ISender _sender;
    private readonly ILogger<CreateStorefrontOrderHandler> _logger;

    public CreateStorefrontOrderHandler(
        IValidator<CreateStorefrontOrderCommand> validator,
        ITenantRepository tenants,
        IWarehouseRepository warehouses,
        IEcommerceStorefrontSettingsReader settings,
        IEcommerceOrderRepository orders,
        IEcommerceBlockedContactRepository blockedContacts,
        ITurnstileVerifier turnstile,
        EcommerceOrderEmailNotifier orderEmailNotifier,
        ISender sender,
        ILogger<CreateStorefrontOrderHandler> logger)
    {
        _validator = validator;
        _tenants = tenants;
        _warehouses = warehouses;
        _settings = settings;
        _orders = orders;
        _blockedContacts = blockedContacts;
        _turnstile = turnstile;
        _orderEmailNotifier = orderEmailNotifier;
        _sender = sender;
        _logger = logger;
    }

    public async Task<Result<StorefrontOrderCreatedDto>> Handle(
        CreateStorefrontOrderCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            if (validation.Errors.Any(error => error.ErrorCode == CreateStorefrontOrderValidator.InvalidFormErrorCode))
            {
                return Result.Failure<StorefrontOrderCreatedDto>(InvalidForm);
            }

            if (validation.Errors.Any(error => error.ErrorCode == CreateStorefrontOrderValidator.PrivacyRequiredErrorCode))
            {
                return Result.Failure<StorefrontOrderCreatedDto>(PrivacyRequired);
            }

            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<StorefrontOrderCreatedDto>(
                new Error("ecommerce.checkout.validation", message, ErrorType.Validation));
        }

        if (_turnstile.IsEnabled)
        {
            var verification = await _turnstile
                .VerifyAsync(command.TurnstileToken, command.ClientIp, ct)
                .ConfigureAwait(false);
            if (!verification.Success)
            {
                return Result.Failure<StorefrontOrderCreatedDto>(CaptchaFailed);
            }
        }

        var tenantError = await StorefrontTenantGuard
            .ValidateAsync(_tenants, command.TenantId, ct)
            .ConfigureAwait(false);
        if (tenantError is not null)
        {
            return Result.Failure<StorefrontOrderCreatedDto>(tenantError);
        }

        if (!EcommerceStorefrontSettingsReader.TryParsePaymentMethod(command.PaymentMethod, out var paymentMethod)
            || !EcommerceStorefrontSettingsReader.TryParseShippingMethod(command.ShippingMethod, out var shippingMethod))
        {
            return Result.Failure<StorefrontOrderCreatedDto>(MethodNotAvailable);
        }

        var settings = await _settings.ResolveAsync(command.TenantId, ct).ConfigureAwait(false);
        var requestId = command.RequestId.Trim();

        var existing = await _orders
            .FindByClientRequestIdAsync(command.TenantId, requestId, ct)
            .ConfigureAwait(false);
        if (existing is not null)
        {
            return Result.Success(BuildResponse(existing, settings));
        }

        var emailNormalized = EcommerceContactNormalizer.NormalizeEmail(command.Customer.Email);
        var phoneDigits = EcommerceContactNormalizer.NormalizePhone(command.Customer.Phone);

        if (await IsBlockedAsync(command.TenantId, emailNormalized, phoneDigits, ct).ConfigureAwait(false))
        {
            return Result.Failure<StorefrontOrderCreatedDto>(BlockedContact);
        }

        var pendingCount = await _orders
            .CountPendingByContactAsync(command.TenantId, emailNormalized, phoneDigits, ct)
            .ConfigureAwait(false);
        if (pendingCount >= settings.MaxPendingOrders)
        {
            return Result.Failure<StorefrontOrderCreatedDto>(TooManyPending);
        }

        var maskedEmail = MaskEmail(emailNormalized);
        if (_logger.IsEnabled(LogLevel.Information))
        {
            StorefrontOrderLogger.OrderReceived(
                _logger,
                command.TenantId,
                requestId,
                maskedEmail,
                command.ClientIp ?? "unknown",
                command.UserAgent ?? "unknown");
        }

        var warehouse = await _warehouses.GetMainAsync(command.TenantId, ct).ConfigureAwait(false);
        if (warehouse is null)
        {
            return Result.Failure<StorefrontOrderCreatedDto>(WarehouseMissing);
        }

        if (!settings.PaymentMethods.Contains(paymentMethod)
            || !settings.ShippingMethods.Any(option => option.Method == shippingMethod))
        {
            return Result.Failure<StorefrontOrderCreatedDto>(MethodNotAvailable);
        }

        var shippingOption = settings.ShippingMethods.First(option => option.Method == shippingMethod);

        var createCommand = new CreateEcommerceOrderCommand(
            TenantId: command.TenantId,
            WarehouseId: warehouse.Id,
            PaymentMethod: paymentMethod,
            ShippingMethod: shippingMethod,
            Customer: BuildCustomer(command.Customer, command.Shipping.Address),
            Shipping: BuildShipping(command.Customer, command.Shipping),
            Items: command.Items
                .Select(item => new CreateEcommerceOrderItemInput(item.CatalogItemId, item.Quantity))
                .ToList(),
            ShippingCost: shippingOption.Cost,
            InternalNotes: null,
            CustomerNotes: string.IsNullOrWhiteSpace(command.Notes) ? null : command.Notes.Trim(),
            CreatedBy: null,
            CreatedByName: SystemCustomerName,
            ClientRequestId: requestId,
            ReserveStock: settings.ReserveOnOrder,
            AcceptPrivacyPolicy: command.AcceptPrivacyPolicy);

        try
        {
            var result = await _sender
                .SendAsync<CreateEcommerceOrderCommand, CreateEcommerceOrderResponse>(createCommand, ct)
                .ConfigureAwait(false);

            if (result.IsFailure)
            {
                return Result.Failure<StorefrontOrderCreatedDto>(MapError(result.Error!));
            }

            var created = result.Value!;
            await TryNotifyOrderCreatedAsync(command.TenantId, created.OrderId, settings, paymentMethod, ct)
                .ConfigureAwait(false);

            return Result.Success(new StorefrontOrderCreatedDto(
                created.OrderId,
                created.OrderNumber,
                created.Status.ToString(),
                created.Subtotal,
                created.TaxAmount,
                created.ShippingCost,
                created.TotalAmount,
                created.PaymentMethod.ToString(),
                paymentMethod == EcommercePaymentMethod.BankTransfer ? settings.BankTransferInstructions : null,
                created.PaymentProofToken));
        }
        catch (ConcurrencyConflictException)
        {
            return Result.Failure<StorefrontOrderCreatedDto>(StockConflict);
        }
    }

    private async Task TryNotifyOrderCreatedAsync(
        Guid tenantId,
        Guid orderId,
        EcommerceStorefrontSettings settings,
        EcommercePaymentMethod paymentMethod,
        CancellationToken ct)
    {
        try
        {
            var order = await _orders
                .GetTrackedWithDetailsAsync(tenantId, orderId, ct)
                .ConfigureAwait(false);
            if (order is null)
            {
                return;
            }

            var paymentInstructions = paymentMethod == EcommercePaymentMethod.BankTransfer
                ? settings.BankTransferInstructions
                : null;

            await _orderEmailNotifier
                .NotifyOrderCreatedAsync(order, paymentInstructions, ct)
                .ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            StorefrontOrderLogger.NotificationFailed(_logger, orderId, ex);
        }
    }

    private async Task<bool> IsBlockedAsync(
        Guid tenantId,
        string emailNormalized,
        string phoneDigits,
        CancellationToken ct)
    {
        if (emailNormalized.Length > 0
            && await _blockedContacts
                .ExistsAsync(tenantId, EcommerceBlockedContactKind.Email, emailNormalized, ct)
                .ConfigureAwait(false))
        {
            return true;
        }

        return phoneDigits.Length > 0
            && await _blockedContacts
                .ExistsAsync(tenantId, EcommerceBlockedContactKind.Phone, phoneDigits, ct)
                .ConfigureAwait(false);
    }

    internal static string MaskEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return "n/a";
        }

        var atIndex = email.IndexOf('@', StringComparison.Ordinal);
        if (atIndex <= 0)
        {
            return "***";
        }

        var local = email[..atIndex];
        var domain = email[atIndex..];
        return local.Length <= 2
            ? $"***{domain}"
            : $"{local[0]}***{local[^1]}{domain}";
    }

    private static StorefrontOrderCreatedDto BuildResponse(
        EcommerceOrder order,
        EcommerceStorefrontSettings settings) =>
        new(
            order.Id,
            order.OrderNumber,
            order.Status.ToString(),
            order.Subtotal,
            order.TaxAmount,
            order.ShippingCost,
            order.TotalAmount,
            order.PaymentMethod.ToString(),
            order.PaymentMethod == EcommercePaymentMethod.BankTransfer ? settings.BankTransferInstructions : null,
            order.PaymentProofToken);

    private static Error MapError(Error error) =>
        error.Code is "inventory.stock.insufficient_available" or "inventory.stock.reserved_conflict"
            ? StockConflict
            : error;

    private static EcommerceCustomerInfo BuildCustomer(
        CreateStorefrontOrderCustomerInput customer,
        string address)
    {
        var taxId = string.IsNullOrWhiteSpace(customer.TaxId) ? DefaultConsumerTaxId : customer.TaxId.Trim();

        return new EcommerceCustomerInfo(
            CustomerName: customer.Name.Trim(),
            TaxId: taxId,
            TaxIdType: string.IsNullOrWhiteSpace(customer.TaxId) ? DefaultConsumerTaxIdType : null,
            Email: customer.Email.Trim(),
            Phone: customer.Phone.Trim(),
            Address: address.Trim());
    }

    private static EcommerceShippingInfo BuildShipping(
        CreateStorefrontOrderCustomerInput customer,
        CreateStorefrontOrderShippingInput shipping) =>
        new(
            RecipientName: customer.Name.Trim(),
            RecipientPhone: customer.Phone.Trim(),
            AddressLine1: shipping.Address.Trim(),
            AddressLine2: null,
            City: shipping.City.Trim(),
            Province: null,
            PostalCode: null,
            Carrier: null,
            TrackingNumber: null,
            Notes: string.IsNullOrWhiteSpace(shipping.Reference) ? null : shipping.Reference.Trim());
}
