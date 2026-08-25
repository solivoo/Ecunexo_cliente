using EcuNexo.Business.Tenancy.Commands.ActivateLicense;

namespace EcuNexo.Api.Contracts.V1.Tenancy;

public sealed record ActivateLicenseRequest(string ActivationCode, string LicenseArtifact)
{
    public ActivateLicenseCommand ToCommand() => new(ActivationCode, LicenseArtifact);
}
