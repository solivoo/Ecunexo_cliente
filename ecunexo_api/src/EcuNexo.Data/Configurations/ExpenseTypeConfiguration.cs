using EcuNexo.Core.Purchases;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class ExpenseTypeConfiguration : IEntityTypeConfiguration<ExpenseType>
{
    public void Configure(EntityTypeBuilder<ExpenseType> builder)
    {
        builder.ToTable("expense_types", "purchases");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(e => e.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(e => e.Code)
            .HasMaxLength(ExpenseType.CodeMaxLength)
            .IsRequired();

        builder.Property(e => e.Name)
            .HasMaxLength(ExpenseType.NameMaxLength)
            .IsRequired();

        builder.Property(e => e.Description)
            .HasMaxLength(ExpenseType.DescriptionMaxLength);

        builder.Property(e => e.SriSustentoCode)
            .HasMaxLength(ExpenseType.SriSustentoCodeMaxLength)
            .HasDefaultValue("01")
            .IsRequired();

        builder.Property(e => e.AffectsInventory)
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(e => e.IsSystem)
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(e => e.SuggestedRetentionCode)
            .HasMaxLength(20);

        builder.Property(e => e.RetentionPercentage)
            .HasPrecision(5, 2);

        builder.Property(e => e.ValidFrom);

        builder.Property(e => e.ValidUntil);

        builder.Property(e => e.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(e => e.CreatedAt)
            .IsRequired();

        builder.Property(e => e.UpdatedAt);
        builder.Property(e => e.CreatedBy).HasColumnType("uuid");
        builder.Property(e => e.UpdatedBy).HasColumnType("uuid");

        builder.HasIndex(e => new { e.TenantId, e.Code })
            .IsUnique()
            .HasDatabaseName("ix_expense_types_tenant_code_unique");

        builder.HasIndex(e => new { e.TenantId, e.IsActive })
            .HasDatabaseName("ix_expense_types_tenant_active");
    }
}
