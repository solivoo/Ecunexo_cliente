using EcuNexo.Core.Accounting;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class JournalEntryLineConfiguration : IEntityTypeConfiguration<JournalEntryLine>
{
    public void Configure(EntityTypeBuilder<JournalEntryLine> builder)
    {
        builder.ToTable("journal_entry_lines", "accounting");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(l => l.JournalEntryId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(l => l.AccountId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(l => l.AccountCode)
            .HasMaxLength(Account.CodeMaxLength)
            .IsRequired();

        builder.Property(l => l.AccountName)
            .HasMaxLength(Account.NameMaxLength)
            .IsRequired();

        builder.Property(l => l.Debit)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(l => l.Credit)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(l => l.Reference)
            .HasMaxLength(JournalEntryLine.ReferenceMaxLength);

        builder.HasIndex(l => l.JournalEntryId);
        builder.HasIndex(l => l.AccountId);
        builder.HasIndex(l => l.AccountCode);
    }
}
