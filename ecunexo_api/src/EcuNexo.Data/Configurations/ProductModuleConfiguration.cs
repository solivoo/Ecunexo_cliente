using EcuNexo.Core.Platform.Navigation;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class ProductModuleConfiguration : IEntityTypeConfiguration<ProductModule>
{
    public void Configure(EntityTypeBuilder<ProductModule> builder)
    {
        builder.ToTable("product_modules", "platform");

        builder.HasKey(x => x.Code);
        builder.Property(x => x.Code).HasMaxLength(ProductModule.CodeMaxLength);
        builder.Property(x => x.DisplayName).HasMaxLength(ProductModule.DisplayNameMaxLength).IsRequired();
    }
}
