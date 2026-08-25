using EcuNexo.Api.Configuration;
using EcuNexo.Business.Tenancy;
using Microsoft.Extensions.Options;

namespace EcuNexo.Api.Tenancy;

public sealed class ActivationCodePepperProvider(IOptions<ActivationCodeOptions> options) : IActivationCodePepperProvider
{
    public string Pepper => options.Value.Pepper;
}
