using EcuNexo.Core.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        builder.ToTable("roles", "identity");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(r => r.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(r => r.Tenant)
            .WithMany(t => t.Roles)
            .HasForeignKey(r => r.TenantId)
            .HasPrincipalKey(t => t.Id)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(r => r.Name)
            .HasMaxLength(Role.NameMaxLength)
            .IsRequired();

        builder.Property(r => r.Description)
            .HasMaxLength(Role.DescriptionMaxLength);

        builder.Property(r => r.IsSystem)
            .IsRequired();

        builder.Property(r => r.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(r => r.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(r => r.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(r => r.UpdatedBy)
            .HasColumnType("uuid");

        builder.Property(r => r.DeletedAt)
            .HasColumnType("timestamptz");

        builder.Property(r => r.DeletedBy)
            .HasColumnType("uuid");

        builder.HasIndex(r => new { r.TenantId, r.Name })
            .IsUnique()
            .HasFilter("\"deleted_at\" IS NULL");

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
