using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Purchases;

namespace EcuNexo.Business.Purchases.Expenses.Commands.SeedDefaultExpenseTypes;

public sealed class SeedDefaultExpenseTypesHandler : ICommandHandler<SeedDefaultExpenseTypesCommand, int>
{
    private readonly IExpenseTypeRepository _expenseTypes;
    private readonly IIdGenerator _idGenerator;
    private readonly IUnitOfWork _unitOfWork;

    public SeedDefaultExpenseTypesHandler(
        IExpenseTypeRepository expenseTypes,
        IIdGenerator idGenerator,
        IUnitOfWork unitOfWork)
    {
        _expenseTypes = expenseTypes;
        _idGenerator = idGenerator;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<int>> Handle(SeedDefaultExpenseTypesCommand command, CancellationToken ct)
    {
        var existingCount = await _expenseTypes.CountAsync(command.TenantId, ct).ConfigureAwait(false);
        if (existingCount > 0)
        {
            return Result.Success(0);
        }

        var vigencia2026 = new DateOnly(2026, 8, 6);
        var defaults = new (string Code, string Name, string Sustento, bool AffectsInventory, string? IrRet, decimal? Pct, DateOnly? From, string? Description)[]
        {
            ("BIEN", "Compra de Bienes y Mercadería", "01", true, "312", 2.00m, vigencia2026, "Transferencia de bienes muebles corporales para reventa, insumos o inventario (AIR 312 - 2%)."),
            ("SERV_MANO", "Servicios de Mano de Obra y Mantenimiento", "02", false, "307", 3.00m, vigencia2026, "Servicios donde predomina la mano de obra, reparaciones e infraestructura (AIR 307 - 3%)."),
            ("HON_NAT", "Honorarios Profesionales (Personas Naturales)", "02", false, "303", 10.00m, vigencia2026, "Servicios profesionales con título: contadores, abogados, asesores (AIR 303 - 10%)."),
            ("HON_SOC", "Servicios Profesionales (Sociedades)", "02", false, "303A", 5.00m, vigencia2026, "Servicios profesionales prestados por empresas y sociedades jurídicas (AIR 303A - 5%)."),
            ("SERV_INT", "Servicios de Asesoría e Intelecto sin Título", "02", false, "304", 10.00m, vigencia2026, "Servicios donde predomina el intelecto no titulados (AIR 304 - 10%)."),
            ("FLETE", "Transporte, Fletes y Envíos", "02", false, "310", 1.00m, vigencia2026, "Transporte privado o público de carga y encomiendas (AIR 310 - 1%)."),
            ("ARRIENDO", "Arriendo de Inmuebles y Bodegas", "02", false, "320", 10.00m, vigencia2026, "Arrendamiento de locales comerciales, oficinas y bodegas (AIR 320 - 10%)."),
            ("PUB", "Publicidad y Medios de Comunicación", "02", false, "309", 3.00m, vigencia2026, "Servicios de medios y agencias de publicidad digital o física (AIR 309 - 3%)."),
            ("RIMPE", "Compras a Proveedores RIMPE Emprendedor", "01", false, "343", 1.00m, vigencia2026, "Bienes o servicios de negocios bajo régimen RIMPE Emprendedores (AIR 343 - 1%).")
        };

        var entities = new List<ExpenseType>();
        foreach (var def in defaults)
        {
            var created = ExpenseType.Create(
                _idGenerator.NewId(),
                command.TenantId,
                def.Code,
                def.Name,
                def.Sustento,
                def.AffectsInventory,
                isSystem: true,
                def.IrRet,
                def.Pct,
                def.From,
                validUntil: null,
                def.Description);

            if (created.IsSuccess)
            {
                entities.Add(created.Value!);
            }
        }

        await _expenseTypes.AddRangeAsync(entities, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(entities.Count);
    }
}
