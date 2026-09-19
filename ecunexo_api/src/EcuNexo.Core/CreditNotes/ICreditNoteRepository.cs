namespace EcuNexo.Core.CreditNotes;

/// <summary>
/// Abstracción del repositorio de dominio para la gestión de Notas de Crédito Electrónicas.
/// </summary>
public interface ICreditNoteRepository
{
    Task AddAsync(CreditNote creditNote, CancellationToken cancellationToken = default);

    Task<CreditNote?> GetByIdAsync(Guid tenantId, Guid creditNoteId, CancellationToken cancellationToken = default);

    Task<CreditNote?> GetByDocumentNumberAsync(Guid tenantId, string establishment, string emissionPoint, string sequential, CancellationToken cancellationToken = default);

    Task<CreditNote?> GetByAccessKeyAsync(Guid tenantId, string accessKey, CancellationToken cancellationToken = default);

    Task<(IReadOnlyCollection<CreditNote> Items, int TotalCount)> ListAsync(
        Guid tenantId,
        CreditNoteStatus? status = null,
        CreditNoteReasonType? reasonType = null,
        DateOnly? startDate = null,
        DateOnly? endDate = null,
        string? searchTerm = null,
        int pageNumber = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default);

    Task UpdateAsync(CreditNote creditNote, CancellationToken cancellationToken = default);

    /// <summary>
    /// Asigna de manera atómica y segura el siguiente secuencial numérico para Notas de Crédito (Tipo 04)
    /// respetando el punto de emisión y el ambiente activo (1 Pruebas / 2 Producción).
    /// </summary>
    Task<string> AllocateNextSequentialAsync(Guid tenantId, string establishment, string emissionPoint, string environment = "1", CancellationToken cancellationToken = default);
}
