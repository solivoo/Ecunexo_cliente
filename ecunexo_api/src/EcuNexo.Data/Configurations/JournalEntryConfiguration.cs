using EcuNexo.Core.Accounting;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class JournalEntryConfiguration : IEntityTypeConfiguration<JournalEntry>
{
    public void Configure(EntityTypeBuilder<JournalEntry> builder)
    {
        builder.ToTable("journal_entries", "accounting");

        builder.HasKey(j => j.Id);

        builder.Property(j => j.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(j => j.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(j => j.EntryNumber)
            .HasMaxLength(JournalEntry.EntryNumberMaxLength)
            .IsRequired();

        builder.Property(j => j.Date)
            .IsRequired();

        builder.Property(j => j.Description)
            .HasMaxLength(JournalEntry.DescriptionMaxLength)
            .IsRequired();

        builder.Property(j => j.Source)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(j => j.SourceId)
            .HasColumnType("uuid");

        builder.Property(j => j.SourceReference)
            .HasMaxLength(JournalEntry.SourceReferenceMaxLength);

        builder.Property(j => j.Status)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(j => j.TotalDebit)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(j => j.TotalCredit)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Ignore(j => j.IsBalanced);

        builder.Property(j => j.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(j => j.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(j => j.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(j => j.UpdatedBy)
            .HasColumnType("uuid");

        builder.Property(j => j.DeletedAt)
            .HasColumnType("timestamptz");

        builder.Property(j => j.DeletedBy)
            .HasColumnType("uuid");

        builder.HasMany(j => j.Lines)
            .WithOne()
            .HasForeignKey(l => l.JournalEntryId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(j => new { j.TenantId, j.EntryNumber })
            .IsUnique()
            .HasFilter("deleted_at IS NULL");

        builder.HasIndex(j => new { j.TenantId, j.Date })
            .HasFilter("deleted_at IS NULL");

        builder.HasIndex(j => new { j.TenantId, j.Source, j.SourceId })
            .HasFilter("deleted_at IS NULL");
    }
}
