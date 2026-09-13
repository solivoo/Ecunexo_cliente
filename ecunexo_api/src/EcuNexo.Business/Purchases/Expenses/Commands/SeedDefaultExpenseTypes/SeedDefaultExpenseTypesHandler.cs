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

        var defaults = new (string Code, string Name, string Sustento, bool AffectsInventory, string? IrRet, string? Description)[]
        {
            ("MERC", "Mercadería e Insumos para la venta", "01", true, "312", "Bienes y productos destinados a reventa o inventario."),
            ("EMPQ", "Materiales de Empaque y Embalaje", "01", true, "312", "Cajas, cintas, fundas de seguridad para preparación de pedidos."),
            ("PUB", "Publicidad y Marketing Digital", "02", false, "344", "Pauta en Meta Ads, Google Ads, TikTok, vallas publicitarias."),
            ("HOST", "Servicios Cloud, Hosting y Software", "02", false, "344", "Servicios SaaS, servidores en la nube, licencias de software."),
            ("ARR", "Arriendo de Inmuebles / Oficinas / Bodegas", "02", false, "320", "Alquiler de espacios comerciales, oficinas administrativas o bodegas."),
            ("HON", "Honorarios Profesionales y Asesorías", "02", false, "303", "Servicios contables, jurídicos, técnicos y consultorías."),
            ("MANT", "Mantenimiento, Reparaciones y Soporte Técnico", "02", false, "344", "Mantenimiento preventivo, correctivo y adecuaciones de infraestructura."),
            ("SERV", "Servicios Básicos y Telecomunicaciones", "02", false, "344", "Energía eléctrica, agua potable, internet empresarial y telefonía.")
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
