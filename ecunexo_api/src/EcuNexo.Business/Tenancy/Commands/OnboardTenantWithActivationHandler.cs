using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;
using EcuNexo.Core.Tenancy;
using FluentValidation;

namespace EcuNexo.Business.Tenancy.Commands;

public sealed class OnboardTenantWithActivationHandler
    : ICommandHandler<OnboardTenantWithActivationCommand, OnboardTenantWithActivationResponse>
{
    private readonly IValidator<OnboardTenantWithActivationCommand> _validator;
    private readonly IActivationCodePepperProvider _pepper;
    private readonly IActivationCodeRepository _activationCodes;
    private readonly IIdGenerator _idGenerator;
    private readonly ITenantRepository _tenants;
    private readonly IUserRepository _users;
    private readonly IDepartmentRepository _departments;
    private readonly IRoleRepository _roles;
    private readonly IPermissionRepository _permissions;
    private readonly IRolePermissionRepository _rolePermissions;
    private readonly IUserRoleRepository _userRoles;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;

    public OnboardTenantWithActivationHandler(
        IValidator<OnboardTenantWithActivationCommand> validator,
        IActivationCodePepperProvider pepper,
        IActivationCodeRepository activationCodes,
        IIdGenerator idGenerator,
        ITenantRepository tenants,
        IUserRepository users,
        IDepartmentRepository departments,
        IRoleRepository roles,
        IPermissionRepository permissions,
        IRolePermissionRepository rolePermissions,
        IUserRoleRepository userRoles,
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher)
    {
        _validator = validator;
        _pepper = pepper;
        _activationCodes = activationCodes;
        _idGenerator = idGenerator;
        _tenants = tenants;
        _users = users;
        _departments = departments;
        _roles = roles;
        _permissions = permissions;
        _rolePermissions = rolePermissions;
        _userRoles = userRoles;
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
    }

    public async Task<Result<OnboardTenantWithActivationResponse>> Handle(
        OnboardTenantWithActivationCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<OnboardTenantWithActivationResponse>(
                new Error("onboard.validation", message, ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(_pepper.Pepper))
        {
            return Result.Failure<OnboardTenantWithActivationResponse>(
                new Error(
                    "onboard.pepper.missing",
                    "La configuración de códigos de activación (pepper) no está definida.",
                    ErrorType.Unexpected));
        }

        var utcNow = DateTimeOffset.UtcNow;
        var normalizedCode = ActivationCodeHasher.Normalize(command.ActivationCode);
        string hash;
        try
        {
            hash = ActivationCodeHasher.ComputeHash(normalizedCode, _pepper.Pepper);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<OnboardTenantWithActivationResponse>(
                new Error("onboard.activation.hash", ex.Message, ErrorType.Validation));
        }

        var activation = await _activationCodes
            .GetActiveForProvisioningByHashAsync(hash, utcNow, ct)
            .ConfigureAwait(false);
        if (activation is null)
        {
            return Result.Failure<OnboardTenantWithActivationResponse>(
                new Error(
                    "onboard.activation.not_found",
                    "El código de activación no es válido o ha expirado.",
                    ErrorType.NotFound));
        }

        Email email;
        try
        {
            email = new Email(command.OwnerEmail);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<OnboardTenantWithActivationResponse>(
                new Error("onboard.owner.email_invalid", ex.Message, ErrorType.Validation));
        }

        ServicePlan plan;
        try
        {
            plan = new ServicePlan(activation.PlanLabel, activation.MaxUsers, activation.MaxWarehouses);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<OnboardTenantWithActivationResponse>(
                new Error("onboard.plan.invalid", ex.Message, ErrorType.Validation));
        }

        var tenantId = _idGenerator.NewId();
        var tenantCreated = Tenant.Create(
            tenantId,
            command.TenantName,
            plan,
            command.TimeZoneId,
            command.Locale,
            command.LogoUrl,
            command.PrimaryColorHex,
            subscriptionMaxTenants: activation.MaxTenants,
            enabledModuleCodes: activation.EnabledModuleCodes,
            subscriptionGroupId: activation.Id);
        if (tenantCreated.IsFailure)
        {
            return Result.Failure<OnboardTenantWithActivationResponse>(tenantCreated.Error!);
        }

        var tenant = tenantCreated.Value!;

        if (await _users.EmailExistsAsync(tenantId, email, ct).ConfigureAwait(false))
        {
            return Result.Failure<OnboardTenantWithActivationResponse>(
                new Error(
                    "onboard.owner.email_duplicate",
                    "Ya existe un usuario con este correo en el tenant.",
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
            return Result.Failure<OnboardTenantWithActivationResponse>(roleCreated.Error!);
        }

        var role = roleCreated.Value!;

        var departmentId = _idGenerator.NewId();
        var departmentCreated = Department.CreateAdministration(departmentId, tenantId);
        if (departmentCreated.IsFailure)
        {
            return Result.Failure<OnboardTenantWithActivationResponse>(departmentCreated.Error!);
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
            return Result.Failure<OnboardTenantWithActivationResponse>(userCreated.Error!);
        }

        var user = userCreated.Value!;
        var passwordHash = _passwordHasher.Hash(command.OwnerPassword);
        var setPassword = user.SetPasswordHash(passwordHash);
        if (setPassword.IsFailure)
        {
            return Result.Failure<OnboardTenantWithActivationResponse>(setPassword.Error!);
        }

        var permissions = await _permissions.ListNonDeletedOrderedByCodeAsync(ct).ConfigureAwait(false);
        foreach (var permission in permissions)
        {
            if (permission.Status != PermissionStatus.Active)
            {
                continue;
            }

            var link = RolePermission.Link(roleId, permission.Id);
            if (link.IsFailure)
            {
                return Result.Failure<OnboardTenantWithActivationResponse>(link.Error!);
            }

            await _rolePermissions.AddAsync(link.Value!, ct).ConfigureAwait(false);
        }

        var assign = UserRole.Assign(tenantId, userId, roleId);
        if (assign.IsFailure)
        {
            return Result.Failure<OnboardTenantWithActivationResponse>(assign.Error!);
        }

        var provisioning = activation.RecordProvisioning(tenantId, utcNow);
        if (provisioning.IsFailure)
        {
            return Result.Failure<OnboardTenantWithActivationResponse>(provisioning.Error!);
        }

        await _tenants.AddAsync(tenant, ct).ConfigureAwait(false);
        await _roles.AddAsync(role, ct).ConfigureAwait(false);
        await _departments.AddAsync(department, ct).ConfigureAwait(false);
        await _users.AddAsync(user, ct).ConfigureAwait(false);
        await _userRoles.AddAsync(assign.Value!, ct).ConfigureAwait(false);

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new OnboardTenantWithActivationResponse(tenantId, userId, roleId));
    }
}
