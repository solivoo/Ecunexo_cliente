using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity;
using EcuNexo.Business.Tenancy.Authorization;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;
using EcuNexo.Core.Tenancy;
using FluentValidation;

namespace EcuNexo.Business.Tenancy.Commands.ProvisionSubscriptionCompany;

public sealed class ProvisionSubscriptionCompanyHandler
    : ICommandHandler<ProvisionSubscriptionCompanyCommand, ProvisionSubscriptionCompanyResponse>
{
    private readonly IValidator<ProvisionSubscriptionCompanyCommand> _validator;
    private readonly IIdGenerator _idGenerator;
    private readonly ISubscriptionAccountRepository _accounts;
    private readonly ITenantRepository _tenants;
    private readonly IUserRepository _users;
    private readonly IDepartmentRepository _departments;
    private readonly IRoleRepository _roles;
    private readonly IPermissionRepository _permissions;
    private readonly IRolePermissionRepository _rolePermissions;
    private readonly IUserRoleRepository _userRoles;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;
    private readonly DefaultWarehouseProvisioner _warehouseProvisioner;

    public ProvisionSubscriptionCompanyHandler(
        IValidator<ProvisionSubscriptionCompanyCommand> validator,
        IIdGenerator idGenerator,
        ISubscriptionAccountRepository accounts,
        ITenantRepository tenants,
        IUserRepository users,
        IDepartmentRepository departments,
        IRoleRepository roles,
        IPermissionRepository permissions,
        IRolePermissionRepository rolePermissions,
        IUserRoleRepository userRoles,
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher,
        DefaultWarehouseProvisioner warehouseProvisioner)
    {
        _validator = validator;
        _idGenerator = idGenerator;
        _accounts = accounts;
        _tenants = tenants;
        _users = users;
        _departments = departments;
        _roles = roles;
        _permissions = permissions;
        _rolePermissions = rolePermissions;
        _userRoles = userRoles;
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
        _warehouseProvisioner = warehouseProvisioner;
    }

    public async Task<Result<ProvisionSubscriptionCompanyResponse>> Handle(
        ProvisionSubscriptionCompanyCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<ProvisionSubscriptionCompanyResponse>(
                new Error("company.provision.validation", message, ErrorType.Validation));
        }

        var account = await _accounts.GetByIdAsync(command.SubscriptionAccountId, ct).ConfigureAwait(false);
        if (account is null)
        {
            return Result.Failure<ProvisionSubscriptionCompanyResponse>(
                new Error("subscription.not_found", "Titular de licencia no encontrado.", ErrorType.NotFound));
        }

        var used = await _tenants.CountBySubscriptionGroupIdAsync(account.SubscriptionGroupId, ct).ConfigureAwait(false);
        if (used >= account.SubscriptionMaxTenants)
        {
            return Result.Failure<ProvisionSubscriptionCompanyResponse>(
                new Error(
                    "company.provision.slots_exhausted",
                    "La licencia no tiene cupos disponibles para otra empresa.",
                    ErrorType.Conflict));
        }

        Email email;
        try
        {
            email = new Email(command.OwnerEmail);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<ProvisionSubscriptionCompanyResponse>(
                new Error("company.owner.email_invalid", ex.Message, ErrorType.Validation));
        }

        var tenantId = _idGenerator.NewId();
        var tenantCreated = Tenant.Create(
            tenantId,
            command.TenantName,
            account.ServicePlan,
            command.TimeZoneId,
            command.Locale,
            command.LogoUrl,
            command.PrimaryColorHex,
            subscriptionMaxTenants: account.SubscriptionMaxTenants,
            enabledModuleCodes: account.EnabledModuleCodes,
            moduleEntitlements: account.ModuleEntitlements,
            subscriptionGroupId: account.SubscriptionGroupId);

        if (tenantCreated.IsFailure)
        {
            return Result.Failure<ProvisionSubscriptionCompanyResponse>(tenantCreated.Error!);
        }

        var tenant = tenantCreated.Value!;

        if (await _users.EmailExistsAsync(tenantId, email, ct).ConfigureAwait(false))
        {
            return Result.Failure<ProvisionSubscriptionCompanyResponse>(
                new Error(
                    "company.owner.email_duplicate",
                    "Ya existe un usuario con este correo en la empresa.",
                    ErrorType.Conflict));
        }

        var roleId = _idGenerator.NewId();
        var roleCreated = Role.Create(
            roleId,
            tenantId,
            "Administrador",
            "Rol de sistema con todos los permisos del catálogo activo.",
            isSystem: true);
        if (roleCreated.IsFailure)
        {
            return Result.Failure<ProvisionSubscriptionCompanyResponse>(roleCreated.Error!);
        }

        var role = roleCreated.Value!;

        var departmentId = _idGenerator.NewId();
        var departmentCreated = Department.CreateAdministration(departmentId, tenantId);
        if (departmentCreated.IsFailure)
        {
            return Result.Failure<ProvisionSubscriptionCompanyResponse>(departmentCreated.Error!);
        }

        var department = departmentCreated.Value!;
        var userId = _idGenerator.NewId();
        var userCreated = User.Create(
            userId,
            tenantId,
            email,
            command.OwnerName,
            department.Name,
            command.OwnerPhone,
            command.OwnerJobTitle ?? "Administrador",
            department.Id);
        if (userCreated.IsFailure)
        {
            return Result.Failure<ProvisionSubscriptionCompanyResponse>(userCreated.Error!);
        }

        var user = userCreated.Value!;
        var passwordHash = _passwordHasher.Hash(command.OwnerPassword);
        var setPassword = user.SetPasswordHash(passwordHash);
        if (setPassword.IsFailure)
        {
            return Result.Failure<ProvisionSubscriptionCompanyResponse>(setPassword.Error!);
        }

        // Filtrar permisos por módulos — soporta tanto el modelo legacy (EnabledModuleCodes)
        // como el nuevo modelo de tiers (ModuleEntitlements).
        var effectiveModules = account.EnabledModuleCodes;
        var entitlements = account.ModuleEntitlements;
        var permissions = await _permissions.ListNonDeletedOrderedByCodeAsync(ct).ConfigureAwait(false);
        foreach (var permission in permissions)
        {
            if (permission.Status != PermissionStatus.Active)
            {
                continue;
            }

            if (!ModulePermissionFilter.IsPermittedForModules(permission.Code, effectiveModules, entitlements))
            {
                continue;
            }

            var link = RolePermission.Link(roleId, permission.Id);
            if (link.IsFailure)
            {
                return Result.Failure<ProvisionSubscriptionCompanyResponse>(link.Error!);
            }

            await _rolePermissions.AddAsync(link.Value!, ct).ConfigureAwait(false);
        }

        var assign = UserRole.Assign(tenantId, userId, roleId);
        if (assign.IsFailure)
        {
            return Result.Failure<ProvisionSubscriptionCompanyResponse>(assign.Error!);
        }

        await _tenants.AddAsync(tenant, ct).ConfigureAwait(false);
        await _roles.AddAsync(role, ct).ConfigureAwait(false);
        await _departments.AddAsync(department, ct).ConfigureAwait(false);
        await _users.AddAsync(user, ct).ConfigureAwait(false);
        await _userRoles.AddAsync(assign.Value!, ct).ConfigureAwait(false);
        await _warehouseProvisioner.StageDefaultsForTenantAsync(tenant, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new ProvisionSubscriptionCompanyResponse(tenantId, userId, roleId));
    }
}
