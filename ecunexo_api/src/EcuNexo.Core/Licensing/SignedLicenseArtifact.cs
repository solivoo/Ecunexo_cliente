namespace EcuNexo.Core.Licensing;

/// <summary>Envelope JSON entregado al cliente junto al código en claro.</summary>
public sealed record SignedLicenseArtifact(int Version, string PayloadBase64Url, string SignatureBase64Url)
{
    public const int CurrentVersion = 1;
}
