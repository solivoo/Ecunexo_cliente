using EcuNexo.Core.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class PolicyConfiguration : IEntityTypeConfiguration<Policy>
{
    public void Configure(EntityTypeBuilder<Policy> builder)
    {
        builder.ToTable("policies", "identity");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(p => p.PermissionId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(p => p.Permission)
            .WithMany(pm => pm.Policies)
            .HasForeignKey(p => p.PermissionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(p => p.Effect)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(p => p.Condition)
            .HasColumnType("text");

        builder.Property(p => p.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(p => p.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(p => p.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(p => p.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasIndex(p => p.PermissionId);

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
