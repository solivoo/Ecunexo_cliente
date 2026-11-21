using EcuNexo.Core.Logistics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class EcuadorCantonConfiguration : IEntityTypeConfiguration<EcuadorCanton>
{
    public void Configure(EntityTypeBuilder<EcuadorCanton> builder)
    {
        builder.ToTable("ecuador_cantons", "logistics");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(c => c.ProvinceId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(c => c.Code)
            .HasMaxLength(EcuadorCanton.CodeMaxLength)
            .IsRequired();

        builder.Property(c => c.Name)
            .HasMaxLength(EcuadorCanton.NameMaxLength)
            .IsRequired();

        builder.Property(c => c.IsProvincialCapital)
            .HasDefaultValue(false);

        builder.Property(c => c.SortOrder)
            .HasDefaultValue(0);

        builder.Property(c => c.IsActive)
            .HasDefaultValue(true);

        builder.HasOne(c => c.Province)
            .WithMany(p => p.Cantons)
            .HasForeignKey(c => c.ProvinceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(c => c.Code)
            .IsUnique()
            .HasDatabaseName("ix_ecuador_cantons_code");

        builder.HasIndex(c => new { c.ProvinceId, c.Name })
            .HasDatabaseName("ix_ecuador_cantons_province_name");
    }
}
