using EcuNexo.Core.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class ActivationCodeConfiguration : IEntityTypeConfiguration<ActivationCode>
{
    public void Configure(EntityTypeBuilder<ActivationCode> builder)
    {
        builder.ToTable("activation_codes", "tenancy");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(x => x.CodeHash)
            .HasMaxLength(ActivationCode.CodeHashMaxLength)
            .IsRequired();

        builder.HasIndex(x => x.CodeHash)
            .IsUnique();

        builder.Property(x => x.PlanLabel)
            .HasMaxLength(ActivationCode.PlanLabelMaxLength)
            .IsRequired();

        builder.Property(x => x.MaxTenants).IsRequired();

        builder.Property(x => x.MaxUsers).IsRequired();

        builder.Property(x => x.MaxWarehouses).IsRequired();

        builder.Property(x => x.EnabledModuleCodes)
            .HasColumnType("jsonb")
            .IsRequired();

        builder.Property(x => x.ExpiresAtUtc)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(x => x.ProvisioningSlotsRemaining).IsRequired();

        builder.Property(x => x.CreatedAtUtc)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(x => x.ConsumedAtUtc)
            .HasColumnType("timestamptz");

        builder.Property(x => x.ConsumedByTenantId)
            .HasColumnType("uuid");

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
