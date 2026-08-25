using EcuNexo.Core.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class ModuleUsageCounterConfiguration : IEntityTypeConfiguration<ModuleUsageCounter>
{
    public void Configure(EntityTypeBuilder<ModuleUsageCounter> builder)
    {
        builder.ToTable("module_usage_counters", "tenancy");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(x => x.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(x => x.ModuleCode)
            .HasMaxLength(ModuleUsageCounter.LimitKeyMaxLength)
            .IsRequired();

        builder.Property(x => x.LimitKey)
            .HasMaxLength(ModuleUsageCounter.LimitKeyMaxLength)
            .IsRequired();

        builder.Property(x => x.CurrentValue)
            .IsRequired();

        builder.Property(x => x.PeriodStartUtc)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(x => x.PeriodEndUtc)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(x => x.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(x => x.UpdatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.HasIndex(x => new { x.TenantId, x.ModuleCode, x.LimitKey })
            .IsUnique()
            .HasDatabaseName("ix_module_usage_counters_tenant_module_limit");
    }
}
