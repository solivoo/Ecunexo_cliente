import { useState } from 'react'
import { useToast, FileBox } from 'glubox'
import { X } from 'lucide-react'
import type { TenantMediaAssetDto } from '@/types/catalogApi'

export interface EcuMediaListInputProps {
  readonly media: readonly TenantMediaAssetDto[]
  readonly onChange: (media: TenantMediaAssetDto[]) => void
  readonly onUpload?: (file: File) => Promise<TenantMediaAssetDto>
  readonly onError?: (message: string) => void
  readonly label?: string
  readonly helperText?: string
  readonly disabled?: boolean
  readonly maxItems?: number
}

/**
 * Fotos de atributos de plantilla: miniaturas ya subidas + `FileBox` reorderable de glubox para anexar.
 */
export function EcuMediaListInput({
  media,
  onChange,
  onUpload,
  onError,
  label,
  helperText,
  disabled = false,
  maxItems = 6,
}: EcuMediaListInputProps) {
  const toast = useToast()
  const [uploading, setUploading] = useState(false)
  const [pickerKey, setPickerKey] = useState(0)
  const remaining = Math.max(0, maxItems - media.length)
  const canAdd = !disabled && Boolean(onUpload) && remaining > 0 && !uploading

  const handleRemove = (storageKey: string) => {
    if (disabled) return
    onChange(media.filter((asset) => asset.storageKey !== storageKey))
  }

  const handlePick = async (files: File[]) => {
    if (!onUpload || files.length === 0 || disabled) return
    setUploading(true)
    const accepted = files.slice(0, remaining)
    const next = [...media]
    try {
      for (const file of accepted) {
        const asset = await onUpload(file)
        next.push(asset)
      }
      onChange(next)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo subir la foto.'
      onError?.(message)
      toast.show({ title: 'Error al subir', message, variant: 'error' })
    } finally {
      setUploading(false)
      setPickerKey((k) => k + 1)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
      {label ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--glb-text)' }}>{label}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
            {media.length} / {maxItems}
          </span>
        </div>
      ) : null}

      {media.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {media.map((asset) => (
            <div key={asset.storageKey} style={{ position: 'relative' }}>
              <img
                src={asset.thumbUrl}
                alt=""
                style={{
                  width: '76px',
                  height: '76px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  border: '1px solid var(--shell-border, rgba(0,0,0,0.12))',
                  background: 'var(--glb-surface-variant, rgba(0,0,0,0.03))',
                }}
              />
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => handleRemove(asset.storageKey)}
                  title="Quitar"
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 22,
                    height: 22,
                    borderRadius: '999px',
                    border: 'none',
                    background: 'rgba(15, 23, 42, 0.72)',
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={12} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {canAdd ? (
        <FileBox
          key={pickerKey}
          label={media.length === 0 ? undefined : 'Añadir fotos'}
          labelPosition="outlined"
          variant="outline"
          size="sm"
          reorderable
          accept="image/*"
          maxFiles={remaining}
          maxSize={8 * 1024 * 1024}
          disabled={disabled || uploading}
          fullWidth
          helperText={
            uploading
              ? 'Subiendo…'
              : helperText ?? `Hasta ${remaining} imagen(es). Arrastra para ordenar antes de confirmar.`
          }
          onChange={(files: File[]) => {
            void handlePick(files)
          }}
          onReject={(rejected) => {
            const first = rejected[0]
            if (!first) return
            const reason =
              first.reason === 'size'
                ? 'supera el tamaño máximo'
                : first.reason === 'type'
                  ? 'tipo no permitido'
                  : 'límite de archivos'
            onError?.(`«${first.file.name}» ${reason}.`)
          }}
        />
      ) : null}

      {!canAdd && helperText && media.length === 0 ? (
        <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>{helperText}</span>
      ) : null}
    </div>
  )
}
