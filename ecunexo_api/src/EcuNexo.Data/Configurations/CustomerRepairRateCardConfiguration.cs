using EcuNexo.Core.Customers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class CustomerRepairRateCardConfiguration : IEntityTypeConfiguration<CustomerRepairRateCard>
{
    public void Configure(EntityTypeBuilder<CustomerRepairRateCard> builder)
    {
        builder.ToTable("customer_repair_rate_cards", "repairs");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(x => x.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(x => x.CustomerId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(x => x.RateN1)
            .HasColumnType("numeric(18,4)");

        builder.Property(x => x.RateN2)
            .HasColumnType("numeric(18,4)");

        builder.Property(x => x.RateN3)
            .HasColumnType("numeric(18,4)");

        builder.Property(x => x.ContractReference)
            .HasMaxLength(CustomerRepairRateCard.ContractReferenceMaxLength);

        builder.Property(x => x.ValidFrom)
            .HasColumnType("timestamptz");

        builder.Property(x => x.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(x => x.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(x => x.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(x => x.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasIndex(x => new { x.TenantId, x.CustomerId })
            .IsUnique();

        builder.HasOne(x => x.Customer)
            .WithMany()
            .HasForeignKey(x => x.CustomerId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
