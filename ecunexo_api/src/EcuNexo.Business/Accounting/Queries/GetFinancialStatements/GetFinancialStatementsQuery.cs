using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Accounting.Repositories;
using EcuNexo.Core.Accounting;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Accounting.Queries.GetFinancialStatements;

public sealed record FinancialAccountLineDto(
    string Code,
    string Name,
    int Level,
    decimal Balance,
    string Nature);

public sealed record BalanceSheetGroupDto(
    string GroupCode,
    string GroupName,
    decimal Total,
    IReadOnlyList<FinancialAccountLineDto> Accounts);

public sealed record BalanceSheetDto(
    IReadOnlyList<BalanceSheetGroupDto> ActivoCorriente,
    decimal TotalActivoCorriente,
    IReadOnlyList<BalanceSheetGroupDto> ActivoNoCorriente,
    decimal TotalActivoNoCorriente,
    decimal TotalActivos,
    IReadOnlyList<BalanceSheetGroupDto> PasivoCorriente,
    decimal TotalPasivoCorriente,
    IReadOnlyList<BalanceSheetGroupDto> PasivoNoCorriente,
    decimal TotalPasivoNoCorriente,
    decimal TotalPasivos,
    IReadOnlyList<BalanceSheetGroupDto> Patrimonio,
    decimal TotalPatrimonioSinUtilidad,
    decimal UtilidadDelEjercicio,
    decimal TotalPatrimonioNeto,
    decimal TotalPasivoYPatrimonio,
    decimal DiferenciaCuadre,
    bool EstaEquilibrado);

public sealed record IncomeStatementGroupDto(
    string Concept,
    string AccountCode,
    decimal Amount,
    IReadOnlyList<FinancialAccountLineDto> Details);

public sealed record IncomeStatementDto(
    decimal VentasNetasTarifa15,
    decimal VentasNetasTarifa0,
    decimal TotalIngresosOperacionales,
    decimal CostoDeVentas,
    decimal UtilidadBruta,
    decimal GastosAdministracion,
    decimal GastosVentasYMarketing,
    decimal TotalGastosOperacionales,
    decimal UtilidadOperativa,
    decimal ParticipacionTrabajadores15,
    decimal UtilidadAntesDeImpuestos,
    decimal ImpuestoRentaEstimado25,
    decimal UtilidadNetaEjercicio,
    IReadOnlyList<IncomeStatementGroupDto> DesgloseGastos);

public sealed record FinancialStatementsResponse(
    Guid TenantId,
    int Year,
    int Month,
    string PeriodName,
    DateOnly CutoffDate,
    BalanceSheetDto BalanceGeneral,
    IncomeStatementDto EstadoResultados);

public sealed record GetFinancialStatementsQuery(
    Guid TenantId,
    int Year,
    int Month) : IQuery<FinancialStatementsResponse>;

public sealed class GetFinancialStatementsHandler : IQueryHandler<GetFinancialStatementsQuery, FinancialStatementsResponse>
{
    private readonly IJournalEntryRepository _journalEntries;
    private readonly IAccountRepository _accounts;

    public GetFinancialStatementsHandler(
        IJournalEntryRepository journalEntries,
        IAccountRepository accounts)
    {
        _journalEntries = journalEntries;
        _accounts = accounts;
    }

    public async Task<Result<FinancialStatementsResponse>> Handle(
        GetFinancialStatementsQuery query,
        CancellationToken ct)
    {
        if (query.Month < 1 || query.Month > 12)
        {
            return Result.Failure<FinancialStatementsResponse>(
                new Error("financial_statements.invalid_month", "El mes debe estar comprendido entre 1 y 12.", ErrorType.Validation));
        }

        var daysInMonth = DateTime.DaysInMonth(query.Year, query.Month);
        var cutoffDate = new DateOnly(query.Year, query.Month, daysInMonth);

        // 1. Obtener todas las cuentas del catálogo de la empresa
        var allAccounts = await _accounts.ListAsync(
            tenantId: query.TenantId,
            type: null,
            allowsMovementOnly: null,
            activeOnly: true,
            search: null,
            ct: ct).ConfigureAwait(false);

        var accountDict = allAccounts.ToDictionary(a => a.Code, a => a);

        // 2. Obtener todos los asientos contables contabilizados hasta la fecha de corte
        var entries = await _journalEntries.ListAsync(
            tenantId: query.TenantId,
            from: null,
            to: cutoffDate,
            source: null,
            status: JournalEntryStatus.Posted,
            search: null,
            ct: ct).ConfigureAwait(false);

        // 3. Acumular Debe y Haber por código de cuenta
        var debitSums = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        var creditSums = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);

        foreach (var entry in entries)
        {
            foreach (var line in entry.Lines)
            {
                var code = line.AccountCode.Trim();
                debitSums[code] = debitSums.GetValueOrDefault(code) + line.Debit;
                creditSums[code] = creditSums.GetValueOrDefault(code) + line.Credit;
            }
        }

        // Helper para obtener saldo de una cuenta o prefijo
        decimal GetNetBalance(string codePrefix, AccountNature normalNature)
        {
            decimal totalDebit = 0m;
            decimal totalCredit = 0m;

            foreach (var kvp in debitSums)
            {
                if (kvp.Key.StartsWith(codePrefix, StringComparison.OrdinalIgnoreCase))
                {
                    totalDebit += kvp.Value;
                }
            }

            foreach (var kvp in creditSums)
            {
                if (kvp.Key.StartsWith(codePrefix, StringComparison.OrdinalIgnoreCase))
                {
                    totalCredit += kvp.Value;
                }
            }

            return normalNature == AccountNature.Debit
                ? totalDebit - totalCredit
                : totalCredit - totalDebit;
        }

        // -------------------------------------------------------------
        // ESTADO DE RESULTADOS INTEGRAL (Pérdidas y Ganancias)
        // -------------------------------------------------------------
        // Ventas e Ingresos (Grupo 4)
        var ventas15 = GetNetBalance("4.1.01.01", AccountNature.Credit);
        var ventas0 = GetNetBalance("4.1.01.02", AccountNature.Credit);
        var otrosIngresos = GetNetBalance("4.1.01", AccountNature.Credit) - (ventas15 + ventas0);
        if (otrosIngresos < 0)
        {
            otrosIngresos = 0;
        }

        var totalIngresos = GetNetBalance("4", AccountNature.Credit);
        if (totalIngresos == 0 && (ventas15 > 0 || ventas0 > 0))
        {
            totalIngresos = ventas15 + ventas0;
        }

        // Costo de Ventas (Grupo 5.1)
        var costoVentas = GetNetBalance("5.1", AccountNature.Debit);
        var utilidadBruta = totalIngresos - costoVentas;

        // Gastos Operacionales (Grupo 5.2)
        var gastosMarketing = GetNetBalance("5.2.03", AccountNature.Debit);
        var totalGastosOperacionales = GetNetBalance("5.2", AccountNature.Debit);
        var gastosAdministracion = totalGastosOperacionales - gastosMarketing;
        if (gastosAdministracion < 0)
        {
            gastosAdministracion = 0;
        }

        var desgloseGastosList = new List<IncomeStatementGroupDto>();
        if (gastosMarketing > 0)
        {
            desgloseGastosList.Add(new IncomeStatementGroupDto(
                Concept: "Publicidad, Marketing y Pauta Digital",
                AccountCode: "5.2.03",
                Amount: gastosMarketing,
                Details: new List<FinancialAccountLineDto>
                {
                    new("5.2.03.01", "Pauta digital y publicidad en redes", 4, gastosMarketing, "Debit")
                }));
        }

        if (gastosAdministracion > 0)
        {
            desgloseGastosList.Add(new IncomeStatementGroupDto(
                Concept: "Gastos Administrativos y Operativos",
                AccountCode: "5.2.01",
                Amount: gastosAdministracion,
                Details: new List<FinancialAccountLineDto>
                {
                    new("5.2.01.01", "Gastos generales de administración", 4, gastosAdministracion, "Debit")
                }));
        }

        var utilidadOperativa = utilidadBruta - totalGastosOperacionales;

        // 15% Participación Trabajadores (Ecuador - Art. 97 C.T.)
        decimal participacion15 = 0m;
        if (utilidadOperativa > 0)
        {
            participacion15 = Math.Round(utilidadOperativa * 0.15m, 2);
        }

        var utilidadAntesIR = utilidadOperativa - participacion15;

        // 25% Impuesto a la Renta Sociedades
        decimal impuestoRenta25 = 0m;
        if (utilidadAntesIR > 0)
        {
            impuestoRenta25 = Math.Round(utilidadAntesIR * 0.25m, 2);
        }

        var utilidadNetaEjercicio = utilidadAntesIR - impuestoRenta25;

        var estadoResultados = new IncomeStatementDto(
            VentasNetasTarifa15: ventas15,
            VentasNetasTarifa0: ventas0,
            TotalIngresosOperacionales: totalIngresos,
            CostoDeVentas: costoVentas,
            UtilidadBruta: utilidadBruta,
            GastosAdministracion: gastosAdministracion,
            GastosVentasYMarketing: gastosMarketing,
            TotalGastosOperacionales: totalGastosOperacionales,
            UtilidadOperativa: utilidadOperativa,
            ParticipacionTrabajadores15: participacion15,
            UtilidadAntesDeImpuestos: utilidadAntesIR,
            ImpuestoRentaEstimado25: impuestoRenta25,
            UtilidadNetaEjercicio: utilidadNetaEjercicio,
            DesgloseGastos: desgloseGastosList);

        // -------------------------------------------------------------
        // ESTADO DE SITUACIÓN FINANCIERA (Balance General)
        // -------------------------------------------------------------
        // Activo Corriente (1.1.*)
        var cajaBancos = GetNetBalance("1.1.01", AccountNature.Debit);
        var clientesCobrar = GetNetBalance("1.1.02", AccountNature.Debit);
        var inventarios = GetNetBalance("1.1.04", AccountNature.Debit);
        var creditoTributario = GetNetBalance("1.1.05", AccountNature.Debit);
        var totalActivoCorriente = GetNetBalance("1.1", AccountNature.Debit);

        var activoCorrienteGroups = new List<BalanceSheetGroupDto>();
        if (cajaBancos != 0 || totalActivoCorriente == 0)
        {
            activoCorrienteGroups.Add(new BalanceSheetGroupDto(
                GroupCode: "1.1.01",
                GroupName: "Efectivo y Equivalentes de Efectivo (Caja y Bancos)",
                Total: cajaBancos,
                Accounts: new List<FinancialAccountLineDto>
                {
                    new("1.1.01.01", "Caja General", 4, cajaBancos, "Debit")
                }));
        }
        if (clientesCobrar != 0)
        {
            activoCorrienteGroups.Add(new BalanceSheetGroupDto(
                GroupCode: "1.1.02",
                GroupName: "Cuentas y Documentos por Cobrar Comerciales",
                Total: clientesCobrar,
                Accounts: new List<FinancialAccountLineDto>
                {
                    new("1.1.02.01", "Clientes Locales por Cobrar", 4, clientesCobrar, "Debit")
                }));
        }
        if (inventarios != 0)
        {
            activoCorrienteGroups.Add(new BalanceSheetGroupDto(
                GroupCode: "1.1.04",
                GroupName: "Inventarios de Mercaderías",
                Total: inventarios,
                Accounts: new List<FinancialAccountLineDto>
                {
                    new("1.1.04.01", "Mercaderías en Bodega", 4, inventarios, "Debit")
                }));
        }
        if (creditoTributario != 0)
        {
            activoCorrienteGroups.Add(new BalanceSheetGroupDto(
                GroupCode: "1.1.05",
                GroupName: "Crédito Tributario a Favor (IVA / IR)",
                Total: creditoTributario,
                Accounts: new List<FinancialAccountLineDto>
                {
                    new("1.1.05.01", "Crédito Tributario de IVA Compras", 4, creditoTributario, "Debit")
                }));
        }

        // Activo No Corriente (1.2.*)
        var totalActivoNoCorriente = GetNetBalance("1.2", AccountNature.Debit);
        var activoNoCorrienteGroups = new List<BalanceSheetGroupDto>();
        if (totalActivoNoCorriente != 0)
        {
            activoNoCorrienteGroups.Add(new BalanceSheetGroupDto(
                GroupCode: "1.2.01",
                GroupName: "Propiedades, Planta y Equipo",
                Total: totalActivoNoCorriente,
                Accounts: new List<FinancialAccountLineDto>
                {
                    new("1.2.01.01", "Muebles, Equipos de Cómputo y Operación", 4, totalActivoNoCorriente, "Debit")
                }));
        }

        var totalActivos = totalActivoCorriente + totalActivoNoCorriente;

        // Pasivo Corriente (2.1.*)
        var proveedoresLocales = GetNetBalance("2.1.01", AccountNature.Credit);
        var obligacionesSri = GetNetBalance("2.1.04", AccountNature.Credit);
        var totalPasivoCorriente = GetNetBalance("2.1", AccountNature.Credit);

        var pasivoCorrienteGroups = new List<BalanceSheetGroupDto>();
        if (proveedoresLocales != 0)
        {
            pasivoCorrienteGroups.Add(new BalanceSheetGroupDto(
                GroupCode: "2.1.01",
                GroupName: "Cuentas por Pagar Comerciales (Proveedores Locales)",
                Total: proveedoresLocales,
                Accounts: new List<FinancialAccountLineDto>
                {
                    new("2.1.01.01", "Proveedores Locales por Pagar", 4, proveedoresLocales, "Credit")
                }));
        }
        if (obligacionesSri != 0)
        {
            pasivoCorrienteGroups.Add(new BalanceSheetGroupDto(
                GroupCode: "2.1.04",
                GroupName: "Obligaciones con la Administración Tributaria (SRI)",
                Total: obligacionesSri,
                Accounts: new List<FinancialAccountLineDto>
                {
                    new("2.1.04.01", "IVA en Ventas por Pagar", 4, obligacionesSri, "Credit")
                }));
        }

        var totalPasivoNoCorriente = GetNetBalance("2.2", AccountNature.Credit);
        var pasivoNoCorrienteGroups = new List<BalanceSheetGroupDto>();

        var totalPasivos = totalPasivoCorriente + totalPasivoNoCorriente;

        // Patrimonio (3.*)
        var capitalSocial = GetNetBalance("3.1", AccountNature.Credit);
        var reservas = GetNetBalance("3.2", AccountNature.Credit);
        var resultadosAcumulados = GetNetBalance("3.4", AccountNature.Credit);
        var totalPatrimonioSinUtilidad = capitalSocial + reservas + resultadosAcumulados;

        var patrimonioGroups = new List<BalanceSheetGroupDto>();
        if (capitalSocial != 0 || totalPatrimonioSinUtilidad == 0)
        {
            patrimonioGroups.Add(new BalanceSheetGroupDto(
                GroupCode: "3.1.01",
                GroupName: "Capital Suscrito y Asignado (S.A.S.)",
                Total: capitalSocial,
                Accounts: new List<FinancialAccountLineDto>
                {
                    new("3.1.01.01", "Capital Pagado", 4, capitalSocial, "Credit")
                }));
        }

        var totalPatrimonioNeto = totalPatrimonioSinUtilidad + utilidadNetaEjercicio;
        var totalPasivoYPatrimonio = totalPasivos + totalPatrimonioNeto;
        var diferenciaCuadre = totalActivos - totalPasivoYPatrimonio;
        var estaEquilibrado = Math.Abs(diferenciaCuadre) < 0.01m;

        var balanceGeneral = new BalanceSheetDto(
            ActivoCorriente: activoCorrienteGroups,
            TotalActivoCorriente: totalActivoCorriente,
            ActivoNoCorriente: activoNoCorrienteGroups,
            TotalActivoNoCorriente: totalActivoNoCorriente,
            TotalActivos: totalActivos,
            PasivoCorriente: pasivoCorrienteGroups,
            TotalPasivoCorriente: totalPasivoCorriente,
            PasivoNoCorriente: pasivoNoCorrienteGroups,
            TotalPasivoNoCorriente: totalPasivoNoCorriente,
            TotalPasivos: totalPasivos,
            Patrimonio: patrimonioGroups,
            TotalPatrimonioSinUtilidad: totalPatrimonioSinUtilidad,
            UtilidadDelEjercicio: utilidadNetaEjercicio,
            TotalPatrimonioNeto: totalPatrimonioNeto,
            TotalPasivoYPatrimonio: totalPasivoYPatrimonio,
            DiferenciaCuadre: diferenciaCuadre,
            EstaEquilibrado: estaEquilibrado);

        var monthNames = new[]
        {
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        };
        var periodName = $"{monthNames[query.Month - 1]} {query.Year}";

        var response = new FinancialStatementsResponse(
            TenantId: query.TenantId,
            Year: query.Year,
            Month: query.Month,
            PeriodName: periodName,
            CutoffDate: cutoffDate,
            BalanceGeneral: balanceGeneral,
            EstadoResultados: estadoResultados);

        return Result.Success(response);
    }
}
