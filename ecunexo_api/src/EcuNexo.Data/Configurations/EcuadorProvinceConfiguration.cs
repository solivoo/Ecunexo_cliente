using EcuNexo.Core.Logistics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class EcuadorProvinceConfiguration : IEntityTypeConfiguration<EcuadorProvince>
{
    public void Configure(EntityTypeBuilder<EcuadorProvince> builder)
    {
        builder.ToTable("ecuador_provinces", "logistics");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(p => p.Code)
            .HasMaxLength(EcuadorProvince.CodeMaxLength)
            .IsRequired();

        builder.Property(p => p.Name)
            .HasMaxLength(EcuadorProvince.NameMaxLength)
            .IsRequired();

        builder.Property(p => p.Region)
            .HasMaxLength(EcuadorProvince.RegionMaxLength)
            .IsRequired();

        builder.Property(p => p.SortOrder)
            .HasDefaultValue(0);

        builder.Property(p => p.IsActive)
            .HasDefaultValue(true);

        builder.HasIndex(p => p.Code)
            .IsUnique()
            .HasDatabaseName("ix_ecuador_provinces_code");

        builder.HasIndex(p => p.Name)
            .HasDatabaseName("ix_ecuador_provinces_name");
    }
}
