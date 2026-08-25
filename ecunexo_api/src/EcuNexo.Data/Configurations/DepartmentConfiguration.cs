using EcuNexo.Core.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class DepartmentConfiguration : IEntityTypeConfiguration<Department>
{
    public void Configure(EntityTypeBuilder<Department> builder)
    {
        builder.ToTable("departments", "identity");

        builder.HasKey(d => d.Id);

        builder.Property(d => d.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(d => d.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(d => d.Tenant)
            .WithMany(t => t.Departments)
            .HasForeignKey(d => d.TenantId)
            .HasPrincipalKey(t => t.Id)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(d => d.Name)
            .HasMaxLength(Department.NameMaxLength)
            .IsRequired();

        builder.Property(d => d.Description)
            .HasMaxLength(Department.DescriptionMaxLength);

        builder.Property(d => d.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(d => d.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(d => d.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(d => d.UpdatedBy)
            .HasColumnType("uuid");

        builder.Property(d => d.DeletedAt)
            .HasColumnType("timestamptz");

        builder.Property(d => d.DeletedBy)
            .HasColumnType("uuid");

        builder.HasIndex(d => new { d.TenantId, d.Name })
            .IsUnique()
            .HasFilter("\"deleted_at\" IS NULL");

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
