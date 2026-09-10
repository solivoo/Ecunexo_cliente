using EcuNexo.Core.Repairs;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class RepairDispatchItemConfiguration : IEntityTypeConfiguration<RepairDispatchItem>
{
    public void Configure(EntityTypeBuilder<RepairDispatchItem> builder)
    {
        builder.ToTable("dispatch_items", "repairs");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(i => i.DispatchId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(i => i.EquipmentId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(i => i.Equipment)
            .WithMany()
            .HasForeignKey(i => i.EquipmentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(i => i.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.HasIndex(i => new { i.DispatchId, i.EquipmentId }).IsUnique();
    }
}
