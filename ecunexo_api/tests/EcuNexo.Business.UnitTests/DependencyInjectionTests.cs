using EcuNexo.Business.Abstractions;
using Microsoft.Extensions.DependencyInjection;

namespace EcuNexo.Business.UnitTests;

public sealed class DependencyInjectionTests
{
    [Fact(DisplayName = "Todos los CommandHandlers y QueryHandlers de Business deben estar registrados en AddBusiness")]
    public void AddBusiness_RegistersAllHandlers()
    {
        var services = new ServiceCollection();
        services.AddBusiness();

        var businessAssembly = typeof(DependencyInjection).Assembly;
        var handlerTypes = businessAssembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract)
            .Where(t => t.GetInterfaces().Any(i =>
                i.IsGenericType && (
                    i.GetGenericTypeDefinition() == typeof(ICommandHandler<,>) ||
                    i.GetGenericTypeDefinition() == typeof(IQueryHandler<,>))))
            .ToList();

        var missingRegistrations = new List<string>();

        foreach (var handlerType in handlerTypes)
        {
            var isRegistered = services.Any(sd => sd.ImplementationType == handlerType);
            if (!isRegistered)
            {
                missingRegistrations.Add(handlerType.FullName ?? handlerType.Name);
            }
        }

        missingRegistrations.Should().BeEmpty(
            because: "todos los Handlers CQRS deben ser registrados en AddBusiness para evitar errores en runtime");
    }
}
