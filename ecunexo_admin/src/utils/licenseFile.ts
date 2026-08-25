/** Envelope firmado que acepta la API (`licenseArtifact`). */
export interface SignedLicenseArtifactEnvelope {
  version: number
  payloadBase64Url: string
  signatureBase64Url: string
}

/** Archivo `.ecunexo-license` entregado al cliente. */
export interface EcuNexoLicenseFile {
  format: 'ecunexo-license'
  formatVersion: 1
  issuedAt?: string
  planLabel?: string
  enabledModules?: string[]
  artifact: SignedLicenseArtifactEnvelope
}

export const LICENSE_FILE_EXTENSION = '.ecunexo-license'

export const LICENSE_FILE_ACCEPT =
  '.ecunexo-license,.json,application/json,text/plain'

export type ParsedLicenseFile = {
  artifactJson: string
  planLabel: string | null
  enabledModules: string[] | null
  fileName: string | null
}

function isArtifactEnvelope(value: unknown): value is SignedLicenseArtifactEnvelope {
  if (!value || typeof value !== 'object') {
    return false
  }
  const o = value as Record<string, unknown>
  return (
    typeof o.version === 'number' &&
    typeof o.payloadBase64Url === 'string' &&
    o.payloadBase64Url.length > 0 &&
    typeof o.signatureBase64Url === 'string' &&
    o.signatureBase64Url.length > 0
  )
}

function normalizeArtifactJson(envelope: SignedLicenseArtifactEnvelope): string {
  return JSON.stringify({
    version: envelope.version,
    payloadBase64Url: envelope.payloadBase64Url,
    signatureBase64Url: envelope.signatureBase64Url,
  })
}

/**
 * Extrae el JSON de artefacto firmado desde contenido de archivo o JSON pegado.
 */
export function parseLicenseFileContent(
  rawText: string,
  fileName: string | null = null
): ParsedLicenseFile {
  const trimmed = rawText.trim()
  if (!trimmed) {
    throw new Error('El archivo de licencia está vacío.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed) as unknown
  } catch {
    throw new Error('El archivo no contiene JSON válido.')
  }

  if (isArtifactEnvelope(parsed)) {
    return {
      artifactJson: normalizeArtifactJson(parsed),
      planLabel: null,
      enabledModules: null,
      fileName,
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Formato de licencia no reconocido.')
  }

  const doc = parsed as Record<string, unknown>

  if (doc.format === 'ecunexo-license') {
    if (doc.formatVersion !== 1) {
      throw new Error('Versión de archivo .ecunexo-license no soportada.')
    }
    if (!isArtifactEnvelope(doc.artifact)) {
      throw new Error('El archivo no incluye un artefacto firmado válido.')
    }
    const enabledModules = Array.isArray(doc.enabledModules)
      ? doc.enabledModules.filter((m): m is string => typeof m === 'string')
      : null
    return {
      artifactJson: normalizeArtifactJson(doc.artifact),
      planLabel: typeof doc.planLabel === 'string' ? doc.planLabel : null,
      enabledModules,
      fileName,
    }
  }

  throw new Error(
    'Formato de licencia no reconocido. Usa un archivo .ecunexo-license emitido por Ecunexo.'
  )
}

export async function readLicenseFile(file: File): Promise<ParsedLicenseFile> {
  const maxBytes = 512 * 1024
  if (file.size > maxBytes) {
    throw new Error('El archivo de licencia es demasiado grande.')
  }
  const text = await file.text()
  return parseLicenseFileContent(text, file.name)
}
