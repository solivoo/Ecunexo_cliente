using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Pricing;

namespace EcuNexo.Business.Pricing.Commands.CreatePriceList;

public sealed record CreatePriceListCommand(
    Guid TenantId,
    string Code,
    string Name,
    string? Description,
    string? Currency,
    bool PricesIncludeTax,
    DateOnly ValidFrom,
    DateOnly? ValidTo,
    int Priority,
    bool IsDefault) : ICommand<CreatePriceListResponse>;

public sealed record CreatePriceListResponse(Guid PriceListId, Guid TenantId);

public sealed class CreatePriceListHandler : ICommandHandler<CreatePriceListCommand, CreatePriceListResponse>
{
    private readonly IIdGenerator _idGenerator;
    private readonly ICallerContext _caller;
    private readonly IPriceListRepository _priceLists;
    private readonly IUnitOfWork _unitOfWork;

    public CreatePriceListHandler(
        IIdGenerator idGenerator,
        ICallerContext caller,
        IPriceListRepository priceLists,
        IUnitOfWork unitOfWork)
    {
        _idGenerator = idGenerator;
        _caller = caller;
        _priceLists = priceLists;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CreatePriceListResponse>> Handle(
        CreatePriceListCommand command,
        CancellationToken ct)
    {
        if (command.IsDefault
            && await _priceLists.GetDefaultTrackedAsync(command.TenantId, ct).ConfigureAwait(false) is not null)
        {
            return Result.Failure<CreatePriceListResponse>(
                new Error("catalog.pricing.price_list.default.conflict", "Ya existe una lista de precios predeterminada activa.", ErrorType.Conflict));
        }

        var normalizedCode = command.Code.Trim().ToUpperInvariant();
        if (await _priceLists.CodeExistsAsync(command.TenantId, normalizedCode, null, ct).ConfigureAwait(false))
        {
            return Result.Failure<CreatePriceListResponse>(
                new Error("catalog.pricing.price_list.code.duplicate", "Ya existe una lista de precios con el mismo código.", ErrorType.Conflict));
        }

        var created = PriceList.Create(
            _idGenerator.NewId(),
            command.TenantId,
            normalizedCode,
            command.Name,
            command.Description,
            command.Currency,
            command.PricesIncludeTax,
            command.ValidFrom,
            command.ValidTo,
            command.Priority,
            command.IsDefault,
            _caller.UserId);
        if (created.IsFailure)
        {
            return Result.Failure<CreatePriceListResponse>(created.Error!);
        }

        await _priceLists.AddAsync(created.Value!, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new CreatePriceListResponse(created.Value!.Id, created.Value.TenantId));
    }
}
