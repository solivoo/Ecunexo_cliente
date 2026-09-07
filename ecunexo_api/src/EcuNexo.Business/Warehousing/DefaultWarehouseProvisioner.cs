using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Tenancy.Authorization;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Tenancy;
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

    /// <summary>
    /// Añade bodegas por defecto al contexto (sin persistir). Llamar al crear una empresa, antes de <see cref="IUnitOfWork.SaveChangesAsync"/>.
    /// </summary>
    public Task StageDefaultsForTenantAsync(Tenant tenant, CancellationToken ct) =>
        StageDefaultsAsync(tenant, ct);

    /// <summary>
    /// Idempotente para tenants ya persistidos (p. ej. listado de bodegas en empresas antiguas).
    /// </summary>
    public Task EnsureAsync(Guid tenantId, CancellationToken ct) =>
        EnsurePersistedAsync(tenantId, isRetry: false, ct);

    private async Task EnsurePersistedAsync(Guid tenantId, bool isRetry, CancellationToken ct)
    {
        var tenant = await _tenants.GetByIdAsync(tenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return;
        }

        var changed = await StageDefaultsAsync(tenant, ct).ConfigureAwait(false);
        if (!changed)
        {
            return;
        }

        if (await _unitOfWork.TrySaveChangesAsync(ct).ConfigureAwait(false) || isRetry)
        {
            return;
        }

        await EnsurePersistedAsync(tenantId, isRetry: true, ct).ConfigureAwait(false);
    }

    private async Task<bool> StageDefaultsAsync(Tenant tenant, CancellationToken ct)
    {
        if (!ShouldProvisionWarehouses(tenant))
        {
            return false;
        }

        var tenantId = tenant.Id;
        var hasTransit = await _warehouses
            .HasSystemRoleAsync(tenantId, WarehouseSystemRole.Transit, ct)
            .ConfigureAwait(false);
        var hasMain = await _warehouses.HasMainAsync(tenantId, ct).ConfigureAwait(false);
        if (hasTransit && hasMain)
        {
            return false;
        }

        var changed = false;

        if (!hasMain)
        {
            changed |= await EnsureMainAsync(tenantId, ct).ConfigureAwait(false);
        }

        if (tenant.AllowsMultipleWarehouses() && !hasTransit)
        {
            changed |= await EnsureTransitAsync(tenantId, ct).ConfigureAwait(false);
        }

        return changed;
    }

    private static bool ShouldProvisionWarehouses(Tenant tenant) =>
        tenant.ResolveMaxWarehouses() >= 1
        && ModulePermissionFilter.IsModuleEnabled(
            TenantModuleCodes.Warehousing,
            tenant.EnabledModuleCodes,
            tenant.ModuleEntitlements);

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

        if (await _warehouses.CodeExistsIgnoreCaseAsync(tenantId, Warehouse.MainDefaultCode, null, ct)
                .ConfigureAwait(false))
        {
            return false;
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

        if (await _warehouses.CodeExistsIgnoreCaseAsync(tenantId, Warehouse.TransitDefaultCode, null, ct)
                .ConfigureAwait(false))
        {
            return false;
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
