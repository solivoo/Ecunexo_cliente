namespace EcuNexo.Business.Tenancy;

/// <summary>
/// Secreto de aplicación para derivar la huella de códigos de activación (no es el código en sí).
/// </summary>
public interface IActivationCodePepperProvider
{
    string Pepper { get; }
}
