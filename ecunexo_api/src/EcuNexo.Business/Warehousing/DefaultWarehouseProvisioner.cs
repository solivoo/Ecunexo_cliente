using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Warehousing;

namespace EcuNexo.Business.Warehousing;

public sealed class DefaultWarehouseProvisioner
{
    private readonly IIdGenerator _idGenerator;
    private readonly ITenantRepository _tenants;
    private readonly IWarehouseRepository _warehouses;
    private readonly IUnitOfWork _unitOfWork;

    public DefaultWarehouseProvisioner(
        IIdGenerator idGenerator,
        ITenantRepository tenants,
        IWarehouseRepository warehouses,
        IUnitOfWork unitOfWork)
    {
        _idGenerator = idGenerator;
        _tenants = tenants;
        _warehouses = warehouses;
        _unitOfWork = unitOfWork;
    }

    public async Task EnsureAsync(Guid tenantId, CancellationToken ct)
    {
        var tenant = await _tenants.GetByIdAsync(tenantId, ct).ConfigureAwait(false);
        if (tenant is null || !tenant.AllowsMultipleWarehouses())
        {
            return;
        }

        var hasTransit = await _warehouses
            .HasSystemRoleAsync(tenantId, WarehouseSystemRole.Transit, ct)
            .ConfigureAwait(false);
        var hasMain = await _warehouses.HasMainAsync(tenantId, ct).ConfigureAwait(false);
        if (hasTransit && hasMain)
        {
            return;
        }

        var changed = false;

        if (!hasMain)
        {
            changed |= await EnsureMainAsync(tenantId, ct).ConfigureAwait(false);
        }

        if (!hasTransit)
        {
            changed |= await EnsureTransitAsync(tenantId, ct).ConfigureAwait(false);
        }

        if (changed)
        {
            await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        }
    }

    private async Task<bool> EnsureMainAsync(Guid tenantId, CancellationToken ct)
    {
        var existing = await FindActiveAsync(
                tenantId,
                Warehouse.MainDefaultCode,
                Warehouse.MainDefaultName,
                ct)
            .ConfigureAwait(false);
        if (existing is not null)
        {
            if (existing.IsMain)
            {
                return false;
            }

            var designated = existing.DesignateAsMain();
            return designated.IsSuccess;
        }

        var main = Warehouse.Create(
            _idGenerator.NewId(),
            tenantId,
            Warehouse.MainDefaultName,
            code: Warehouse.MainDefaultCode,
            isMain: true);
        if (main.IsFailure)
        {
            return false;
        }

        await _warehouses.AddAsync(main.Value!, ct).ConfigureAwait(false);
        return true;
    }

    private async Task<bool> EnsureTransitAsync(Guid tenantId, CancellationToken ct)
    {
        var existing = await FindActiveAsync(
                tenantId,
                Warehouse.TransitDefaultCode,
                Warehouse.TransitDefaultName,
                ct)
            .ConfigureAwait(false);
        if (existing is not null)
        {
            if (existing.IsTransit)
            {
                return false;
            }

            var designated = existing.DesignateAsSystemTransit();
            return designated.IsSuccess;
        }

        var transit = Warehouse.CreateSystem(
            _idGenerator.NewId(),
            tenantId,
            Warehouse.TransitDefaultName,
            WarehouseSystemRole.Transit,
            Warehouse.TransitDefaultCode,
            isMain: false);
        if (transit.IsFailure)
        {
            return false;
        }

        await _warehouses.AddAsync(transit.Value!, ct).ConfigureAwait(false);
        return true;
    }

    private async Task<Warehouse?> FindActiveAsync(
        Guid tenantId,
        string code,
        string name,
        CancellationToken ct)
    {
        var byCode = await _warehouses
            .GetTrackedByCodeIgnoreCaseAsync(tenantId, code, ct)
            .ConfigureAwait(false);
        if (byCode is not null)
        {
            return byCode;
        }

        return await _warehouses
            .GetTrackedByNameIgnoreCaseAsync(tenantId, name, ct)
            .ConfigureAwait(false);
    }
}
