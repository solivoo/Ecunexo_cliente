import { useRef, useState, type ChangeEvent } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
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
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const canAdd = !disabled && Boolean(onUpload) && media.length < maxItems

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !onUpload) return

    setUploading(true)
    try {
      const asset = await onUpload(file)
      onChange([...media, asset])
    } catch (err: unknown) {
      onError?.(err instanceof Error ? err.message : 'No se pudo subir la foto.')
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = (storageKey: string) => {
    if (disabled) return
    onChange(media.filter((asset) => asset.storageKey !== storageKey))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--glb-text)' }}>
            {label}
          </label>
          <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
            {media.length} / {maxItems}
          </span>
        </div>
      )}

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
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(asset.storageKey)}
                aria-label="Quitar foto"
                style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: '1px solid var(--shell-border, rgba(0,0,0,0.15))',
                  background: 'var(--glb-surface, #fff)',
                  color: 'var(--glb-danger, #ef4444)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}

        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '8px',
              border: '1px dashed var(--shell-border, rgba(0,0,0,0.25))',
              background: 'transparent',
              color: 'var(--glb-muted, #64748b)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.2rem',
              fontSize: '0.68rem',
              fontWeight: 600,
              cursor: uploading ? 'wait' : 'pointer',
            }}
          >
            {uploading ? <Loader2 size={16} /> : <ImagePlus size={16} />}
            <span>{uploading ? 'Subiendo...' : 'Añadir'}</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(event) => void handleFile(event)}
      />

      {helperText && (
        <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>{helperText}</span>
      )}
    </div>
  )
}
