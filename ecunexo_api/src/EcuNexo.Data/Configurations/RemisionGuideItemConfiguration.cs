using EcuNexo.Core.RemisionGuides;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class RemisionGuideItemConfiguration : IEntityTypeConfiguration<RemisionGuideItem>
{
    public void Configure(EntityTypeBuilder<RemisionGuideItem> builder)
    {
        builder.ToTable("remision_guide_items", "billing");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(i => i.RemisionGuideId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(i => i.ItemCode)
            .HasMaxLength(RemisionGuideItem.ItemCodeMaxLength)
            .IsRequired();

        builder.Property(i => i.Description)
            .HasMaxLength(RemisionGuideItem.DescriptionMaxLength)
            .IsRequired();

        builder.Property(i => i.Quantity)
            .HasPrecision(18, 4)
            .IsRequired();

        builder.Property(i => i.UnitOfMeasure)
            .HasMaxLength(RemisionGuideItem.UnitOfMeasureMaxLength);

        builder.Property(i => i.InternalReference)
            .HasMaxLength(50);

        builder.HasIndex(i => i.RemisionGuideId);
    }
}
