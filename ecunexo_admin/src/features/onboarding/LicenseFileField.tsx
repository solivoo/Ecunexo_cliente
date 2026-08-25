import { useCallback, useId, useState } from 'react'
import { FileBox } from 'glubox'
import {
  LICENSE_FILE_ACCEPT,
  readLicenseFile,
  type ParsedLicenseFile,
} from '@/utils/licenseFile'

export interface LicenseFileFieldProps {
  readonly disabled?: boolean
  readonly onLoaded: (parsed: ParsedLicenseFile) => void
  readonly onClear: () => void
}

export function LicenseFileField({ disabled, onLoaded, onClear }: LicenseFileFieldProps) {
  const inputId = useId()
  const [files, setFiles] = useState<File[]>([])
  const [planLabel, setPlanLabel] = useState<string | null>(null)
  const [modules, setModules] = useState<string[] | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)

  const resetMeta = useCallback(() => {
    setPlanLabel(null)
    setModules(null)
    setFieldError(null)
  }, [])

  const handleChange = useCallback(
    async (next: File[]) => {
      setFiles(next)
      const file = next[0]
      if (!file) {
        resetMeta()
        onClear()
        return
      }

      setFieldError(null)
      try {
        const parsed = await readLicenseFile(file)
        setPlanLabel(parsed.planLabel)
        setModules(parsed.enabledModules)
        onLoaded(parsed)
      } catch (err: unknown) {
        setFiles([])
        resetMeta()
        onClear()
        setFieldError(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
      }
    },
    [onClear, onLoaded, resetMeta]
  )

  return (
    <div className="welcome-onboarding__file-field">
      <FileBox
        id={inputId}
        label="Archivo de licencia"
        labelPosition="outlined"
        variant="outline"
        size="md"
        displayMode="dropzone"
        accept={LICENSE_FILE_ACCEPT}
        multiple={false}
        value={files}
        onChange={(next) => void handleChange(next)}
        onReject={(rejected) => {
          const reason = rejected[0]?.reason
          setFieldError(
            reason === 'type'
              ? 'El archivo debe ser .ecunexo-license o JSON válido.'
              : reason === 'size'
                ? 'El archivo supera el tamaño permitido.'
                : 'No se pudo adjuntar el archivo.'
          )
        }}
        placeholder="Arrastra o selecciona tu archivo .ecunexo-license"
        buttonLabel="Elegir archivo"
        helperText={
          planLabel || (modules && modules.length > 0)
            ? [
                planLabel ? `Plan: ${planLabel}` : null,
                modules && modules.length > 0 ? `Módulos: ${modules.join(', ')}` : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : 'Usa el archivo .ecunexo-license que te envió Ecunexo.'
        }
        errorMessage={fieldError ?? undefined}
        disabled={disabled}
        fullWidth
      />
    </div>
  )
}
