using EcuNexo.Core.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class PermissionConfiguration : IEntityTypeConfiguration<Permission>
{
    public void Configure(EntityTypeBuilder<Permission> builder)
    {
        builder.ToTable("permissions", "identity");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(p => p.Code)
            .HasMaxLength(Permission.CodeMaxLength)
            .IsRequired();

        builder.Property(p => p.DisplayName)
            .HasMaxLength(Permission.DisplayNameMaxLength);

        builder.Property(p => p.Module)
            .HasMaxLength(Permission.ModuleMaxLength);

        builder.Property(p => p.SortOrder)
            .IsRequired();

        builder.Property(p => p.Description)
            .HasMaxLength(Permission.DescriptionMaxLength);

        builder.Property(p => p.Status)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(p => p.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(p => p.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(p => p.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(p => p.UpdatedBy)
            .HasColumnType("uuid");

        builder.Property(p => p.DeletedAt)
            .HasColumnType("timestamptz");

        builder.Property(p => p.DeletedBy)
            .HasColumnType("uuid");

        builder.HasIndex(p => p.Code)
            .IsUnique()
            .HasFilter("\"deleted_at\" IS NULL");

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
