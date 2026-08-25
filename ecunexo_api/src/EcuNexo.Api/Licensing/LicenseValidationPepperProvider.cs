using EcuNexo.Api.Configuration;
using EcuNexo.Business.Tenancy.Licensing;
using Microsoft.Extensions.Options;

namespace EcuNexo.Api.Licensing;

public sealed class LicenseValidationPepperProvider(IOptions<LicenseValidationOptions> options)
    : ILicenseValidationPepperProvider
{
    public string ValidationPepper => options.Value.ValidationPepper;
}
