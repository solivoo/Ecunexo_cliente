namespace EcuNexo.Core.Tenancy;

public sealed class ServicePlan : IEquatable<ServicePlan>
{
    public const int MaxNameLength = 120;

    /// <summary>EF Core materialization — do not use from application code.</summary>
    private ServicePlan()
    {
        Name = string.Empty;
        MaxUsers = 0;
        MaxWarehouses = 0;
    }

    public string Name { get; }
    public int MaxUsers { get; }
    public int MaxWarehouses { get; }

    public ServicePlan(string name, int maxUsers, int maxWarehouses)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        if(name.Length > MaxNameLength) 
        {
            throw new ArgumentException($"El nombre del plan de servicio no puede exceder {MaxNameLength} caracteres", nameof(name));
        }
        ArgumentOutOfRangeException.ThrowIfNegative(maxUsers);
        ArgumentOutOfRangeException.ThrowIfNegative(maxWarehouses);

        Name = name;
        MaxUsers = maxUsers;
        MaxWarehouses = maxWarehouses;
    }

    public bool Equals(ServicePlan? other) => 
        other is not null
        && string.Equals(Name, other.Name, StringComparison.OrdinalIgnoreCase)
        && MaxUsers == other.MaxUsers
        && MaxWarehouses == other.MaxWarehouses;

    public override bool Equals(object? obj) => obj is ServicePlan other && Equals(other);
    public override int GetHashCode() => HashCode.Combine(Name, MaxUsers, MaxWarehouses);
}