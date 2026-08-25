using EcuNexo.Core.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class SysSettingConfiguration : IEntityTypeConfiguration<SysSetting>
{
    public void Configure(EntityTypeBuilder<SysSetting> builder)
    {
        builder.ToTable("sys_settings", "platform");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(s => s.Code)
            .HasMaxLength(SysSetting.CodeMaxLength)
            .IsRequired();

        builder.Property(s => s.ValueJson)
            .HasColumnName("value")
            .HasColumnType("jsonb")
            .IsRequired();

        builder.Property(s => s.Scope)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(s => s.ScopeId)
            .HasMaxLength(SysSetting.ScopeIdMaxLength);

        builder.Property(s => s.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(s => s.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(s => s.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(s => s.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasIndex(s => new { s.Code, s.Scope, s.ScopeId })
            .IsUnique();

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
