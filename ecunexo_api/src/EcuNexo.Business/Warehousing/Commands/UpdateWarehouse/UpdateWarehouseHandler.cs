using System.Text.Json;
using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Warehousing.Commands.UpdateWarehouse;

public sealed class UpdateWarehouseHandler : ICommandHandler<UpdateWarehouseCommand, UpdateWarehouseResponse>
{
    private static readonly JsonSerializerOptions AddressJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly IValidator<UpdateWarehouseCommand> _validator;
    private readonly IWarehouseRepository _warehouses;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateWarehouseHandler(
        IValidator<UpdateWarehouseCommand> validator,
        IWarehouseRepository warehouses,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _warehouses = warehouses;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UpdateWarehouseResponse>> Handle(
        UpdateWarehouseCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<UpdateWarehouseResponse>(
                new Error("warehousing.warehouse.update.validation", message, ErrorType.Validation));
        }

        var warehouse = await _warehouses
            .GetTrackedByIdAsync(command.TenantId, command.WarehouseId, ct)
            .ConfigureAwait(false);
        if (warehouse is null)
        {
            return Result.Failure<UpdateWarehouseResponse>(
                new Error("warehousing.warehouse.not_found", "La bodega no existe.", ErrorType.NotFound));
        }

        if (await _warehouses
            .NameExistsIgnoreCaseAsync(command.TenantId, command.Name, command.WarehouseId, ct)
            .ConfigureAwait(false))
        {
            return Result.Failure<UpdateWarehouseResponse>(
                new Error(
                    "warehousing.warehouse.name.duplicate",
                    "Ya existe una bodega con el mismo nombre.",
                    ErrorType.Conflict));
        }

        if (!string.IsNullOrWhiteSpace(command.Code)
            && await _warehouses
                .CodeExistsIgnoreCaseAsync(command.TenantId, command.Code, command.WarehouseId, ct)
                .ConfigureAwait(false))
        {
            return Result.Failure<UpdateWarehouseResponse>(
                new Error(
                    "warehousing.warehouse.code.duplicate",
                    "Ya existe una bodega con el mismo código.",
                    ErrorType.Conflict));
        }

        var updated = warehouse.UpdateDetails(
            command.Name,
            command.Code,
            SerializeAddress(command.AddressLine1, command.City, command.Notes),
            updatedBy: null);
        if (updated.IsFailure)
        {
            return Result.Failure<UpdateWarehouseResponse>(updated.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new UpdateWarehouseResponse(warehouse.Id, warehouse.TenantId));
    }

    private static string SerializeAddress(string? line1, string? city, string? notes)
    {
        var trimmedLine = string.IsNullOrWhiteSpace(line1) ? null : line1.Trim();
        var trimmedCity = string.IsNullOrWhiteSpace(city) ? null : city.Trim();
        var trimmedNotes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        if (trimmedLine is null && trimmedCity is null && trimmedNotes is null)
        {
            return "{}";
        }

        return JsonSerializer.Serialize(
            new Dictionary<string, string?>
            {
                ["line1"] = trimmedLine,
                ["city"] = trimmedCity,
                ["notes"] = trimmedNotes,
            },
            AddressJsonOptions);
    }
}
