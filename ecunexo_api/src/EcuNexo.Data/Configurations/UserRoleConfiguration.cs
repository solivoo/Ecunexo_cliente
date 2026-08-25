using EcuNexo.Core.Identity;
using EcuNexo.Core.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
{
    public void Configure(EntityTypeBuilder<UserRole> builder)
    {
        builder.ToTable("user_roles", "identity");

        builder.HasKey(ur => new { ur.TenantId, ur.UserId, ur.RoleId });

        builder.Property(ur => ur.TenantId)
            .HasColumnType("uuid");

        builder.Property(ur => ur.UserId)
            .HasColumnType("uuid");

        builder.Property(ur => ur.RoleId)
            .HasColumnType("uuid");

        builder.HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(ur => ur.TenantId)
            .HasPrincipalKey(t => t.Id)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(ur => ur.User)
            .WithMany(u => u.UserRoles)
            .HasForeignKey(ur => ur.UserId)
            .HasPrincipalKey(u => u.Id)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(ur => ur.Role)
            .WithMany(r => r.UserRoles)
            .HasForeignKey(ur => ur.RoleId)
            .HasPrincipalKey(r => r.Id)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(ur => ur.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(ur => ur.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(ur => ur.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(ur => ur.UpdatedBy)
            .HasColumnType("uuid");
    }
}
