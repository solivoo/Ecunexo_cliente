using System.Globalization;
using System.Text.Json;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Business.Inventory;
using EcuNexo.Business.Pricing;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using EcuNexo.Core.Ecommerce;
using FluentValidation;

namespace EcuNexo.Business.Ecommerce.Commands.CreateEcommerceOrder;

public sealed class CreateEcommerceOrderHandler
    : ICommandHandler<CreateEcommerceOrderCommand, CreateEcommerceOrderResponse>
{
    private readonly IValidator<CreateEcommerceOrderCommand> _validator;
    private readonly IIdGenerator _idGenerator;
    private readonly IWarehouseRepository _warehouses;
    private readonly ICatalogItemRepository _catalogItems;
    private readonly IStockRepository _stocks;
    private readonly IEcommerceOrderRepository _orders;
    private readonly IPricingService _pricing;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPromotionRepository? _promotions;

    public CreateEcommerceOrderHandler(
        IValidator<CreateEcommerceOrderCommand> validator,
        IIdGenerator idGenerator,
        IWarehouseRepository warehouses,
        ICatalogItemRepository catalogItems,
        IStockRepository stocks,
        IEcommerceOrderRepository orders,
        IPricingService pricing,
        IUnitOfWork unitOfWork,
        IPromotionRepository? promotions = null)
    {
        _validator = validator;
        _idGenerator = idGenerator;
        _warehouses = warehouses;
        _catalogItems = catalogItems;
        _stocks = stocks;
        _orders = orders;
        _pricing = pricing;
        _unitOfWork = unitOfWork;
        _promotions = promotions;
    }

    public async Task<Result<CreateEcommerceOrderResponse>> Handle(
        CreateEcommerceOrderCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<CreateEcommerceOrderResponse>(
                new Error("ecommerce.order.create.validation", message, ErrorType.Validation));
        }

        var clientRequestId = string.IsNullOrWhiteSpace(command.ClientRequestId)
            ? null
            : command.ClientRequestId.Trim();

        if (clientRequestId is not null)
        {
            var existing = await _orders
                .FindByClientRequestIdAsync(command.TenantId, clientRequestId, ct)
                .ConfigureAwait(false);
            if (existing is not null)
            {
                return ToResponse(existing);
            }
        }

        Guid? effectiveWarehouseId = command.WarehouseId is { } wid && wid != Guid.Empty
            ? wid
            : null;

        if (effectiveWarehouseId is { } warehouseId)
        {
            var warehouse = await _warehouses.GetActiveByIdAsync(command.TenantId, warehouseId, ct).ConfigureAwait(false);
            if (warehouse is null)
            {
                return Result.Failure<CreateEcommerceOrderResponse>(
                    new Error("ecommerce.order.warehouse_not_found", "La bodega de despacho no existe o no está activa.", ErrorType.NotFound));
            }
        }
        else if (command.ReserveStock)
        {
            return Result.Failure<CreateEcommerceOrderResponse>(
                new Error("ecommerce.order.warehouse_required", "La bodega de despacho es obligatoria cuando se reserva stock.", ErrorType.Validation));
        }

        var effectiveReserveStock = command.ReserveStock && effectiveWarehouseId.HasValue;

        var orderId = _idGenerator.NewId();
        var orderNumber = await _orders.GenerateNextOrderNumberAsync(command.TenantId, ct).ConfigureAwait(false);

        var orderResult = EcommerceOrder.Create(
            orderId,
            command.TenantId,
            orderNumber,
            effectiveWarehouseId,
            command.PaymentMethod,
            command.ShippingMethod,
            command.Customer,
            command.Shipping,
            command.ShippingCost,
            command.InternalNotes,
            command.CustomerNotes,
            command.CreatedBy,
            command.CreatedByName,
            clientRequestId,
            effectiveReserveStock,
            command.AcceptPrivacyPolicy);

        if (orderResult.IsFailure)
        {
            return Result.Failure<CreateEcommerceOrderResponse>(orderResult.Error!);
        }

        var order = orderResult.Value!;

        var validatedItems = new List<(Guid LineId, CatalogItem CatalogItem, CreateEcommerceOrderItemInput Input)>(command.Items.Count);
        foreach (var itemInput in command.Items)
        {
            var catalogItem = await _catalogItems.GetActiveByIdAsync(command.TenantId, itemInput.CatalogItemId, ct).ConfigureAwait(false);
            if (catalogItem is null || catalogItem.DeletedAt.HasValue)
            {
                return Result.Failure<CreateEcommerceOrderResponse>(
                    new Error("ecommerce.order.item_not_found", $"El producto {itemInput.CatalogItemId} no existe o fue eliminado.", ErrorType.NotFound));
            }

            if (catalogItem.IsMatrixParent)
            {
                return Result.Failure<CreateEcommerceOrderResponse>(
                    new Error("ecommerce.order.matrix_parent_not_purchasable", $"El producto matriz '{catalogItem.Name}' requiere seleccionar una variante específica.", ErrorType.Validation));
            }

            if (catalogItem.IsHiddenFromStorefront)
            {
                return Result.Failure<CreateEcommerceOrderResponse>(
                    new Error("ecommerce.order.item_hidden", $"El producto '{catalogItem.Name}' ya no está disponible en la tienda.", ErrorType.Conflict));
            }

            if (catalogItem.ParentId is { } parentId)
            {
                var parent = await _catalogItems.GetActiveByIdAsync(command.TenantId, parentId, ct).ConfigureAwait(false);
                if (parent is null || parent.DeletedAt.HasValue || parent.IsHiddenFromStorefront)
                {
                    return Result.Failure<CreateEcommerceOrderResponse>(
                        new Error("ecommerce.order.item_hidden", $"El producto '{catalogItem.Name}' ya no está disponible en la tienda.", ErrorType.Conflict));
                }
            }

            if (effectiveReserveStock && effectiveWarehouseId is { } reserveWarehouseId)
            {
                var stock = await _stocks.GetTrackedAsync(command.TenantId, itemInput.CatalogItemId, reserveWarehouseId, ct).ConfigureAwait(false);
                if (stock is null)
                {
                    return Result.Failure<CreateEcommerceOrderResponse>(
                        new Error("ecommerce.order.stock_missing", $"No existe registro de stock para el producto '{catalogItem.Name}' ({catalogItem.Sku}) en la bodega seleccionada.", ErrorType.Conflict));
                }

                var reserveResult = stock.Reserve(itemInput.Quantity, command.CreatedBy);
                if (reserveResult.IsFailure)
                {
                    return Result.Failure<CreateEcommerceOrderResponse>(reserveResult.Error!);
                }
            }

            validatedItems.Add((Guid.NewGuid(), catalogItem, itemInput));
        }

        if (validatedItems.Count > 0)
        {
            var cartPricing = await _pricing.ResolveCartAsync(
                command.TenantId,
                new CartPricingRequest(
                    validatedItems
                        .Select(v => new CartPricingLineRequest(v.CatalogItem.Id, v.Input.Quantity, v.LineId))
                        .ToList(),
                    DateOnly.FromDateTime(DateTime.UtcNow),
                    CouponCode: string.IsNullOrWhiteSpace(command.CouponCode) ? null : command.CouponCode.Trim(),
                    PricesIncludeTaxOverride: command.PricesIncludeTaxOverride),
                ct).ConfigureAwait(false);

            if (cartPricing.IsFailure)
            {
                return Result.Failure<CreateEcommerceOrderResponse>(
                    cartPricing.Error!.Code is "catalog.pricing.price_list.not_found"
                        or "catalog.pricing.price.not_found"
                        or "catalog.pricing.price_list.not_valid"
                        ? new Error(
                            "ecommerce.order.price_not_configured",
                            "Alguno de los productos del pedido no tiene precio vigente en una lista activa.",
                            ErrorType.Conflict)
                        : cartPricing.Error);
            }

            var resolvedCart = cartPricing.Value!;
            var linesById = resolvedCart.Lines.ToDictionary(l => l.LineId);

            foreach (var v in validatedItems)
            {
                var resolved = linesById[v.LineId];
                var snapshot = new EcommerceItemPricingSnapshot(
                    resolvedCart.PriceListId == Guid.Empty ? null : resolvedCart.PriceListId,
                    resolved.ListPrice,
                    resolved.TaxAmount,
                    resolved.FinalPrice,
                    JsonSerializer.Serialize(resolved.AppliedRules));

                var itemResult = EcommerceOrderItem.Create(
                    _idGenerator.NewId(),
                    order.Id,
                    v.CatalogItem.Id,
                    v.CatalogItem.Sku ?? string.Empty,
                    v.CatalogItem.Name,
                    v.Input.Quantity,
                    resolved.UnitPrice,
                    resolved.DiscountAmount,
                    resolved.TaxRate,
                    snapshot);

                if (itemResult.IsFailure)
                {
                    return Result.Failure<CreateEcommerceOrderResponse>(itemResult.Error!);
                }

                order.AddItem(itemResult.Value!);
            }
        }

        if (!string.IsNullOrWhiteSpace(command.CouponCode) && _promotions is not null)
        {
            var coupon = await _promotions
                .GetTrackedByCodeAsync(command.TenantId, command.CouponCode, ct)
                .ConfigureAwait(false);
            var now = DateTimeOffset.UtcNow;
            if (coupon is null || !coupon.IsApplicableOn(now))
            {
                return Result.Failure<CreateEcommerceOrderResponse>(
                    new Error(
                        "ecommerce.order.coupon_invalid",
                        "El código promocional no es válido o ha expirado.",
                        ErrorType.Validation));
            }

            var grossOrderSubtotal = order.Items.Sum(i => i.Quantity * i.UnitPrice);
            if (coupon.MinOrderAmount is > 0m && grossOrderSubtotal < coupon.MinOrderAmount.Value)
            {
                return Result.Failure<CreateEcommerceOrderResponse>(
                    new Error(
                        "ecommerce.order.coupon_min_amount",
                        $"El código promocional requiere una compra mínima de ${FormatCurrency(coupon.MinOrderAmount.Value)}.",
                        ErrorType.Validation));
            }

            coupon.RegisterUse(command.CreatedBy);
        }

        var effectiveOrderAmount = command.PricesIncludeTaxOverride == true
            ? order.Subtotal + order.TaxAmount
            : order.Subtotal;
        if (command.MinOrderAmount > 0m && effectiveOrderAmount < command.MinOrderAmount)
        {
            return Result.Failure<CreateEcommerceOrderResponse>(
                new Error(
                    "ecommerce.order.min_order_amount",
                    $"El pedido mínimo es ${FormatCurrency(command.MinOrderAmount)}.",
                    ErrorType.Validation));
        }

        await _orders.AddAsync(order, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return ToResponse(order);
    }

    private static string FormatCurrency(decimal value) =>
        value.ToString("0.00", CultureInfo.InvariantCulture);

    private static CreateEcommerceOrderResponse ToResponse(EcommerceOrder order) =>
        new(
            order.Id,
            order.OrderNumber,
            order.Status,
            order.Subtotal,
            order.TaxAmount,
            order.ShippingCost,
            order.TotalAmount,
            order.PaymentMethod,
            order.PaymentProofToken,
            order.DiscountAmount);
}
