using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Purchases.Suppliers.Commands.DeleteSupplier;

public sealed record DeleteSupplierCommand(Guid TenantId, Guid SupplierId) : ICommand<bool>;
