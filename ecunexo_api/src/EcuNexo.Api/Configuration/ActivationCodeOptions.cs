namespace EcuNexo.Api.Configuration;

public sealed class ActivationCodeOptions
{
    public const string SectionName = "ActivationCodes";

    /// <summary>Secreto de aplicación para derivar la huella del código (no es el código que escribe el cliente).</summary>
    public string Pepper { get; set; } = string.Empty;
}
