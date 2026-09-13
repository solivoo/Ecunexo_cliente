using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Purchases.Proformas.Commands.ApprovePurchaseProforma;

public sealed record ApprovePurchaseProformaCommand(Guid TenantId, Guid ProformaId) : ICommand<PurchaseProformaResponse>;
