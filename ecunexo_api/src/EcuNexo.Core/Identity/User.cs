using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.Identity;

/// <summary>
/// Persona que accede al sistema — pertenece a un <see cref="Tenancy.Tenant"/> vía <see cref="TenantId"/>.
/// </summary>
public sealed class User : AggregateRoot<Guid>, ITenantEntity, IAuditable, ISoftDeletable
{
    public const int NameMaxLength = 200;
    public const int DepartmentMaxLength = 120;
    public const int PhoneMaxLength = 40;
    public const int JobTitleMaxLength = 120;

    /// <summary>Longitud máxima del hash persistido (PBKDF2 / Identity).</summary>
    public const int PasswordHashMaxLength = 500;

    private User()
    {
        Email = null!;
        Name = string.Empty;
        UserRoles = [];
    }

    public Guid TenantId { get; private set; }

    /// <summary>Tenant propietario — rellena EF al incluir la navegación; no usar como fuente de verdad en reglas de dominio.</summary>
    public Tenant? Tenant { get; private set; }

    public Email Email { get; private set; }

    public string Name { get; private set; }

    /// <summary>Nombre denormalizado del departamento (catálogo o texto legado).</summary>
    public string? Department { get; private set; }

    /// <summary>FK al catálogo <see cref="Department"/>; null si no hay asignación o solo texto legado.</summary>
    public Guid? DepartmentId { get; private set; }

    public Department? OrgDepartment { get; private set; }

    public string? Phone { get; private set; }

    public string? JobTitle { get; private set; }

    /// <summary>Hash de contraseña (nunca texto plano). Null si el usuario aún no definió credencial local.</summary>
    public string? PasswordHash { get; private set; }

    /// <summary>Último inicio de sesión conocido (rellenar desde capa de aplicación / auth).</summary>
    public DateTimeOffset? LastLoginAt { get; private set; }

    /// <summary>Si es true, el usuario no puede iniciar sesión ni entrar a la empresa.</summary>
    public bool IsDisabled { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public DateTimeOffset? DeletedAt { get; private set; }

    public Guid? DeletedBy { get; private set; }

    /// <summary>Roles asignados (tabla de unión <see cref="UserRole"/>).</summary>
    public ICollection<UserRole> UserRoles { get; private set; }

    /// <summary>
    /// Crea un usuario en el tenant indicado. No valida que el tenant exista en BD — responsabilidad del caso de uso / repositorio.
    /// </summary>
    public static Result<User> Create(
        Guid id,
        Guid tenantId,
        Email email,
        string name,
        string? department,
        string? phone = null,
        string? jobTitle = null,
        Guid? departmentId = null)
    {
        ArgumentNullException.ThrowIfNull(email);

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<User>(
                new Error("user.tenant_id.invalid", "El tenant es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure<User>(
                new Error("user.name.required", "El nombre es obligatorio.", ErrorType.Validation));
        }

        var trimmedName = name.Trim();
        if (trimmedName.Length > NameMaxLength)
        {
            return Result.Failure<User>(
                new Error(
                    "user.name.length",
                    $"El nombre no puede superar {NameMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        string? dept = null;
        if (department is not null)
        {
            var d = department.Trim();
            if (d.Length > DepartmentMaxLength)
            {
                return Result.Failure<User>(
                    new Error(
                        "user.department.length",
                        $"El departamento no puede superar {DepartmentMaxLength} caracteres.",
                        ErrorType.Validation));
            }

            dept = d.Length == 0 ? null : d;
        }

        string? phoneNorm = null;
        if (phone is not null)
        {
            var p = phone.Trim();
            if (p.Length > PhoneMaxLength)
            {
                return Result.Failure<User>(
                    new Error(
                        "user.phone.length",
                        $"El teléfono no puede superar {PhoneMaxLength} caracteres.",
                        ErrorType.Validation));
            }

            phoneNorm = p.Length == 0 ? null : p;
        }

        string? title = null;
        if (jobTitle is not null)
        {
            var j = jobTitle.Trim();
            if (j.Length > JobTitleMaxLength)
            {
                return Result.Failure<User>(
                    new Error(
                        "user.job_title.length",
                        $"El puesto no puede superar {JobTitleMaxLength} caracteres.",
                        ErrorType.Validation));
            }

            title = j.Length == 0 ? null : j;
        }

        var user = new User
        {
            Id = id,
            TenantId = tenantId,
            Email = email,
            Name = trimmedName,
            Department = dept,
            DepartmentId = departmentId,
            Phone = phoneNorm,
            JobTitle = title,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        return user;
    }

    /// <summary>Asigna el hash de contraseña ya calculado en la capa de aplicación.</summary>
    public Result SetPasswordHash(string passwordHash)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(passwordHash);
        if (passwordHash.Length > PasswordHashMaxLength)
        {
            return Result.Failure(
                new Error(
                    "user.password_hash.length",
                    $"El hash de contraseña no puede superar {PasswordHashMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        PasswordHash = passwordHash;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }

    /// <summary>Registra un acceso al sistema (p. ej. tras validar JWT).</summary>
    public void TouchLastLogin(DateTimeOffset utcNow)
    {
        LastLoginAt = utcNow;
        UpdatedAt = utcNow;
    }

    /// <summary>Actualiza datos de perfil (no cambia correo ni contraseña).</summary>
    public Result UpdateProfile(
        string name,
        string? department,
        string? phone,
        string? jobTitle,
        Guid? departmentId = null)
    {
        if (DeletedAt is not null)
        {
            return Result.Failure(
                new Error("user.deleted", "El usuario está eliminado.", ErrorType.Conflict));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure(
                new Error("user.name.required", "El nombre es obligatorio.", ErrorType.Validation));
        }

        var trimmedName = name.Trim();
        if (trimmedName.Length > NameMaxLength)
        {
            return Result.Failure(
                new Error(
                    "user.name.length",
                    $"El nombre no puede superar {NameMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        string? dept;
        if (department is not null)
        {
            var d = department.Trim();
            if (d.Length > DepartmentMaxLength)
            {
                return Result.Failure(
                    new Error(
                        "user.department.length",
                        $"El departamento no puede superar {DepartmentMaxLength} caracteres.",
                        ErrorType.Validation));
            }

            dept = d.Length == 0 ? null : d;
        }
        else
        {
            dept = null;
        }

        string? phoneNorm;
        if (phone is not null)
        {
            var p = phone.Trim();
            if (p.Length > PhoneMaxLength)
            {
                return Result.Failure(
                    new Error(
                        "user.phone.length",
                        $"El teléfono no puede superar {PhoneMaxLength} caracteres.",
                        ErrorType.Validation));
            }

            phoneNorm = p.Length == 0 ? null : p;
        }
        else
        {
            phoneNorm = null;
        }

        string? title;
        if (jobTitle is not null)
        {
            var j = jobTitle.Trim();
            if (j.Length > JobTitleMaxLength)
            {
                return Result.Failure(
                    new Error(
                        "user.job_title.length",
                        $"El puesto no puede superar {JobTitleMaxLength} caracteres.",
                        ErrorType.Validation));
            }

            title = j.Length == 0 ? null : j;
        }
        else
        {
            title = null;
        }

        Name = trimmedName;
        Department = dept;
        DepartmentId = departmentId;
        Phone = phoneNorm;
        JobTitle = title;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }

    /// <summary>Cambia el correo de acceso. El caller valida unicidad en el tenant.</summary>
    public Result ChangeEmail(Email email)
    {
        ArgumentNullException.ThrowIfNull(email);

        if (DeletedAt is not null)
        {
            return Result.Failure(
                new Error("user.deleted", "El usuario está eliminado.", ErrorType.Conflict));
        }

        if (Email.Equals(email))
        {
            return Result.Success();
        }

        Email = email;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }

    /// <summary>Copia el nombre del catálogo cuando se corrige un departamento.</summary>
    public Result SyncOrgDepartmentLabel(string name)
    {
        if (DeletedAt is not null)
        {
            return Result.Failure(
                new Error("user.deleted", "El usuario está eliminado.", ErrorType.Conflict));
        }

        if (string.IsNullOrWhiteSpace(name) || name.Trim().Length > DepartmentMaxLength)
        {
            return Result.Failure(
                new Error(
                    "user.department.length",
                    $"El departamento no puede superar {DepartmentMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        Department = name.Trim();
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }

    public Result Disable()
    {
        if (DeletedAt is not null)
        {
            return Result.Failure(
                new Error("user.deleted", "El usuario está eliminado.", ErrorType.Conflict));
        }

        if (IsDisabled)
        {
            return Result.Success();
        }

        IsDisabled = true;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }

    public Result Enable()
    {
        if (DeletedAt is not null)
        {
            return Result.Failure(
                new Error("user.deleted", "El usuario está eliminado.", ErrorType.Conflict));
        }

        if (!IsDisabled)
        {
            return Result.Success();
        }

        IsDisabled = false;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }

    /// <summary>Baja lógica: deja de listarse y no puede autenticarse.</summary>
    public Result SoftDelete(DateTimeOffset utcNow, Guid? deletedBy = null)
    {
        if (DeletedAt is not null)
        {
            return Result.Success();
        }

        DeletedAt = utcNow;
        DeletedBy = deletedBy;
        UpdatedAt = utcNow;
        return Result.Success();
    }
}
