using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;

namespace EcuNexo.Core.Tenancy;

/// <summary>
/// Representa un tenant en el sistema.
/// </summary>
public sealed class Tenant : AggregateRoot<Guid>, IAuditable
{
    public const int MaxNameLength = 200;
    public const int TimeZoneIdMaxLength = 64;
    public const int LocaleMaxLength = 16;
    public const int LogoUrlMaxLength = 500;
    public const int PrimaryColorHexMaxLength = 9;
    public const int TaxIdMaxLength = 13;
    public const int LegalNameMaxLength = 300;
    public const int CityMaxLength = 120;
    public const int EstablishmentCodeMaxLength = 20;
    public const int AddressMaxLength = 500;
    public const int ContactEmailMaxLength = 320;
    public const int ContactPhoneMaxLength = 30;
    public const int RideThankYouTextMaxLength = 1000;

    private Tenant()
    {
        Name = string.Empty;
        ServicePlan = null!;
        Users = [];
        Roles = [];
        Departments = [];
        SubscriptionMaxTenants = 1;
    }

    public string Name { get; private set; }

    /// <summary>Identificador IANA de zona horaria (p. ej. America/Guayaquil).</summary>
    public string? TimeZoneId { get; private set; }

    /// <summary>Etiqueta BCP 47 (p. ej. es-EC).</summary>
    public string? Locale { get; private set; }

    public string? LogoUrl { get; private set; }

    public Guid? LogoLightId { get; private set; }

    public Guid? LogoDarkId { get; private set; }

    /// <summary>Si es true, la UI muestra el nombre de la empresa en vez de un archivo.</summary>
    public bool PreferWordmark { get; private set; }

    /// <summary>Color de acento en formato #RGB o #RRGGBB.</summary>
    public string? PrimaryColorHex { get; private set; }

    /// <summary>RUC del contribuyente (13 dígitos).</summary>
    public string? TaxId { get; private set; }

    /// <summary>Razón social para SRI / facturación.</summary>
    public string? LegalName { get; private set; }

    public string? City { get; private set; }

    /// <summary>Código de establecimiento SRI (3 dígitos, p. ej. 001).</summary>
    public string? EstablishmentCode { get; private set; }

    public string? Address { get; private set; }

    /// <summary>Correo del emisor impreso en el RIDE.</summary>
    public string? ContactEmail { get; private set; }

    /// <summary>Teléfono del emisor impreso en el RIDE.</summary>
    public string? ContactPhone { get; private set; }

    /// <summary>Texto de agradecimiento al pie del RIDE.</summary>
    public string? RideThankYouText { get; private set; }

    public bool AccountingRequired { get; private set; }

    public RimpeKind RimpeKind { get; private set; }

    /// <summary>Compatibilidad: true si <see cref="RimpeKind"/> no es <see cref="Tenancy.RimpeKind.None"/>.</summary>
    public bool IsRimpe { get; private set; }

    /// <summary>
    /// Solo negocio popular: si es true, emite factura electrónica 01 (opción SRI) en vez de nota de venta.
    /// </summary>
    public bool PreferElectronicInvoice { get; private set; }

    public bool IsExporter { get; private set; }

    public bool IsLargeTaxpayer { get; private set; }

    public bool IsSpecialTaxpayer { get; private set; }

    public bool IsWithholdingAgent { get; private set; }

    public TenantStatus Status { get; private set; }
    public ServicePlan ServicePlan { get; private set; }

    /// <summary>
    /// Agrupa empresas provisionadas bajo la misma suscripción o código de activación.
    /// </summary>
    public Guid SubscriptionGroupId { get; private set; }

    /// <summary>
    /// Máximo de empresas (tenants) que la suscripción asociada permite al titular; persiste el cupo del código de activación.
    /// </summary>
    public int SubscriptionMaxTenants { get; private set; }

    /// <summary>
    /// Módulos de producto habilitados (legacy — migrar a <see cref="ModuleEntitlements"/>).
    /// null significa «todos» (compatibilidad con tenants creados antes del modelo de tiers).
    /// </summary>
    public List<string>? EnabledModuleCodes { get; private set; }

    /// <summary>
    /// Derechos de uso por módulo con tiers (Small/Medium/Big/Enterprise) y límites transaccionales.
    /// Reemplaza a <see cref="EnabledModuleCodes"/> para toda validación nueva.
    /// <c>null</c> o vacío = compatibilidad con tenants legacy sin tiers.
    /// </summary>
    public IReadOnlyList<ModuleEntitlement>? ModuleEntitlements { get; private set; }

    /// <summary>
    /// Determina si el tenant tiene contratado un módulo y cumple el tier mínimo requerido.
    /// </summary>
    public bool HasModuleWithMinTier(string moduleCode, ModuleTier? minTier = null)
    {
        if (ModuleEntitlements is null || ModuleEntitlements.Count == 0)
        {
            // Sin entitlements explícitos → todos los módulos conocidos (compatibilidad legacy)
            return TenantModuleCodes.IsKnown(moduleCode);
        }

        var entitlement = ModuleEntitlements
            .FirstOrDefault(e => string.Equals(e.ModuleCode, moduleCode, StringComparison.OrdinalIgnoreCase));

        if (entitlement is null)
        {
            return false;
        }

        return minTier is null || entitlement.Tier >= minTier.Value;
    }

    /// <summary>
    /// Resuelve el valor de un límite específico para un módulo contratado.
    /// Ejemplo: <c>GetModuleLimit("invoicing", ModuleTierCatalog.LimitMaxInvoicesPerMonth)</c>.
    /// </summary>
    public int? GetModuleLimit(string moduleCode, string limitKey)
    {
        if (ModuleEntitlements is null)
        {
            return null;
        }

        var entitlement = ModuleEntitlements
            .FirstOrDefault(e => string.Equals(e.ModuleCode, moduleCode, StringComparison.OrdinalIgnoreCase));

        return entitlement?.GetLimit(limitKey);
    }

    /// <summary>
    /// Obtiene el límite de usuarios desde el entitlement de identity.
    /// Caída a <see cref="ServicePlan.MaxUsers"/> si no hay entitlements definidos.
    /// </summary>
    public int ResolveMaxUsers() =>
        GetModuleLimit(TenantModuleCodes.Identity, ModuleTierCatalog.LimitMaxUsers)
        ?? ServicePlan.MaxUsers;

    /// <summary>
    /// Cupo de bodegas operativas: el mayor entre el cupo comercial del plan y el entitlement
    /// de warehousing. El tier Small del catálogo no puede recortar un plan con 2+ bodegas.
    /// </summary>
    public int ResolveMaxWarehouses()
    {
        var fromPlan = ServicePlan.MaxWarehouses;
        var fromEntitlement = GetModuleLimit(
            TenantModuleCodes.Warehousing,
            ModuleTierCatalog.LimitMaxWarehouses);
        if (fromEntitlement is null)
        {
            return fromPlan;
        }

        return Math.Max(fromPlan, fromEntitlement.Value);
    }

    /// <summary>
    /// Principal y En tránsito solo se provisionan si el cupo admite más de una bodega operativa.
    /// Con 0 o 1 no hay red de sucursales: el usuario crea (o no) su única ubicación.
    /// </summary>
    public bool AllowsMultipleWarehouses() => ResolveMaxWarehouses() > 1;

    /// <summary>
    /// Usuarios del tenant (navegación ORM; <see cref="User"/> es raíz de agregado independiente).
    /// </summary>
    public ICollection<User> Users { get; private set; }

    /// <summary>
    /// Roles definidos en el tenant (navegación ORM).
    /// </summary>
    public ICollection<Role> Roles { get; private set; }

    /// <summary>
    /// Departamentos del tenant (navegación ORM).
    /// </summary>
    public ICollection<Department> Departments { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? UpdatedAt { get; private set; }
    public Guid? CreatedBy { get; private set; }
    public Guid? UpdatedBy { get; private set; }

    /// <summary>
    /// Crea un nuevo tenant con perfil opcional para la UI (dashboard / branding).
    /// <paramref name="moduleEntitlements"/> es el parámetro preferido (modelo de tiers);
    /// <paramref name="enabledModuleCodes"/> se mantiene para compatibilidad legacy.
    /// </summary>
    public static Result<Tenant> Create(
        Guid id,
        string name,
        ServicePlan servicePlan,
        string? timeZoneId = null,
        string? locale = null,
        string? logoUrl = null,
        string? primaryColorHex = null,
        int subscriptionMaxTenants = 1,
        IReadOnlyList<string>? enabledModuleCodes = null,
        IReadOnlyList<ModuleEntitlement>? moduleEntitlements = null,
        Guid? subscriptionGroupId = null)
    {
        ArgumentNullException.ThrowIfNull(servicePlan);

        if (subscriptionMaxTenants < 1)
        {
            return Result.Failure<Tenant>(
                new Error(
                    "tenant.subscription_max_tenants.invalid",
                    "El cupo de empresas debe ser al menos 1.",
                    ErrorType.Validation));
        }

        List<string>? modules = null;
        if (enabledModuleCodes is not null)
        {
            if (enabledModuleCodes.Count == 0)
            {
                return Result.Failure<Tenant>(
                    new Error(
                        "tenant.enabled_modules.empty",
                        "Si se indican módulos, debe existir al menos uno.",
                        ErrorType.Validation));
            }

            modules = [];
            foreach (var m in enabledModuleCodes)
            {
                var t = m.Trim();
                if (t.Length == 0 || !TenantModuleCodes.IsKnown(t))
                {
                    return Result.Failure<Tenant>(
                        new Error(
                            "tenant.enabled_modules.unknown",
                            $"El módulo «{m}» no es reconocido.",
                            ErrorType.Validation));
                }

                if (!modules.Contains(t, StringComparer.OrdinalIgnoreCase))
                {
                    modules.Add(t.ToLowerInvariant());
                }
            }
        }

        // Validar moduleEntitlements (parámetro nuevo del modelo de tiers)
        IReadOnlyList<ModuleEntitlement>? entitlements = null;
        if (moduleEntitlements is not null)
        {
            if (moduleEntitlements.Count == 0)
            {
                return Result.Failure<Tenant>(
                    new Error(
                        "tenant.module_entitlements.empty",
                        "Si se indican entitlements, debe existir al menos uno.",
                        ErrorType.Validation));
            }

            var deduped = new List<ModuleEntitlement>(moduleEntitlements.Count);
            foreach (var e in moduleEntitlements)
            {
                if (!TenantModuleCodes.IsKnown(e.ModuleCode))
                {
                    return Result.Failure<Tenant>(
                        new Error(
                            "tenant.module_entitlements.unknown",
                            $"El módulo «{e.ModuleCode}» no es reconocido.",
                            ErrorType.Validation));
                }

                if (deduped.Any(d => string.Equals(d.ModuleCode, e.ModuleCode, StringComparison.OrdinalIgnoreCase)))
                {
                    continue;
                }

                deduped.Add(e);
            }

            entitlements = deduped;
        }

        if (string.IsNullOrWhiteSpace(name) || name.Length > MaxNameLength)
        {
            return Result.Failure<Tenant>(
                new Error(
                    "tenant.name_invalid",
                    $"El nombre del tenant no puede estar vacío o exceder {MaxNameLength} caracteres",
                    ErrorType.Validation));
        }

        var trimmed = name.Trim();
        if (trimmed.Length > MaxNameLength)
        {
            return Result.Failure<Tenant>(
                new Error(
                    "tenant.name_invalid",
                    $"El nombre del tenant no puede exceder {MaxNameLength} caracteres",
                    ErrorType.Validation));
        }

        var ui = BuildUiProfile(timeZoneId, locale, logoUrl, primaryColorHex);
        if (ui.IsFailure)
        {
            return Result.Failure<Tenant>(ui.Error!);
        }

        var s = ui.Value!;
        var groupId = subscriptionGroupId ?? id;
        if (groupId == Guid.Empty)
        {
            return Result.Failure<Tenant>(
                new Error(
                    "tenant.subscription_group.invalid",
                    "El grupo de suscripción no es válido.",
                    ErrorType.Validation));
        }

        var tenant = new Tenant
        {
            Id = id,
            Name = trimmed,
            Status = TenantStatus.Trial,
            ServicePlan = servicePlan,
            SubscriptionGroupId = groupId,
            SubscriptionMaxTenants = subscriptionMaxTenants,
            EnabledModuleCodes = modules,
            ModuleEntitlements = entitlements,
            TimeZoneId = s.TimeZoneId,
            Locale = s.Locale,
            LogoUrl = s.LogoUrl,
            PrimaryColorHex = s.PrimaryColorHex,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        return tenant;
    }

    private sealed record UiProfileSnapshot(
        string? TimeZoneId,
        string? Locale,
        string? LogoUrl,
        string? PrimaryColorHex);

    private static Result<UiProfileSnapshot> BuildUiProfile(
        string? timeZoneId,
        string? locale,
        string? logoUrl,
        string? primaryColorHex)
    {
        string? tz = null;
        if (timeZoneId is not null)
        {
            var t = timeZoneId.Trim();
            if (t.Length > TimeZoneIdMaxLength)
            {
                return Result.Failure<UiProfileSnapshot>(
                    new Error(
                        "tenant.time_zone.length",
                        $"La zona horaria no puede superar {TimeZoneIdMaxLength} caracteres.",
                        ErrorType.Validation));
            }

            tz = t.Length == 0 ? null : t;
        }

        string? loc = null;
        if (locale is not null)
        {
            var t = locale.Trim();
            if (t.Length > LocaleMaxLength)
            {
                return Result.Failure<UiProfileSnapshot>(
                    new Error(
                        "tenant.locale.length",
                        $"El locale no puede superar {LocaleMaxLength} caracteres.",
                        ErrorType.Validation));
            }

            loc = t.Length == 0 ? null : t;
        }

        string? logo = null;
        if (logoUrl is not null)
        {
            var t = logoUrl.Trim();
            if (t.Length > LogoUrlMaxLength)
            {
                return Result.Failure<UiProfileSnapshot>(
                    new Error(
                        "tenant.logo_url.length",
                        $"La URL del logo no puede superar {LogoUrlMaxLength} caracteres.",
                        ErrorType.Validation));
            }

            logo = t.Length == 0 ? null : t;
        }

        string? color = null;
        if (primaryColorHex is not null)
        {
            var t = primaryColorHex.Trim();
            if (t.Length == 0)
            {
                color = null;
            }
            else if (t.Length > PrimaryColorHexMaxLength)
            {
                return Result.Failure<UiProfileSnapshot>(
                    new Error("tenant.color.length", "El color hexadecimal no es válido.", ErrorType.Validation));
            }
            else if (t[0] != '#' || (t.Length != 4 && t.Length != 7))
            {
                return Result.Failure<UiProfileSnapshot>(
                    new Error("tenant.color.format", "Use #RGB o #RRGGBB en hex (ej. #2563eb).", ErrorType.Validation));
            }
            else
            {
                for (var i = 1; i < t.Length; i++)
                {
                    if (!Uri.IsHexDigit(t[i]))
                    {
                        return Result.Failure<UiProfileSnapshot>(
                            new Error(
                                "tenant.color.format",
                                "Use #RGB o #RRGGBB en hex (ej. #2563eb).",
                                ErrorType.Validation));
                    }
                }

                color = t;
            }
        }

        return new UiProfileSnapshot(tz, loc, logo, color);
    }

    /// <summary>
    /// Cambia el plan de servicio del tenant.
    /// </summary>
    /// <param name="newPlan">El nuevo plan de servicio.</param>
    /// <returns>El tenant actualizado.</returns>
    public Result<Tenant> ChangeServicePlan(ServicePlan newPlan)
    {
        ArgumentNullException.ThrowIfNull(newPlan);

        if(Status is not TenantStatus.Active and not TenantStatus.Trial){
            return Result.Failure<Tenant>(
                new Error(
                    "tenant.status_invalid", 
                    "El tenant no puede ser actualizado porque no está en estado activo o trial", 
                    ErrorType.Validation
                )
            );

        }

        ServicePlan = newPlan;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success(this);
    }

    /// <summary>
    /// Replica el cupo y los módulos de la licencia del titular en esta empresa.
    /// </summary>
    public Result ApplySubscriptionLicense(
        ServicePlan servicePlan,
        int subscriptionMaxTenants,
        IReadOnlyList<string>? enabledModuleCodes,
        IReadOnlyList<ModuleEntitlement>? moduleEntitlements)
    {
        ArgumentNullException.ThrowIfNull(servicePlan);

        if (Status is TenantStatus.Cancelled)
        {
            return Result.Failure(
                new Error(
                    "tenant.status_invalid",
                    "No se puede actualizar una empresa dada de baja.",
                    ErrorType.Validation));
        }

        if (subscriptionMaxTenants < 1)
        {
            return Result.Failure(
                new Error(
                    "tenant.subscription_max_tenants.invalid",
                    "El cupo de empresas debe ser al menos 1.",
                    ErrorType.Validation));
        }

        List<string>? modules = null;
        if (enabledModuleCodes is not null)
        {
            modules = [];
            foreach (var module in enabledModuleCodes)
            {
                var normalized = module.Trim().ToLowerInvariant();
                if (normalized.Length == 0 || !TenantModuleCodes.IsKnown(normalized))
                {
                    return Result.Failure(
                        new Error(
                            "tenant.enabled_modules.unknown",
                            $"El módulo «{module}» no es reconocido.",
                            ErrorType.Validation));
                }

                if (!modules.Contains(normalized, StringComparer.Ordinal))
                {
                    modules.Add(normalized);
                }
            }
        }

        ServicePlan = servicePlan;
        SubscriptionMaxTenants = subscriptionMaxTenants;
        EnabledModuleCodes = modules;
        ModuleEntitlements = moduleEntitlements;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }

    public Result SetBrandMarks(Guid? lightLogoId, Guid? darkLogoId, bool preferWordmark)
    {
        if (Status is TenantStatus.Cancelled)
        {
            return Result.Failure(
                new Error(
                    "tenant.status_invalid",
                    "No se puede editar una empresa dada de baja.",
                    ErrorType.Validation));
        }

        LogoLightId = lightLogoId;
        LogoDarkId = darkLogoId;
        PreferWordmark = preferWordmark;
        var selected = lightLogoId ?? darkLogoId;
        LogoUrl = preferWordmark || selected is null
            ? null
            : $"/api/v1/tenants/{Id}/brand-logos/{selected.Value}/file";
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }

    /// <summary>
    /// Actualiza identidad visible, branding y ficha legal de la empresa (titular / ficha de empresa).
    /// </summary>
    public Result UpdateCompanyProfile(
        string name,
        string? timeZoneId,
        string? locale,
        string? logoUrl,
        string? primaryColorHex,
        string? taxId,
        string? legalName,
        string? city,
        string? establishmentCode,
        string? address,
        bool accountingRequired,
        RimpeKind rimpeKind,
        bool preferElectronicInvoice,
        bool isExporter,
        bool isLargeTaxpayer,
        bool isSpecialTaxpayer,
        bool isWithholdingAgent,
        string? contactEmail = null,
        string? contactPhone = null,
        string? rideThankYouText = null)
    {
        if (Status is TenantStatus.Cancelled)
        {
            return Result.Failure(
                new Error(
                    "tenant.status_invalid",
                    "No se puede editar una empresa dada de baja.",
                    ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(name) || name.Trim().Length > MaxNameLength)
        {
            return Result.Failure(
                new Error(
                    "tenant.name_invalid",
                    $"El nombre de la empresa no puede estar vacío o exceder {MaxNameLength} caracteres.",
                    ErrorType.Validation));
        }

        var ui = BuildUiProfile(timeZoneId, locale, logoUrl, primaryColorHex);
        if (ui.IsFailure)
        {
            return Result.Failure(ui.Error!);
        }

        var legal = UpdateSriLegalProfile(
            taxId,
            legalName,
            city,
            establishmentCode,
            address,
            accountingRequired,
            rimpeKind,
            preferElectronicInvoice,
            isExporter,
            isLargeTaxpayer,
            isSpecialTaxpayer,
            isWithholdingAgent);
        if (legal.IsFailure)
        {
            return legal;
        }

        var ride = ApplyRideContact(contactEmail, contactPhone, rideThankYouText);
        if (ride.IsFailure)
        {
            return ride;
        }

        var snapshot = ui.Value!;
        Name = name.Trim();
        TimeZoneId = snapshot.TimeZoneId;
        Locale = snapshot.Locale;
        LogoUrl = snapshot.LogoUrl;
        PrimaryColorHex = snapshot.PrimaryColorHex;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }

    private Result ApplyRideContact(string? contactEmail, string? contactPhone, string? rideThankYouText)
    {
        var email = TrimOrNull(contactEmail);
        if (email is not null && (email.Length > ContactEmailMaxLength || !email.Contains('@')))
        {
            return Result.Failure(
                new Error(
                    "tenant.contact_email.format",
                    $"El correo de contacto no es válido o supera {ContactEmailMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        var phone = TrimOrNull(contactPhone);
        if (phone is not null && phone.Length > ContactPhoneMaxLength)
        {
            return Result.Failure(
                new Error(
                    "tenant.contact_phone.length",
                    $"El teléfono de contacto no puede superar {ContactPhoneMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        var thankYou = TrimOrNull(rideThankYouText);
        if (thankYou is not null && thankYou.Length > RideThankYouTextMaxLength)
        {
            return Result.Failure(
                new Error(
                    "tenant.ride_thank_you.length",
                    $"El agradecimiento del RIDE no puede superar {RideThankYouTextMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        ContactEmail = email;
        ContactPhone = phone;
        RideThankYouText = thankYou;
        return Result.Success();
    }

    /// <summary>
    /// Actualiza la identidad tributaria / SRI de la empresa (sin certificado ni secretos).
    /// </summary>
    public Result UpdateSriLegalProfile(
        string? taxId,
        string? legalName,
        string? city,
        string? establishmentCode,
        string? address,
        bool accountingRequired,
        RimpeKind rimpeKind,
        bool preferElectronicInvoice,
        bool isExporter,
        bool isLargeTaxpayer,
        bool isSpecialTaxpayer,
        bool isWithholdingAgent)
    {
        var tax = TrimOrNull(taxId);
        if (tax is not null && (tax.Length != TaxIdMaxLength || !tax.All(char.IsDigit)))
        {
            return Result.Failure(
                new Error(
                    "tenant.tax_id.format",
                    "El RUC debe tener exactamente 13 dígitos numéricos.",
                    ErrorType.Validation));
        }

        var legal = TrimOrNull(legalName);
        if (legal is not null && legal.Length > LegalNameMaxLength)
        {
            return Result.Failure(
                new Error(
                    "tenant.legal_name.length",
                    $"La razón social no puede superar {LegalNameMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        var cityNorm = TrimOrNull(city);
        if (cityNorm is not null && cityNorm.Length > CityMaxLength)
        {
            return Result.Failure(
                new Error(
                    "tenant.city.length",
                    $"La ciudad no puede superar {CityMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        var estab = TrimOrNull(establishmentCode);
        if (estab is not null && estab.Length > EstablishmentCodeMaxLength)
        {
            return Result.Failure(
                new Error(
                    "tenant.establishment.length",
                    $"El establecimiento no puede superar {EstablishmentCodeMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        var addr = TrimOrNull(address);
        if (addr is not null && addr.Length > AddressMaxLength)
        {
            return Result.Failure(
                new Error(
                    "tenant.address.length",
                    $"La dirección no puede superar {AddressMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        var combination = SalesDocumentPolicy.ValidateLegalCombination(
            rimpeKind,
            tax,
            isLargeTaxpayer,
            isSpecialTaxpayer,
            isWithholdingAgent);
        if (combination.IsFailure)
        {
            return combination;
        }

        TaxId = tax;
        LegalName = legal;
        City = cityNorm;
        EstablishmentCode = estab;
        Address = addr;
        AccountingRequired = accountingRequired;
        RimpeKind = rimpeKind;
        IsRimpe = rimpeKind != RimpeKind.None;
        PreferElectronicInvoice = rimpeKind == RimpeKind.PopularBusiness && preferElectronicInvoice;
        IsExporter = isExporter;
        IsLargeTaxpayer = isLargeTaxpayer;
        IsSpecialTaxpayer = isSpecialTaxpayer;
        IsWithholdingAgent = isWithholdingAgent;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }

    public SalesDocumentKind ResolveSalesDocumentKind() =>
        SalesDocumentPolicy.Resolve(RimpeKind, PreferElectronicInvoice);

    private static string? TrimOrNull(string? value)
    {
        if (value is null)
        {
            return null;
        }

        var t = value.Trim();
        return t.Length == 0 ? null : t;
    }

    /// <summary>Borrado lógico: cancelada, deja de contar en el cupo de la licencia.</summary>
    public Result Cancel()
    {
        if (Status is TenantStatus.Cancelled)
        {
            return Result.Success();
        }

        Status = TenantStatus.Cancelled;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }
}

/// <summary>
/// Unit type para representar la ausencia de valor.
/// </summary>
public readonly struct Unit
{
    public static Unit Value => default;
}

