using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;
using FluentValidation;

namespace EcuNexo.Business.Tenancy.Commands;

public sealed class CreateTenantHandler : ICommandHandler<CreateTenantCommand, CreateTenantResponse>
{
    private readonly IValidator<CreateTenantCommand> _validator;
    private readonly IIdGenerator _idGenerator;
    private readonly ITenantRepository _tenants;
    private readonly DefaultWarehouseProvisioner _warehouseProvisioner;
    private readonly IUnitOfWork _unitOfWork;

    public CreateTenantHandler(
        IValidator<CreateTenantCommand> validator,
        IIdGenerator idGenerator,
        ITenantRepository tenants,
        DefaultWarehouseProvisioner warehouseProvisioner,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _idGenerator = idGenerator;
        _tenants = tenants;
        _warehouseProvisioner = warehouseProvisioner;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CreateTenantResponse>> Handle(CreateTenantCommand command, CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<CreateTenantResponse>(new Error("tenant.create.validation", message, ErrorType.Validation));
        }

        ServicePlan plan;
        try
        {
            plan = new ServicePlan(command.ServicePlanName, command.MaxUsers, command.MaxWarehouses);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<CreateTenantResponse>(new Error("tenant.create.plan", ex.Message, ErrorType.Validation));
        }

        var id = _idGenerator.NewId();
        var created = Tenant.Create(
            id,
            command.Name,
            plan,
            command.TimeZoneId,
            command.Locale,
            command.LogoUrl,
            command.PrimaryColorHex);
        if (created.IsFailure)
        {
            return Result.Failure<CreateTenantResponse>(created.Error!);
        }

        var tenant = created.Value!;
        await _tenants.AddAsync(tenant, ct).ConfigureAwait(false);
        await _warehouseProvisioner.StageDefaultsForTenantAsync(tenant, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return CreateTenantResponse.FromTenant(tenant);
    }
}
