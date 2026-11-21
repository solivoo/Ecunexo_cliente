using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Customers.Repositories;
using EcuNexo.Business.Inventory;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Customers;
using EcuNexo.Core.Ecommerce;
using FluentValidation;

namespace EcuNexo.Business.Ecommerce.Reservations.CreateStockReservation;

public sealed record CreateReservationCustomerInput(
    string Name,
    string? TaxId,
    string? Email,
    string? Phone,
    string? Address,
    CustomerIdentificationType IdentificationType = CustomerIdentificationType.Cedula,
    string? City = null);

public sealed record CreateReservationItemInput(
    Guid CatalogItemId,
    decimal Quantity,
    decimal? UnitPrice = null,
    decimal? TaxRate = null);

public sealed record CreateStockReservationCommand(
    Guid TenantId,
    Guid WarehouseId,
    Guid? CustomerId,
    CreateReservationCustomerInput? NewCustomer,
    IReadOnlyList<CreateReservationItemInput> Items,
    DateTimeOffset? ExpiresAtUtc = null,
    string? Notes = null,
    Guid? CreatedBy = null) : ICommand<StockReservationDto>;

public sealed class CreateStockReservationValidator : AbstractValidator<CreateStockReservationCommand>
{
    public CreateStockReservationValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.WarehouseId).NotEmpty();
        RuleFor(x => x.Items).NotEmpty().WithMessage("Debe seleccionar al menos un SKU para reservar.");
        RuleForEach(x => x.Items).ChildRules(i =>
        {
            i.RuleFor(x => x.CatalogItemId).NotEmpty();
            i.RuleFor(x => x.Quantity).GreaterThan(0);
        });
    }
}

public sealed class CreateStockReservationHandler
    : ICommandHandler<CreateStockReservationCommand, StockReservationDto>
{
    private readonly IStockReservationRepository _reservations;
    private readonly ICustomerRepository _customers;
    private readonly IWarehouseRepository _warehouses;
    private readonly ICatalogItemRepository _catalogItems;
    private readonly IStockRepository _stocks;
    private readonly IIdGenerator _idGenerator;
    private readonly IUnitOfWork _unitOfWork;

    public CreateStockReservationHandler(
        IStockReservationRepository reservations,
        ICustomerRepository customers,
        IWarehouseRepository warehouses,
        ICatalogItemRepository catalogItems,
        IStockRepository stocks,
        IIdGenerator idGenerator,
        IUnitOfWork unitOfWork)
    {
        _reservations = reservations;
        _customers = customers;
        _warehouses = warehouses;
        _catalogItems = catalogItems;
        _stocks = stocks;
        _idGenerator = idGenerator;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<StockReservationDto>> Handle(
        CreateStockReservationCommand command,
        CancellationToken ct)
    {
        var warehouse = await _warehouses
            .GetActiveByIdAsync(command.TenantId, command.WarehouseId, ct)
            .ConfigureAwait(false);
        if (warehouse is null)
        {
            return Result.Failure<StockReservationDto>(
                new Error("ecommerce.reservation.warehouse_not_found", "La bodega seleccionada no existe o no está activa.", ErrorType.NotFound));
        }

        Customer? customer = null;
        if (command.CustomerId is { } existingCustomerId && existingCustomerId != Guid.Empty)
        {
            customer = await _customers.GetByIdAsync(command.TenantId, existingCustomerId, ct).ConfigureAwait(false);
            if (customer is null)
            {
                return Result.Failure<StockReservationDto>(
                    new Error("ecommerce.reservation.customer_not_found", "El cliente seleccionado no existe.", ErrorType.NotFound));
            }
        }
        else if (command.NewCustomer is not null)
        {
            if (!string.IsNullOrWhiteSpace(command.NewCustomer.TaxId))
            {
                customer = await _customers
                    .GetByTaxIdAsync(command.TenantId, command.NewCustomer.TaxId.Trim(), ct)
                    .ConfigureAwait(false);
            }

            if (customer is null)
            {
                var createdCustomer = Customer.Create(
                    _idGenerator.NewId(),
                    command.TenantId,
                    command.NewCustomer.Name,
                    command.NewCustomer.TaxId,
                    command.NewCustomer.Email,
                    command.NewCustomer.Phone,
                    command.NewCustomer.Address,
                    customerType: CustomerType.PersonaNatural,
                    identificationType: command.NewCustomer.IdentificationType,
                    city: command.NewCustomer.City);
                if (createdCustomer.IsFailure)
                {
                    return Result.Failure<StockReservationDto>(createdCustomer.Error!);
                }

                customer = createdCustomer.Value!;
                await _customers.AddAsync(customer, ct).ConfigureAwait(false);
            }
        }
        else
        {
            return Result.Failure<StockReservationDto>(
                new Error("ecommerce.reservation.customer_required", "Debe seleccionar o crear un cliente.", ErrorType.Validation));
        }

        var reservationNumber = await _reservations
            .GenerateNextNumberAsync(command.TenantId, ct)
            .ConfigureAwait(false);

        var reservationResult = StockReservation.Create(
            _idGenerator.NewId(),
            command.TenantId,
            reservationNumber,
            warehouse.Id,
            customer.Id,
            customer.Name,
            customer.TaxId ?? "9999999999999",
            customer.ContactEmail,
            customer.ContactPhone,
            command.ExpiresAtUtc,
            command.Notes,
            command.CreatedBy);

        if (reservationResult.IsFailure)
        {
            return Result.Failure<StockReservationDto>(reservationResult.Error!);
        }

        var reservation = reservationResult.Value!;

        foreach (var itemInput in command.Items)
        {
            var catalogItem = await _catalogItems
                .GetActiveByIdAsync(command.TenantId, itemInput.CatalogItemId, ct)
                .ConfigureAwait(false);
            if (catalogItem is null)
            {
                return Result.Failure<StockReservationDto>(
                    new Error("ecommerce.reservation.item_not_found", $"El producto '{itemInput.CatalogItemId}' no existe o está inactivo.", ErrorType.NotFound));
            }

            var stock = await _stocks
                .GetTrackedAsync(command.TenantId, itemInput.CatalogItemId, warehouse.Id, ct)
                .ConfigureAwait(false);
            if (stock is null)
            {
                return Result.Failure<StockReservationDto>(
                    new Error("ecommerce.reservation.stock_missing", $"No existe stock registrado para '{catalogItem.Name}' ({catalogItem.Sku}) en la bodega '{warehouse.Name}'.", ErrorType.Conflict));
            }

            var reserveResult = stock.Reserve(itemInput.Quantity, command.CreatedBy);
            if (reserveResult.IsFailure)
            {
                return Result.Failure<StockReservationDto>(reserveResult.Error!);
            }

            var unitPrice = itemInput.UnitPrice ?? catalogItem.BasePrice ?? 0m;
            var taxRate = itemInput.TaxRate ?? 15m;
            var lineResult = StockReservationItem.Create(
                _idGenerator.NewId(),
                reservation.Id,
                catalogItem.Id,
                catalogItem.Sku ?? string.Empty,
                catalogItem.Name,
                itemInput.Quantity,
                unitPrice,
                taxRate);
            if (lineResult.IsFailure)
            {
                return Result.Failure<StockReservationDto>(lineResult.Error!);
            }

            var addResult = reservation.AddItem(lineResult.Value!);
            if (addResult.IsFailure)
            {
                return Result.Failure<StockReservationDto>(addResult.Error!);
            }
        }

        await _reservations.AddAsync(reservation, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(StockReservationMapper.ToDto(reservation));
    }
}
