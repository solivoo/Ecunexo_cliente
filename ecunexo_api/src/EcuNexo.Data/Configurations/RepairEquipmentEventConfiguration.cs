using EcuNexo.Core.Repairs;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class RepairEquipmentEventConfiguration : IEntityTypeConfiguration<RepairEquipmentEvent>
{
    public void Configure(EntityTypeBuilder<RepairEquipmentEvent> builder)
    {
        builder.ToTable("equipment_events", "repairs");

        builder.HasKey(ev => ev.Id);

        builder.Property(ev => ev.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(ev => ev.EquipmentId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(ev => ev.UserId)
            .HasColumnType("uuid");

        builder.Property(ev => ev.FromStatus)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(ev => ev.ToStatus)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(ev => ev.Note)
            .HasMaxLength(1000);

        builder.Property(ev => ev.OccurredAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.HasIndex(ev => new { ev.EquipmentId, ev.OccurredAt });
    }
}
