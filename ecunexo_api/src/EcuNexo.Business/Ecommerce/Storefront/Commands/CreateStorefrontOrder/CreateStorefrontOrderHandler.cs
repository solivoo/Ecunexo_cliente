using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Commands.CreateEcommerceOrder;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Business.Storefront;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Common;
using EcuNexo.Core.Ecommerce;
using FluentValidation;

namespace EcuNexo.Business.Ecommerce.Storefront.Commands.CreateStorefrontOrder;

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

    private readonly IValidator<CreateStorefrontOrderCommand> _validator;
    private readonly ITenantRepository _tenants;
    private readonly IWarehouseRepository _warehouses;
    private readonly IEcommerceStorefrontSettingsReader _settings;
    private readonly IEcommerceOrderRepository _orders;
    private readonly ISender _sender;

    public CreateStorefrontOrderHandler(
        IValidator<CreateStorefrontOrderCommand> validator,
        ITenantRepository tenants,
        IWarehouseRepository warehouses,
        IEcommerceStorefrontSettingsReader settings,
        IEcommerceOrderRepository orders,
        ISender sender)
    {
        _validator = validator;
        _tenants = tenants;
        _warehouses = warehouses;
        _settings = settings;
        _orders = orders;
        _sender = sender;
    }

    public async Task<Result<StorefrontOrderCreatedDto>> Handle(
        CreateStorefrontOrderCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<StorefrontOrderCreatedDto>(
                new Error("ecommerce.checkout.validation", message, ErrorType.Validation));
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
            ClientRequestId: requestId);

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
            return Result.Success(new StorefrontOrderCreatedDto(
                created.OrderId,
                created.OrderNumber,
                created.Status.ToString(),
                created.Subtotal,
                created.TaxAmount,
                created.ShippingCost,
                created.TotalAmount,
                created.PaymentMethod.ToString(),
                paymentMethod == EcommercePaymentMethod.BankTransfer ? settings.BankTransferInstructions : null));
        }
        catch (ConcurrencyConflictException)
        {
            return Result.Failure<StorefrontOrderCreatedDto>(StockConflict);
        }
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
            order.PaymentMethod == EcommercePaymentMethod.BankTransfer ? settings.BankTransferInstructions : null);

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
