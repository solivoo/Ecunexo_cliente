using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Purchases.Proformas.Commands.RejectPurchaseProforma;

public sealed record RejectPurchaseProformaCommand(Guid TenantId, Guid ProformaId, string? Reason) : ICommand<PurchaseProformaResponse>;
