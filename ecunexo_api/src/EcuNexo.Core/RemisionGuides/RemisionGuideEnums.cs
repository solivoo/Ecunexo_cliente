namespace EcuNexo.Core.RemisionGuides;

/// <summary>
/// Estados del ciclo de vida operativo y tributario de una Guía de Remisión (SRI Tipo 06).
/// </summary>
public enum RemisionGuideStatus
{
    Draft = 1,
    Issued = 2,
    Authorized = 3,
    InTransit = 4,
    Delivered = 5,
    Cancelled = 6
}
