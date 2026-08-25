using EcuNexo.Core.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users", "identity");

        builder.HasKey(u => u.Id);

        builder.Property(u => u.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(u => u.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(u => u.Tenant)
            .WithMany(t => t.Users)
            .HasForeignKey(u => u.TenantId)
            .HasPrincipalKey(t => t.Id)
            .OnDelete(DeleteBehavior.Restrict);

        var emailComparer = new ValueComparer<Email>(
            (left, right) => ReferenceEquals(left, right) || (left != null && left.Equals(right)),
            email => email.GetHashCode(),
            email => new Email(email.Value));

        builder.Property(u => u.Email)
            .HasConversion(e => e.Value, v => new Email(v))
            .HasColumnName("email")
            .HasMaxLength(Email.MaxLength)
            .IsRequired();

        builder.Property(u => u.Email).Metadata.SetValueComparer(emailComparer);

        builder.Property(u => u.Name)
            .HasMaxLength(User.NameMaxLength)
            .IsRequired();

        builder.Property(u => u.Department)
            .HasMaxLength(User.DepartmentMaxLength);

        builder.Property(u => u.DepartmentId)
            .HasColumnType("uuid")
            .HasColumnName("department_id");

        builder.HasOne(u => u.OrgDepartment)
            .WithMany()
            .HasForeignKey(u => u.DepartmentId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Property(u => u.Phone)
            .HasMaxLength(User.PhoneMaxLength);

        builder.Property(u => u.JobTitle)
            .HasMaxLength(User.JobTitleMaxLength);

        builder.Property(u => u.PasswordHash)
            .HasColumnName("password_hash")
            .HasMaxLength(User.PasswordHashMaxLength);

        builder.Property(u => u.LastLoginAt)
            .HasColumnType("timestamptz");

        builder.Property(u => u.IsDisabled)
            .HasColumnName("is_disabled")
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(u => u.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(u => u.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(u => u.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(u => u.UpdatedBy)
            .HasColumnType("uuid");

        builder.Property(u => u.DeletedAt)
            .HasColumnType("timestamptz");

        builder.Property(u => u.DeletedBy)
            .HasColumnType("uuid");

        builder.HasIndex(u => new { u.TenantId, u.Email })
            .IsUnique()
            .HasFilter("\"deleted_at\" IS NULL");

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
