using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity;
using EcuNexo.Business.Identity.Commands;
using EcuNexo.Business.Tenancy.Authorization;
using EcuNexo.Business.Tenancy.Commands;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;
using EcuNexo.Core.Tenancy;
using EcuNexo.Data;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Api.Development;

/// <summary>
/// Rellena un catálogo mínimo en <strong>Development</strong> cuando la BD no tiene tenants (idempotente).
/// </summary>
internal static class DevelopmentCatalogSeeder
{
    private const string SeedEmail = "superusuario.seed@ecunexo.local";
    private const string SeedPassword = "Demo123!";

    private static readonly (string Code, string Description, string DisplayName, string Module, int Sort)[] SeedPermissions =
    [
        ("identity.policies.manage", "Gestionar políticas ABAC.", "Gestionar políticas", TenantModuleCodes.Identity, 10),
        ("identity.permissions.read", "Consultar catálogo de permisos.", "Ver permisos", TenantModuleCodes.Identity, 20),
        ("identity.permissions.manage", "Crear permisos globales.", "Administrar permisos", TenantModuleCodes.Identity, 21),
        ("identity.users.read", "Listar y ver usuarios del tenant.", "Ver usuarios", TenantModuleCodes.Identity, 30),
        ("identity.users.create", "Crear usuarios en el tenant.", "Crear usuarios", TenantModuleCodes.Identity, 31),
        ("identity.users.update", "Editar y deshabilitar usuarios del tenant.", "Editar usuarios", TenantModuleCodes.Identity, 32),
        ("identity.users.delete", "Eliminar (baja lógica) usuarios del tenant.", "Eliminar usuarios", TenantModuleCodes.Identity, 33),
        ("identity.departments.read", "Listar departamentos del tenant.", "Ver departamentos", TenantModuleCodes.Identity, 34),
        ("identity.departments.manage", "Crear y administrar departamentos del tenant.", "Administrar departamentos", TenantModuleCodes.Identity, 35),
        ("identity.roles.read", "Listar y ver roles.", "Ver roles", TenantModuleCodes.Identity, 40),
        ("identity.roles.manage", "Crear roles y asignar permisos.", "Administrar roles", TenantModuleCodes.Identity, 41),
        ("tenancy.tenant.read", "Ver perfil y plan del tenant.", "Ver organización", "tenancy", 50),
        ("tenancy.license.apply", "Canjear un código para ampliar o modificar la licencia.", "Ampliar licencia", "tenancy", 56),
        ("tenancy.tenant.update", "Actualizar identidad tributaria / SRI del tenant.", "Editar organización SRI", "tenancy", 53),
        ("tenancy.tenants.read", "Listar empresas de la suscripción.", "Ver empresas", "tenancy", 51),
        ("tenancy.tenants.create", "Provisionar empresas adicionales bajo la licencia.", "Crear empresas", "tenancy", 52),
        ("tenancy.tenants.update", "Editar identidad y branding de empresas de la suscripción.", "Editar empresas", "tenancy", 55),
        ("tenancy.tenants.delete", "Eliminar (baja lógica) empresas de la suscripción.", "Eliminar empresas", "tenancy", 54),
        ("catalog.product.read", "Consultar productos (legacy).", "Ver productos", TenantModuleCodes.Catalog, 60),
        ("catalog.read", "Ver módulo catálogo.", "Catálogo — acceso", TenantModuleCodes.Catalog, 59),
        ("catalog.item.read", "Listar ítems del catálogo.", "Ítems — consultar", TenantModuleCodes.Catalog, 61),
        ("catalog.item.create", "Crear ítems del catálogo.", "Ítems — crear", TenantModuleCodes.Catalog, 62),
        ("catalog.item.update", "Editar ítems del catálogo.", "Ítems — editar", TenantModuleCodes.Catalog, 63),
        ("catalog.category.manage", "Crear y editar categorías.", "Categorías — administrar", TenantModuleCodes.Catalog, 64),
        ("platform.menu.manage", "CRUD catálogo menú SPA.", "Administrar menú", "platform", 5),
        ("platform.settings.read", "Ver preferencias de aplicación resueltas.", "Ver configuración de app", "platform", 6),
        ("platform.settings.update", "Guardar preferencias de UI del usuario.", "Editar configuración de app", "platform", 7),
    ];

    public static async Task EnsureSeedAsync(WebApplication app, CancellationToken cancellationToken)
    {
        if (!app.Environment.IsDevelopment())
        {
            return;
        }

        await using var scope = app.Services.CreateAsyncScope();
        var services = scope.ServiceProvider;
        var db = services.GetRequiredService<EcuNexoDbContext>();
        var sender = services.GetRequiredService<ISender>();

        await EnsurePermissionsCatalogAsync(sender, db, cancellationToken).ConfigureAwait(false);

        if (await db.Tenants.AsNoTracking().AnyAsync(cancellationToken).ConfigureAwait(false))
        {
            await EnsureSeedUserPasswordAsync(db, services, cancellationToken).ConfigureAwait(false);
            await EnsureSystemRolesHaveAllActivePermissionsAsync(sender, db, cancellationToken)
                .ConfigureAwait(false);
            await EnsureAdministrationDepartmentsAsync(sender, db, cancellationToken).ConfigureAwait(false);
            return;
        }

        var tenant = await sender
            .SendAsync<CreateTenantCommand, CreateTenantResponse>(
                new CreateTenantCommand(
                    "Everchic",
                    "Starter",
                    50,
                    10,
                    "America/Guayaquil",
                    "es-EC",
                    null,
                    "#2563eb"),
                cancellationToken)
            .ConfigureAwait(false);
        ThrowIfFailed(tenant);

        var tenantId = tenant.Value!.TenantId;

        var role = await sender
            .SendAsync<CreateRoleCommand, CreateRoleResponse>(
                new CreateRoleCommand(
                    tenantId,
                    "Administrador",
                    "Acceso completo de configuración en el tenant demo.",
                    IsSystem: true),
                cancellationToken)
            .ConfigureAwait(false);
        ThrowIfFailed(role);

        var roleId = role.Value!.RoleId;

        await GrantAllActivePermissionsToRoleAsync(sender, db, tenantId, roleId, cancellationToken)
            .ConfigureAwait(false);

        var department = await sender
            .SendAsync<CreateDepartmentCommand, CreateDepartmentResponse>(
                new CreateDepartmentCommand(
                    tenantId,
                    Department.AdministrationName,
                    Department.AdministrationDescription),
                cancellationToken)
            .ConfigureAwait(false);
        ThrowIfFailed(department);

        var user = await sender
            .SendAsync<CreateUserCommand, CreateUserResponse>(
                new CreateUserCommand(
                    tenantId,
                    SeedEmail,
                    "Superusuario (solo Development)",
                    SeedPassword,
                    DepartmentId: department.Value!.DepartmentId,
                    Department: Department.AdministrationName,
                    Phone: "+593999999999",
                    JobTitle: "Administrador"),
                cancellationToken)
            .ConfigureAwait(false);
        ThrowIfFailed(user);

        var assign = await sender
            .SendAsync<AssignUserRoleCommand, AssignUserRoleResponse>(
                new AssignUserRoleCommand(tenantId, user.Value!.UserId, roleId),
                cancellationToken)
            .ConfigureAwait(false);
        ThrowIfFailed(assign);

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    private static async Task EnsureSeedUserPasswordAsync(
        EcuNexoDbContext db,
        IServiceProvider services,
        CancellationToken cancellationToken)
    {
        var tenant = await db.Tenants.AsNoTracking().OrderBy(t => t.CreatedAt).FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);
        if (tenant is null)
        {
            return;
        }

        var candidates = await db.Users
            .IgnoreQueryFilters()
            .Where(u => u.TenantId == tenant.Id && u.DeletedAt == null)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        var user = candidates.FirstOrDefault(u =>
            string.Equals(u.Email.Value, SeedEmail, StringComparison.OrdinalIgnoreCase));
        if (user is null || !string.IsNullOrEmpty(user.PasswordHash))
        {
            return;
        }

        var hasher = services.GetRequiredService<IPasswordHasher>();
        await SetPasswordAsync(db, tenant.Id, user.Id, hasher, cancellationToken).ConfigureAwait(false);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    private static Task SetPasswordAsync(
        EcuNexoDbContext db,
        Guid tenantId,
        Guid userId,
        IPasswordHasher hasher,
        CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        var user = db.Users
            .IgnoreQueryFilters()
            .First(u => u.TenantId == tenantId && u.Id == userId);
        var hash = hasher.Hash(SeedPassword);
        var result = user.SetPasswordHash(hash);
        if (result.IsFailure)
        {
            throw new InvalidOperationException(result.Error!.Message);
        }

        return Task.CompletedTask;
    }

    private static async Task EnsurePermissionsCatalogAsync(
        ISender sender,
        EcuNexoDbContext db,
        CancellationToken cancellationToken)
    {
        var catalogChanged = false;

        foreach (var perm in SeedPermissions)
        {
            var normalized = perm.Code.Trim().ToLowerInvariant();
            var existing = await db.Permissions
                .FirstOrDefaultAsync(
                    p => p.DeletedAt == null && p.Code == normalized,
                    cancellationToken)
                .ConfigureAwait(false);

            if (existing is not null)
            {
                if (string.Equals(existing.Module, perm.Module, StringComparison.Ordinal))
                {
                    continue;
                }

                var synced = existing.SetModule(perm.Module);
                if (synced.IsFailure)
                {
                    throw new InvalidOperationException($"{synced.Error!.Code}: {synced.Error.Message}");
                }

                catalogChanged = true;
                continue;
            }

            var created = await sender
                .SendAsync<CreatePermissionCommand, CreatePermissionResponse>(
                    new CreatePermissionCommand(
                        perm.Code,
                        perm.Description,
                        perm.DisplayName,
                        perm.Module,
                        perm.Sort),
                    cancellationToken)
                .ConfigureAwait(false);
            if (!created.IsSuccess
                && !string.Equals(created.Error?.Code, "permission.code.duplicate", StringComparison.Ordinal))
            {
                ThrowIfFailed(created);
            }
        }

        if (catalogChanged)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    /// <summary>
    /// Tras ampliar el catálogo de permisos, los tenants creados antes del MVP no recibían los códigos nuevos.
    /// </summary>
    internal static async Task EnsureSystemRolesHaveAllActivePermissionsAsync(
        ISender sender,
        EcuNexoDbContext db,
        CancellationToken cancellationToken)
    {
        var tenantIds = await db.Tenants.AsNoTracking().Select(t => t.Id).ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        foreach (var tenantId in tenantIds)
        {
            var roleIds = await db.Roles
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(r => r.TenantId == tenantId && r.DeletedAt == null && r.IsSystem)
                .Select(r => r.Id)
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);

            foreach (var roleId in roleIds)
            {
                await GrantAllActivePermissionsToRoleAsync(sender, db, tenantId, roleId, cancellationToken)
                    .ConfigureAwait(false);
            }
        }
    }

    private static async Task GrantAllActivePermissionsToRoleAsync(
        ISender sender,
        EcuNexoDbContext db,
        Guid tenantId,
        Guid roleId,
        CancellationToken cancellationToken)
    {
        var tenant = await db.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken)
            .ConfigureAwait(false);
        if (tenant is null)
        {
            return;
        }

        var permissions = await db.Permissions
            .AsNoTracking()
            .Where(p => p.DeletedAt == null && p.Status == PermissionStatus.Active)
            .Select(p => new { p.Id, p.Code })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        foreach (var permission in permissions)
        {
            if (!ModulePermissionFilter.IsPermittedForModules(
                    permission.Code,
                    tenant.EnabledModuleCodes,
                    tenant.ModuleEntitlements))
            {
                continue;
            }

            await GrantSkipDuplicateAsync(sender, tenantId, roleId, permission.Id, cancellationToken)
                .ConfigureAwait(false);
        }
    }

    private static async Task GrantSkipDuplicateAsync(
        ISender sender,
        Guid tenantId,
        Guid roleId,
        Guid permissionId,
        CancellationToken cancellationToken)
    {
        var r = await sender
            .SendAsync<GrantRolePermissionCommand, GrantRolePermissionResponse>(
                new GrantRolePermissionCommand(tenantId, roleId, permissionId),
                cancellationToken)
            .ConfigureAwait(false);
        if (r.IsSuccess)
        {
            return;
        }

        if (string.Equals(r.Error?.Code, "role_permission.grant.duplicate", StringComparison.Ordinal)
            || string.Equals(r.Error?.Code, "role_permission.module.not_entitled", StringComparison.Ordinal))
        {
            return;
        }

        ThrowIfFailed(r);
    }

    private static async Task EnsureAdministrationDepartmentsAsync(
        ISender sender,
        EcuNexoDbContext db,
        CancellationToken cancellationToken)
    {
        var tenantIds = await db.Tenants.AsNoTracking()
            .Select(t => t.Id)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        foreach (var tenantId in tenantIds)
        {
            var aliases = await db.Departments
                .Where(d => d.TenantId == tenantId && d.DeletedAt == null)
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);
            aliases = aliases
                .Where(d => Department.IsAdministrationAlias(d.Name))
                .OrderBy(d => d.CreatedAt)
                .ToList();

            if (aliases.Count == 0)
            {
                var created = await sender
                    .SendAsync<CreateDepartmentCommand, CreateDepartmentResponse>(
                        new CreateDepartmentCommand(
                            tenantId,
                            Department.AdministrationName,
                            Department.AdministrationDescription),
                        cancellationToken)
                    .ConfigureAwait(false);
                if (created.IsFailure
                    && !string.Equals(created.Error?.Code, "department.name.duplicate", StringComparison.Ordinal))
                {
                    ThrowIfFailed(created);
                }

                continue;
            }

            var keeper = aliases[0];

            foreach (var duplicate in aliases.Skip(1))
            {
                var moved = await db.Users
                    .Where(u =>
                        u.TenantId == tenantId
                        && u.DeletedAt == null
                        && u.DepartmentId == duplicate.Id)
                    .ToListAsync(cancellationToken)
                    .ConfigureAwait(false);
                foreach (var user in moved)
                {
                    var synced = user.UpdateProfile(
                        user.Name,
                        Department.AdministrationName,
                        user.Phone,
                        user.JobTitle,
                        keeper.Id);
                    if (synced.IsFailure)
                    {
                        throw new InvalidOperationException($"{synced.Error!.Code}: {synced.Error.Message}");
                    }
                }

                var retired = duplicate.SoftDelete(DateTimeOffset.UtcNow);
                if (retired.IsFailure)
                {
                    throw new InvalidOperationException($"{retired.Error!.Code}: {retired.Error.Message}");
                }
            }

            // Primero baja la duplicada (ya se llama «Administración»). Luego renombra la primera.
            // Si se hace en el mismo UPDATE, el índice único tenant+nombre revienta.
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

            var renamed = keeper.Rename(
                Department.AdministrationName,
                keeper.Description ?? Department.AdministrationDescription);
            if (renamed.IsFailure)
            {
                throw new InvalidOperationException($"{renamed.Error!.Code}: {renamed.Error.Message}");
            }

            var unassigned = await db.Users
                .Where(u =>
                    u.TenantId == tenantId
                    && u.DeletedAt == null
                    && u.DepartmentId == null)
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);
            foreach (var user in unassigned)
            {
                var synced = user.UpdateProfile(
                    user.Name,
                    Department.AdministrationName,
                    user.Phone,
                    user.JobTitle,
                    keeper.Id);
                if (synced.IsFailure)
                {
                    throw new InvalidOperationException($"{synced.Error!.Code}: {synced.Error.Message}");
                }
            }

            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    private static void ThrowIfFailed<T>(Result<T> result)
    {
        if (result.IsSuccess)
        {
            return;
        }

        var err = result.Error!;
        throw new InvalidOperationException($"{err.Code}: {err.Message}");
    }
}
