using EcuNexo.Core.Ecommerce;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class EcommerceOrderTimelineConfiguration : IEntityTypeConfiguration<EcommerceOrderTimeline>
{
    public void Configure(EntityTypeBuilder<EcommerceOrderTimeline> builder)
    {
        builder.ToTable("order_timelines", "ecommerce");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(t => t.EcommerceOrderId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(t => t.PreviousStatus)
            .HasConversion<int>();

        builder.Property(t => t.NewStatus)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(t => t.Notes)
            .HasMaxLength(500);

        builder.Property(t => t.OccurredAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(t => t.UserId)
            .HasColumnType("uuid");

        builder.Property(t => t.UserName)
            .HasMaxLength(150);

        builder.HasIndex(t => t.EcommerceOrderId);
        builder.HasIndex(t => t.OccurredAt);
    }
}
