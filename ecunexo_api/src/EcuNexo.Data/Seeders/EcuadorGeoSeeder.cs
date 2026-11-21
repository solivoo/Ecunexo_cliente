using System.Security.Cryptography;
using System.Text;
using EcuNexo.Core.Logistics;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Seeders;

/// <summary>
/// Seed idempotente de las 24 provincias y 221 cantones oficiales del Ecuador (DPA INEC).
/// </summary>
public static class EcuadorGeoSeeder
{
    private sealed record ProvinceSeed(
        string Code,
        string Name,
        string Region,
        IReadOnlyList<(string Code, string Name, bool IsCapital)> Cantons);

    private static readonly IReadOnlyList<ProvinceSeed> Catalog =
    [
        new("01", "Azuay", "Sierra", [
            ("0101", "Cuenca", true), ("0102", "Girón", false), ("0103", "Gualaceo", false),
            ("0104", "Nabón", false), ("0105", "Paute", false), ("0106", "Pucará", false),
            ("0107", "San Fernando", false), ("0108", "Santa Isabel", false), ("0109", "Sigsig", false),
            ("0110", "Oña", false), ("0111", "Chordeleg", false), ("0112", "El Pan", false),
            ("0113", "Sevilla de Oro", false), ("0114", "Guachapala", false), ("0115", "Camilo Ponce Enríquez", false),
        ]),
        new("02", "Bolívar", "Sierra", [
            ("0201", "Guaranda", true), ("0202", "Chillanes", false), ("0203", "Chimbo", false),
            ("0204", "Echeandía", false), ("0205", "San Miguel", false), ("0206", "Caluma", false),
            ("0207", "Las Naves", false),
        ]),
        new("03", "Cañar", "Sierra", [
            ("0301", "Azogues", true), ("0302", "Biblián", false), ("0303", "Cañar", false),
            ("0304", "La Troncal", false), ("0305", "El Tambo", false), ("0306", "Déleg", false),
            ("0307", "Suscal", false),
        ]),
        new("04", "Carchi", "Sierra", [
            ("0401", "Tulcán", true), ("0402", "Bolívar", false), ("0403", "Espejo", false),
            ("0404", "Mira", false), ("0405", "Montúfar", false), ("0406", "San Pedro de Huaca", false),
        ]),
        new("05", "Cotopaxi", "Sierra", [
            ("0501", "Latacunga", true), ("0502", "La Maná", false), ("0503", "Pangua", false),
            ("0504", "Pujilí", false), ("0505", "Salcedo", false), ("0506", "Saquisilí", false),
            ("0507", "Sigchos", false),
        ]),
        new("06", "Chimborazo", "Sierra", [
            ("0601", "Riobamba", true), ("0602", "Alausí", false), ("0603", "Colta", false),
            ("0604", "Chambo", false), ("0605", "Chunchi", false), ("0606", "Guamote", false),
            ("0607", "Guano", false), ("0608", "Pallatanga", false), ("0609", "Penipe", false),
            ("0610", "Cumandá", false),
        ]),
        new("07", "El Oro", "Costa", [
            ("0701", "Machala", true), ("0702", "Arenillas", false), ("0703", "Atahualpa", false),
            ("0704", "Balsas", false), ("0705", "Chilla", false), ("0706", "El Guabo", false),
            ("0707", "Huaquillas", false), ("0708", "Marcabelí", false), ("0709", "Pasaje", false),
            ("0710", "Piñas", false), ("0711", "Portovelo", false), ("0712", "Santa Rosa", false),
            ("0713", "Zaruma", false), ("0714", "Las Lajas", false),
        ]),
        new("08", "Esmeraldas", "Costa", [
            ("0801", "Esmeraldas", true), ("0802", "Eloy Alfaro", false), ("0803", "Muisne", false),
            ("0804", "Quinindé", false), ("0805", "San Lorenzo", false), ("0806", "Atacames", false),
            ("0807", "Rioverde", false),
        ]),
        new("09", "Guayas", "Costa", [
            ("0901", "Guayaquil", true), ("0902", "Alfredo Baquerizo Moreno (Jujan)", false), ("0903", "Balao", false),
            ("0904", "Balzar", false), ("0905", "Colimes", false), ("0906", "Daule", false),
            ("0907", "Durán", false), ("0908", "El Empalme", false), ("0909", "El Triunfo", false),
            ("0910", "Milagro", false), ("0911", "Naranjal", false), ("0912", "Naranjito", false),
            ("0913", "Palestina", false), ("0914", "Pedro Carbo", false), ("0915", "Samborondón", false),
            ("0916", "Santa Lucía", false), ("0917", "Salitre", false), ("0918", "Yaguachi", false),
            ("0919", "Playas", false), ("0920", "Simón Bolívar", false), ("0921", "Coronel Marcelino Maridueña", false),
            ("0922", "Lomas de Sargentillo", false), ("0923", "Nobol", false), ("0924", "General Antonio Elizalde (Bucay)", false),
            ("0925", "Isidro Ayora", false),
        ]),
        new("10", "Imbabura", "Sierra", [
            ("1001", "Ibarra", true), ("1002", "Antonio Ante", false), ("1003", "Cotacachi", false),
            ("1004", "Otavalo", false), ("1005", "Pimampiro", false), ("1006", "San Miguel de Urcuquí", false),
        ]),
        new("11", "Loja", "Sierra", [
            ("1101", "Loja", true), ("1102", "Calvas", false), ("1103", "Catamayo", false),
            ("1104", "Célica", false), ("1105", "Chaguarpamba", false), ("1106", "Espíndola", false),
            ("1107", "Gonzanamá", false), ("1108", "Macará", false), ("1109", "Paltas", false),
            ("1110", "Puyango", false), ("1111", "Saraguro", false), ("1112", "Sozoranga", false),
            ("1113", "Zapotillo", false), ("1114", "Pindal", false), ("1115", "Quilanga", false),
            ("1116", "Olmedo", false),
        ]),
        new("12", "Los Ríos", "Costa", [
            ("1201", "Babahoyo", true), ("1202", "Baba", false), ("1203", "Montalvo", false),
            ("1204", "Puebloviejo", false), ("1205", "Quevedo", false), ("1206", "Urdaneta", false),
            ("1207", "Ventanas", false), ("1208", "Vinces", false), ("1209", "Palenque", false),
            ("1210", "Buena Fe", false), ("1211", "Valencia", false), ("1212", "Mocache", false),
            ("1213", "Quinsaloma", false),
        ]),
        new("13", "Manabí", "Costa", [
            ("1301", "Portoviejo", true), ("1302", "Bolívar", false), ("1303", "Chone", false),
            ("1304", "El Carmen", false), ("1305", "Flavio Alfaro", false), ("1306", "Jipijapa", false),
            ("1307", "Junín", false), ("1308", "Manta", false), ("1309", "Montecristi", false),
            ("1310", "Paján", false), ("1311", "Pichincha", false), ("1312", "Rocafuerte", false),
            ("1313", "Santa Ana", false), ("1314", "Sucre", false), ("1315", "Tosagua", false),
            ("1316", "24 de Mayo", false), ("1317", "Pedernales", false), ("1318", "Olmedo", false),
            ("1319", "Puerto López", false), ("1320", "Jama", false), ("1321", "Jaramijó", false),
            ("1322", "San Vicente", false),
        ]),
        new("14", "Morona Santiago", "Amazonía", [
            ("1401", "Morona (Macas)", true), ("1402", "Gualaquiza", false), ("1403", "Limón Indanza", false),
            ("1404", "Palora", false), ("1405", "Santiago", false), ("1406", "Sucúa", false),
            ("1407", "Huamboya", false), ("1408", "San Juan Bosco", false), ("1409", "Taisha", false),
            ("1410", "Logroño", false), ("1411", "Pablo Sexto", false), ("1412", "Tiwintza", false),
        ]),
        new("15", "Napo", "Amazonía", [
            ("1501", "Tena", true), ("1502", "Archidona", false), ("1503", "El Chaco", false),
            ("1504", "Quijos", false), ("1505", "Carlos Julio Arosemena Tola", false),
        ]),
        new("16", "Pastaza", "Amazonía", [
            ("1601", "Pastaza (Puyo)", true), ("1602", "Mera", false), ("1603", "Santa Clara", false),
            ("1604", "Arajuno", false),
        ]),
        new("17", "Pichincha", "Sierra", [
            ("1701", "Quito", true), ("1702", "Cayambe", false), ("1703", "Mejía", false),
            ("1704", "Pedro Moncayo", false), ("1705", "Rumiñahui", false), ("1706", "San Miguel de los Bancos", false),
            ("1707", "Pedro Vicente Maldonado", false), ("1708", "Puerto Quito", false),
        ]),
        new("18", "Tungurahua", "Sierra", [
            ("1801", "Ambato", true), ("1802", "Baños de Agua Santa", false), ("1803", "Cevallos", false),
            ("1804", "Mocha", false), ("1805", "Patate", false), ("1806", "Quero", false),
            ("1807", "Pelileo", false), ("1808", "Píllaro", false), ("1809", "Tisaleo", false),
        ]),
        new("19", "Zamora Chinchipe", "Amazonía", [
            ("1901", "Zamora", true), ("1902", "Chinchipe", false), ("1903", "Nangaritza", false),
            ("1904", "Yacuambi", false), ("1905", "Yantzaza", false), ("1906", "El Pangui", false),
            ("1907", "Centinela del Cóndor", false), ("1908", "Palanda", false), ("1909", "Paquisha", false),
        ]),
        new("20", "Galápagos", "Insular", [
            ("2001", "San Cristóbal", true), ("2002", "Isabela", false), ("2003", "Santa Cruz", false),
        ]),
        new("21", "Sucumbíos", "Amazonía", [
            ("2101", "Lago Agrio (Nueva Loja)", true), ("2102", "Gonzalo Pizarro", false), ("2103", "Putumayo", false),
            ("2104", "Shushufindi", false), ("2105", "Sucumbíos", false), ("2106", "Cascales", false),
            ("2107", "Cuyabeno", false),
        ]),
        new("22", "Orellana", "Amazonía", [
            ("2201", "Francisco de Orellana (El Coca)", true), ("2202", "Aguarico", false),
            ("2203", "La Joya de los Sachas", false), ("2204", "Loreto", false),
        ]),
        new("23", "Santo Domingo de los Tsáchilas", "Costa", [
            ("2301", "Santo Domingo", true), ("2302", "La Concordia", false),
        ]),
        new("24", "Santa Elena", "Costa", [
            ("2401", "Santa Elena", true), ("2402", "La Libertad", false), ("2403", "Salinas", false),
        ]),
    ];

    public static async Task EnsureSeededAsync(EcuNexoDbContext db, CancellationToken ct)
    {
        var existingProvinceCodes = await db.EcuadorProvinces
            .AsNoTracking()
            .Select(p => new { p.Id, p.Code })
            .ToDictionaryAsync(p => p.Code, p => p.Id, ct)
            .ConfigureAwait(false);

        var existingCantonCodes = await db.EcuadorCantons
            .AsNoTracking()
            .Select(c => c.Code)
            .ToHashSetAsync(ct)
            .ConfigureAwait(false);

        var provinceSort = 0;
        var anyAdded = false;

        foreach (var prov in Catalog)
        {
            provinceSort++;
            if (!existingProvinceCodes.TryGetValue(prov.Code, out var provinceId))
            {
                provinceId = DeterministicGuid($"ec-province-{prov.Code}");
                db.EcuadorProvinces.Add(
                    EcuadorProvince.Create(provinceId, prov.Code, prov.Name, prov.Region, provinceSort));
                existingProvinceCodes[prov.Code] = provinceId;
                anyAdded = true;
            }

            var cantonSort = 0;
            foreach (var (cantonCode, cantonName, isCapital) in prov.Cantons)
            {
                cantonSort++;
                if (existingCantonCodes.Contains(cantonCode))
                {
                    continue;
                }

                var cantonId = DeterministicGuid($"ec-canton-{cantonCode}");
                db.EcuadorCantons.Add(
                    EcuadorCanton.Create(cantonId, provinceId, cantonCode, cantonName, isCapital, cantonSort));
                existingCantonCodes.Add(cantonCode);
                anyAdded = true;
            }
        }

        if (anyAdded)
        {
            await db.SaveChangesAsync(ct).ConfigureAwait(false);
        }
    }

    private static Guid DeterministicGuid(string key)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(key));
        return new Guid(hash[..16]);
    }
}
