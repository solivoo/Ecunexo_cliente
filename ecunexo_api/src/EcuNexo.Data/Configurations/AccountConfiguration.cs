using EcuNexo.Core.Accounting;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class AccountConfiguration : IEntityTypeConfiguration<Account>
{
    public void Configure(EntityTypeBuilder<Account> builder)
    {
        builder.ToTable("accounts", "accounting");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(a => a.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(a => a.Code)
            .HasMaxLength(Account.CodeMaxLength)
            .IsRequired();

        builder.Property(a => a.Name)
            .HasMaxLength(Account.NameMaxLength)
            .IsRequired();

        builder.Property(a => a.AccountType)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(a => a.Nature)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(a => a.Level)
            .IsRequired();

        builder.Property(a => a.ParentAccountId)
            .HasColumnType("uuid");

        builder.Property(a => a.ParentCode)
            .HasMaxLength(Account.CodeMaxLength);

        builder.Property(a => a.AllowsMovement)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(a => a.IsSystem)
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(a => a.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(a => a.Description)
            .HasMaxLength(Account.DescriptionMaxLength);

        builder.Property(a => a.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(a => a.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(a => a.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(a => a.UpdatedBy)
            .HasColumnType("uuid");

        builder.Property(a => a.DeletedAt)
            .HasColumnType("timestamptz");

        builder.Property(a => a.DeletedBy)
            .HasColumnType("uuid");

        builder.HasIndex(a => new { a.TenantId, a.Code })
            .IsUnique()
            .HasFilter("deleted_at IS NULL");

        builder.HasIndex(a => new { a.TenantId, a.ParentCode })
            .HasFilter("deleted_at IS NULL");

        builder.HasIndex(a => new { a.TenantId, a.AccountType })
            .HasFilter("deleted_at IS NULL");
    }
}
