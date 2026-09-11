using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Business.Inventory;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Abstractions;
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
    private readonly IUnitOfWork _unitOfWork;

    public CreateEcommerceOrderHandler(
        IValidator<CreateEcommerceOrderCommand> validator,
        IIdGenerator idGenerator,
        IWarehouseRepository warehouses,
        ICatalogItemRepository catalogItems,
        IStockRepository stocks,
        IEcommerceOrderRepository orders,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _idGenerator = idGenerator;
        _warehouses = warehouses;
        _catalogItems = catalogItems;
        _stocks = stocks;
        _orders = orders;
        _unitOfWork = unitOfWork;
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

        var warehouse = await _warehouses.GetActiveByIdAsync(command.TenantId, command.WarehouseId, ct).ConfigureAwait(false);
        if (warehouse is null)
        {
            return Result.Failure<CreateEcommerceOrderResponse>(
                new Error("ecommerce.order.warehouse_not_found", "La bodega de despacho no existe o no está activa.", ErrorType.NotFound));
        }

        var orderId = _idGenerator.NewId();
        var orderNumber = await _orders.GenerateNextOrderNumberAsync(command.TenantId, ct).ConfigureAwait(false);

        var orderResult = EcommerceOrder.Create(
            orderId,
            command.TenantId,
            orderNumber,
            command.WarehouseId,
            command.PaymentMethod,
            command.ShippingMethod,
            command.Customer,
            command.Shipping,
            command.ShippingCost,
            command.InternalNotes,
            command.CustomerNotes,
            command.CreatedBy,
            command.CreatedByName);

        if (orderResult.IsFailure)
        {
            return Result.Failure<CreateEcommerceOrderResponse>(orderResult.Error!);
        }

        var order = orderResult.Value!;

        foreach (var itemInput in command.Items)
        {
            var catalogItem = await _catalogItems.GetActiveByIdAsync(command.TenantId, itemInput.CatalogItemId, ct).ConfigureAwait(false);
            if (catalogItem is null || catalogItem.DeletedAt.HasValue)
            {
                return Result.Failure<CreateEcommerceOrderResponse>(
                    new Error("ecommerce.order.item_not_found", $"El producto {itemInput.CatalogItemId} no existe o fue eliminado.", ErrorType.NotFound));
            }

            var stock = await _stocks.GetTrackedAsync(command.TenantId, itemInput.CatalogItemId, command.WarehouseId, ct).ConfigureAwait(false);
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

            var itemResult = EcommerceOrderItem.Create(
                _idGenerator.NewId(),
                order.Id,
                catalogItem.Id,
                catalogItem.Sku ?? string.Empty,
                catalogItem.Name,
                itemInput.Quantity,
                itemInput.UnitPrice,
                itemInput.DiscountAmount,
                itemInput.TaxRate);

            if (itemResult.IsFailure)
            {
                return Result.Failure<CreateEcommerceOrderResponse>(itemResult.Error!);
            }

            order.AddItem(itemResult.Value!);
        }

        await _orders.AddAsync(order, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return new CreateEcommerceOrderResponse(order.Id, order.OrderNumber, order.Status, order.TotalAmount);
    }
}
