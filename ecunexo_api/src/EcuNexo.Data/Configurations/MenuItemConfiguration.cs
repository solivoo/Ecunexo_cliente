using EcuNexo.Core.Platform.Navigation;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class MenuItemConfiguration : IEntityTypeConfiguration<MenuItem>
{
    public void Configure(EntityTypeBuilder<MenuItem> builder)
    {
        builder.ToTable("menu_items", "platform");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id).HasMaxLength(MenuItem.IdMaxLength);
        builder.Property(x => x.ParentId).HasMaxLength(MenuItem.IdMaxLength);
        builder.Property(x => x.Label).HasMaxLength(MenuItem.LabelMaxLength).IsRequired();
        builder.Property(x => x.Icon).HasMaxLength(MenuItem.IconMaxLength);
        builder.Property(x => x.Route).HasMaxLength(MenuItem.RouteMaxLength);
        builder.Property(x => x.ModuleCode).HasMaxLength(MenuItem.ModuleCodeMaxLength).IsRequired();
        builder.Property(x => x.Context).HasConversion<int>().IsRequired();
        builder.Property(x => x.Position).HasConversion<int>().IsRequired();
        builder.Property(x => x.RequiredPermissions)
            .HasColumnType("jsonb");

        builder.HasIndex(x => new { x.Context, x.ModuleCode, x.SortOrder });
    }
}
