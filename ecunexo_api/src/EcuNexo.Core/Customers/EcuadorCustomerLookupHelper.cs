using System.Collections.Frozen;

namespace EcuNexo.Core.Customers;

public static class EcuadorCustomerLookupHelper
{
    private static readonly FrozenDictionary<string, (string Province, string MainCity)> Provinces =
        new Dictionary<string, (string Province, string MainCity)>
        {
            ["01"] = ("Azuay", "Cuenca"),
            ["02"] = ("Bolívar", "Guaranda"),
            ["03"] = ("Cañar", "Azogues"),
            ["04"] = ("Carchi", "Tulcán"),
            ["05"] = ("Cotopaxi", "Latacunga"),
            ["06"] = ("Chimborazo", "Riobamba"),
            ["07"] = ("El Oro", "Machala"),
            ["08"] = ("Esmeraldas", "Esmeraldas"),
            ["09"] = ("Guayas", "Guayaquil"),
            ["10"] = ("Imbabura", "Ibarra"),
            ["11"] = ("Loja", "Loja"),
            ["12"] = ("Los Ríos", "Babahoyo"),
            ["13"] = ("Manabí", "Portoviejo"),
            ["14"] = ("Morona Santiago", "Macas"),
            ["15"] = ("Napo", "Tena"),
            ["16"] = ("Pastaza", "Puyo"),
            ["17"] = ("Pichincha", "Quito"),
            ["18"] = ("Tungurahua", "Ambato"),
            ["19"] = ("Zamora Chinchipe", "Zamora"),
            ["20"] = ("Galápagos", "Puerto Baquerizo Moreno"),
            ["21"] = ("Sucumbíos", "Nueva Loja"),
            ["22"] = ("Orellana", "Puerto Francisco de Orellana"),
            ["23"] = ("Santo Domingo de los Tsáchilas", "Santo Domingo"),
            ["24"] = ("Santa Elena", "Santa Elena"),
            ["30"] = ("Exterior", "Exterior")
        }.ToFrozenDictionary();

    public static string? DeriveCity(string? taxId)
    {
        if (string.IsNullOrWhiteSpace(taxId))
        {
            return null;
        }

        var digits = new string(taxId.Where(char.IsAsciiDigit).ToArray());
        if (digits.Length < 2)
        {
            return null;
        }

        var code = digits[..2];
        return Provinces.TryGetValue(code, out var info) ? info.MainCity : null;
    }

    public static (CustomerIdentificationType IdType, CustomerType CustType) InferTypes(string taxId)
    {
        var clean = taxId.Trim();
        if (clean == "9999999999999")
        {
            return (CustomerIdentificationType.ConsumidorFinal, CustomerType.ConsumidorFinal);
        }

        var digits = new string(clean.Where(char.IsAsciiDigit).ToArray());
        if (digits.Length == 10)
        {
            return (CustomerIdentificationType.Cedula, CustomerType.PersonaNatural);
        }

        if (digits.Length == 13)
        {
            var thirdDigit = digits[2] - '0';
            if (thirdDigit == 9)
            {
                return (CustomerIdentificationType.Ruc, CustomerType.CorporativoB2B);
            }

            if (thirdDigit == 6)
            {
                return (CustomerIdentificationType.Ruc, CustomerType.InstitucionPublica);
            }

            return (CustomerIdentificationType.Ruc, CustomerType.PersonaNatural);
        }

        return (CustomerIdentificationType.Pasaporte, CustomerType.PersonaNatural);
    }
}
