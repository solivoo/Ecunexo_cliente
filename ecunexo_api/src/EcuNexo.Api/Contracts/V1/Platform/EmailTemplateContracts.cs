namespace EcuNexo.Api.Contracts.V1.Platform;

public sealed record EmailTemplateDto(
    string ActionCode,
    string ActionName,
    string Description,
    string SubjectTemplate,
    string BodyHtmlTemplate,
    bool IsCustom,
    IReadOnlyList<string> AvailablePlaceholders);

public sealed record UpdateEmailTemplateRequest(
    string SubjectTemplate,
    string BodyHtmlTemplate);

public sealed record PreviewEmailTemplateRequest(
    string ActionCode,
    string? SubjectTemplate = null,
    string? BodyHtmlTemplate = null);

public sealed record PreviewEmailTemplateResponse(
    string RenderedSubject,
    string RenderedHtmlBody);
