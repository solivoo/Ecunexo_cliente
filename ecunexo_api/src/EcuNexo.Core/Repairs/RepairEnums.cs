namespace EcuNexo.Core.Repairs;

/// <summary>
/// Clasificación del nivel de daño o golpe en el electrodoméstico/equipo.
/// </summary>
public enum DamageLevel
{
    /// <summary>Nivel 1: Daño leve o estético (pulido, retoque, desabollado menor en frío).</summary>
    Level1 = 1,

    /// <summary>Nivel 2: Daño medio de gabinete/chapa y mecánica ligera (rectificación de paneles, bisagras, calibración).</summary>
    Level2 = 2,

    /// <summary>Nivel 3: Daño grave estructural y funcional (chasis, tina/tambor, motor, arnés eléctrico, pruebas profundas).</summary>
    Level3 = 3,

    /// <summary>Irreparable: Pérdida total o antieconómica; se documenta para baja contable y reclamo de seguro.</summary>
    Irreparable = 4,
}

/// <summary>
/// Estado general del lote recibido en el taller.
/// </summary>
public enum RepairBatchStatus
{
    /// <summary>Lote recién ingresado/importado, pendiente de diagnóstico masivo.</summary>
    Received = 0,

    /// <summary>Lote con equipos en diagnóstico o proceso técnico de reparación.</summary>
    InProgress = 1,

    /// <summary>Lote que ha realizado al menos un despacho parcial de equipos terminados.</summary>
    PartiallyDispatched = 2,

    /// <summary>Todos los equipos del lote han sido terminados o resueltos.</summary>
    Completed = 3,

    /// <summary>Lote totalmente despachado y liquidado administrativamente.</summary>
    Closed = 4,
}

/// <summary>
/// Estado del ciclo de vida de un equipo individual en el taller.
/// </summary>
public enum RepairEquipmentStatus
{
    /// <summary>Recibido en taller desde el lote.</summary>
    Received = 0,

    /// <summary>En diagnóstico técnico inicial y evaluación de daño.</summary>
    Diagnosing = 1,

    /// <summary>En proceso de reparación / reacondicionamiento.</summary>
    InRepair = 2,

    /// <summary>En inspección de control de calidad y pruebas funcionales/estéticas.</summary>
    QualityCheck = 3,

    /// <summary>Aprobado en control de calidad, listo para retiro o despacho.</summary>
    ReadyToDispatch = 4,

    /// <summary>Despachado del taller (incluido en un acta de despacho).</summary>
    Dispatched = 5,

    /// <summary>Facturado electrónicamente ante el SRI como servicio de reparación.</summary>
    Invoiced = 6,

    /// <summary>Dictaminado como irreparable / baja técnica.</summary>
    Irreparable = 7,
}

/// <summary>
/// Etapa operativa en la que se captura una foto de evidencia.
/// </summary>
public enum PhotoStage
{
    /// <summary>Evidencia inicial del golpe al ingreso (para reclamo a aseguradora de transporte).</summary>
    DamageInitial = 0,

    /// <summary>Evidencia técnica durante el desarme o proceso de reparación.</summary>
    InRepair = 1,

    /// <summary>Evidencia final del equipo terminado, pulido y embalado en control de calidad.</summary>
    QualityFinal = 2,
}

/// <summary>
/// Estado del despacho o salida de equipos del taller.
/// </summary>
public enum RepairDispatchStatus
{
    /// <summary>Borrador de despacho en preparación.</summary>
    Draft = 0,

    /// <summary>Confirmado: equipos retirados del taller con acta oficial y código QR.</summary>
    Confirmed = 1,

    /// <summary>Facturado: liquidación convertida en factura electrónica SRI de servicios.</summary>
    Invoiced = 2,
}
