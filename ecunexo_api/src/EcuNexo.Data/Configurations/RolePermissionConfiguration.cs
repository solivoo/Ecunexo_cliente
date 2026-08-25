using EcuNexo.Core.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class RolePermissionConfiguration : IEntityTypeConfiguration<RolePermission>
{
    public void Configure(EntityTypeBuilder<RolePermission> builder)
    {
        builder.ToTable("role_permissions", "identity");

        builder.HasKey(rp => new { rp.RoleId, rp.PermissionId });

        builder.Property(rp => rp.RoleId)
            .HasColumnType("uuid");

        builder.Property(rp => rp.PermissionId)
            .HasColumnType("uuid");

        builder.HasOne(rp => rp.Role)
            .WithMany(r => r.RolePermissions)
            .HasForeignKey(rp => rp.RoleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(rp => rp.Permission)
            .WithMany(p => p.RolePermissions)
            .HasForeignKey(rp => rp.PermissionId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(rp => rp.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(rp => rp.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(rp => rp.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(rp => rp.UpdatedBy)
            .HasColumnType("uuid");
    }
}
