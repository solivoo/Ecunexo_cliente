using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Warehousing;
using FluentValidation;

namespace EcuNexo.Business.Warehousing.Commands.CreateWarehouse;

public sealed class CreateWarehouseHandler : ICommandHandler<CreateWarehouseCommand, CreateWarehouseResponse>
{
    private readonly IValidator<CreateWarehouseCommand> _validator;
    private readonly IIdGenerator _idGenerator;
    private readonly ITenantRepository _tenants;
    private readonly IWarehouseRepository _warehouses;
    private readonly DefaultWarehouseProvisioner _defaults;
    private readonly IUnitOfWork _unitOfWork;

    public CreateWarehouseHandler(
        IValidator<CreateWarehouseCommand> validator,
        IIdGenerator idGenerator,
        ITenantRepository tenants,
        IWarehouseRepository warehouses,
        DefaultWarehouseProvisioner defaults,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _idGenerator = idGenerator;
        _tenants = tenants;
        _warehouses = warehouses;
        _defaults = defaults;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CreateWarehouseResponse>> Handle(
        CreateWarehouseCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<CreateWarehouseResponse>(
                new Error("warehousing.warehouse.create.validation", message, ErrorType.Validation));
        }

        var tenant = await _tenants.GetByIdAsync(command.TenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<CreateWarehouseResponse>(
                new Error("warehousing.warehouse.tenant.not_found", "El tenant no existe.", ErrorType.NotFound));
        }

        await _defaults.EnsureAsync(command.TenantId, ct).ConfigureAwait(false);

        if (await _warehouses.NameExistsIgnoreCaseAsync(command.TenantId, command.Name, null, ct)
            .ConfigureAwait(false))
        {
            return Result.Failure<CreateWarehouseResponse>(
                new Error(
                    "warehousing.warehouse.name.duplicate",
                    "Ya existe una bodega con el mismo nombre.",
                    ErrorType.Conflict));
        }

        if (!string.IsNullOrWhiteSpace(command.Code)
            && await _warehouses.CodeExistsIgnoreCaseAsync(command.TenantId, command.Code, null, ct)
                .ConfigureAwait(false))
        {
            return Result.Failure<CreateWarehouseResponse>(
                new Error(
                    "warehousing.warehouse.code.duplicate",
                    "Ya existe una bodega con el mismo código.",
                    ErrorType.Conflict));
        }

        var hasMain = await _warehouses.HasMainAsync(command.TenantId, ct).ConfigureAwait(false);
        var isMain = !hasMain && (command.IsMain || !tenant.AllowsMultipleWarehouses());
        var created = Warehouse.Create(
            _idGenerator.NewId(),
            command.TenantId,
            command.Name,
            command.Code,
            isMain: isMain);
        if (created.IsFailure)
        {
            return Result.Failure<CreateWarehouseResponse>(created.Error!);
        }

        await _warehouses.AddAsync(created.Value!, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new CreateWarehouseResponse(created.Value!.Id, created.Value.TenantId));
    }
}
