namespace EcuNexo.Core.Licensing;

/// <summary>
/// Credenciales del titular de licencia en el paquete firmado (sin datos de empresa tenant).
/// </summary>
public sealed record LicenseArtifactProvisioning(
    string OwnerEmail,
    string OwnerName,
    string OwnerPassword,
    string? OwnerDepartment = null,
    string? OwnerPhone = null,
    string? OwnerJobTitle = null);
