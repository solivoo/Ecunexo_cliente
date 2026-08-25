namespace EcuNexo.Business.Tenancy.Licensing;

/// <summary>Pepper de validación (dominio cliente). No permite emitir licencias en licensing_ecunexo.</summary>
public interface ILicenseValidationPepperProvider
{
    string ValidationPepper { get; }
}
