import { useRef, useState, type ChangeEvent } from 'react'
import { Button, Popup, TextBox, useToast, FileBox } from 'glubox'
import { Camera, Sparkles, Star, Tag } from 'lucide-react'
import { CameraCaptureModal } from './CameraCaptureModal'
import './catalog-item-image-gallery.css'

export interface StagedItemImage {
  id: string
  file: File
  previewUrl: string
  altText: string
  isMain: boolean
}

export interface StagedCatalogItemImagesProps {
  readonly stagedImages: StagedItemImage[]
  readonly onStagedImagesChange: (images: StagedItemImage[]) => void
  readonly disabled?: boolean
  readonly uploading?: boolean
  readonly uploadStatus?: string | null
  readonly hideBanner?: boolean
}

const MAX_IMAGES = 8
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024 // 8 MB

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

function syncStagedFromFiles(
  previous: StagedItemImage[],
  files: File[]
): StagedItemImage[] {
  const prevByKey = new Map(previous.map((img) => [fileKey(img.file), img]))
  const usedIds = new Set<string>()
  const next: StagedItemImage[] = []

  for (const file of files) {
    const key = fileKey(file)
    const prev = prevByKey.get(key)
    if (prev && !usedIds.has(prev.id)) {
      usedIds.add(prev.id)
      next.push({ ...prev, file, isMain: false })
      continue
    }

    next.push({
      id: `staged-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      altText: '',
      isMain: false,
    })
  }

  for (const old of previous) {
    if (!next.some((img) => img.id === old.id)) {
      URL.revokeObjectURL(old.previewUrl)
    }
  }

  if (next.length > 0) {
    next[0] = { ...next[0], isMain: true }
  }

  return next
}

/**
 * Galería de fotos al crear ítem: `FileBox` reorderable de glubox (miniaturas + drag).
 */
export function StagedCatalogItemImages({
  stagedImages,
  onStagedImagesChange,
  disabled = false,
  uploading = false,
  uploadStatus = null,
  hideBanner = false,
}: StagedCatalogItemImagesProps) {
  const toast = useToast()
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false)
  const [editingAltImg, setEditingAltImg] = useState<StagedItemImage | null>(null)
  const [altTextValue, setAltTextValue] = useState('')

  const busy = disabled || uploading

  const applyFiles = (files: File[], announceAdd = false) => {
    const prevCount = stagedImages.length
    const next = syncStagedFromFiles(stagedImages, files.slice(0, MAX_IMAGES))
    onStagedImagesChange(next)

    if (announceAdd && next.length > prevCount) {
      const added = next.length - prevCount
      toast.show({
        variant: 'success',
        message: `${added} ${added === 1 ? 'fotografía anexada' : 'fotografías anexadas'}. Se guardarán con el ítem.`,
      })
    }
  }

  const handleFileBoxChange = (files: File[]) => {
    if (busy) return
    applyFiles(files, files.length > stagedImages.length)
  }

  const handleAddFiles = (filesList: File[]) => {
    if (!filesList.length || busy) return
    applyFiles([...stagedImages.map((s) => s.file), ...filesList], true)
  }

  const handleSetMain = (targetId: string) => {
    if (busy) return
    const target = stagedImages.find((img) => img.id === targetId)
    if (!target) return

    const reordered = [
      { ...target, isMain: true },
      ...stagedImages.filter((img) => img.id !== targetId).map((img) => ({ ...img, isMain: false })),
    ]
    onStagedImagesChange(reordered)
    toast.show({
      variant: 'success',
      message: 'Foto seleccionada como portada principal (primera en la lista).',
    })
  }

  const handleSaveAltText = () => {
    if (!editingAltImg) return
    const updated = stagedImages.map((img) =>
      img.id === editingAltImg.id ? { ...img, altText: altTextValue.trim() } : img
    )
    onStagedImagesChange(updated)
    setEditingAltImg(null)
    toast.show({
      variant: 'success',
      message: 'Texto alternativo para SEO actualizado.',
    })
  }

  const handleTriggerCamera = () => {
    if (busy || stagedImages.length >= MAX_IMAGES) return

    const isTouchOrMobile =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

    if (isTouchOrMobile || !navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click()
    } else {
      setIsCameraModalOpen(true)
    }
  }

  return (
    <div className="ecu-product-gallery">
      {!hideBanner ? (
        <div className="ecu-product-gallery__banner">
          <div>
            <h4 className="ecu-product-gallery__title">
              Fotografías para Vitrina y E-commerce
            </h4>
            <p className="ecu-product-gallery__subtitle">
              Anexa hasta 8 fotografías. Arrastra las miniaturas para ordenar; la primera es la portada.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span className="ecu-product-gallery__count-badge">
              <Sparkles size={13} style={{ color: 'var(--shell-primary)' }} aria-hidden />
              {stagedImages.length} de {MAX_IMAGES} fotos
            </span>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || stagedImages.length >= MAX_IMAGES}
              onClick={handleTriggerCamera}
              title="Abrir cámara del dispositivo para capturar foto"
            >
              <Camera size={14} className="mr-1.5" aria-hidden />
              Tomar Foto
            </Button>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.65rem',
            marginBottom: '0.65rem',
            flexWrap: 'wrap',
          }}
        >
          <span className="ecu-product-gallery__count-badge">
            <Sparkles size={13} style={{ color: 'var(--shell-primary)' }} aria-hidden />
            {stagedImages.length} de {MAX_IMAGES} fotos
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || stagedImages.length >= MAX_IMAGES}
            onClick={handleTriggerCamera}
          >
            <Camera size={14} className="mr-1.5" aria-hidden />
            Tomar Foto
          </Button>
        </div>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length > 0) handleAddFiles(files)
        }}
        disabled={busy || stagedImages.length >= MAX_IMAGES}
      />

      <FileBox
        label={hideBanner ? undefined : 'Imágenes del producto'}
        labelPosition="outlined"
        variant="outline"
        size="sm"
        reorderable
        accept="image/jpeg,image/png,image/webp,image/*"
        maxFiles={MAX_IMAGES}
        maxSize={MAX_FILE_SIZE_BYTES}
        value={stagedImages.map((img) => img.file)}
        onChange={handleFileBoxChange}
        disabled={busy}
        fullWidth
        helperText={
          uploading
            ? uploadStatus || 'Subiendo…'
            : 'JPG, PNG o WebP · máx. 8 MB · arrastra para reordenar · la primera es portada'
        }
        onReject={(rejected) => {
          const first = rejected[0]
          if (!first) return
          const reason =
            first.reason === 'size'
              ? 'supera 8 MB'
              : first.reason === 'type'
                ? 'no es una imagen válida'
                : `excede el límite de ${MAX_IMAGES} fotos`
          toast.show({
            variant: 'error',
            message: `«${first.file.name}» ${reason}.`,
          })
        }}
      />

      {stagedImages.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            marginTop: '0.75rem',
          }}
        >
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--glb-text)' }}>
            Portada y texto alternativo (SEO)
          </span>
          {stagedImages.map((img, index) => (
            <div
              key={img.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.55rem',
                padding: '0.4rem 0.55rem',
                borderRadius: 8,
                border: '1px solid var(--shell-border, rgba(0,0,0,0.1))',
                background: img.isMain
                  ? 'color-mix(in srgb, var(--shell-primary, #3b82f6) 6%, transparent)'
                  : 'var(--glb-surface, #fff)',
              }}
            >
              <img
                src={img.previewUrl}
                alt=""
                style={{
                  width: 40,
                  height: 40,
                  objectFit: 'cover',
                  borderRadius: 6,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--glb-text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={img.file.name}
                >
                  #{index + 1} · {img.file.name}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--glb-muted)' }}>
                  {img.altText ? `Alt: ${img.altText}` : 'Sin texto alternativo'}
                </div>
              </div>
              {!img.isMain ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => handleSetMain(img.id)}
                  title="Hacer portada (mueve a la primera posición)"
                >
                  <Star size={14} />
                </Button>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: 'var(--shell-primary)',
                  }}
                >
                  <Star size={12} /> Portada
                </span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setEditingAltImg(img)
                  setAltTextValue(img.altText || '')
                }}
                title="Editar Alt Text (SEO)"
              >
                <Tag size={14} />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {editingAltImg ? (
        <Popup
          open={true}
          title="Texto Alternativo (SEO & Accesibilidad)"
          onClose={() => setEditingAltImg(null)}
          width="min(92vw, 30rem)"
          actions={[
            {
              id: 'cancel-alt',
              label: 'Cancelar',
              variant: 'ghost',
              onClick: () => setEditingAltImg(null),
            },
            {
              id: 'save-alt',
              label: 'Guardar Alt Text',
              variant: 'primary',
              onClick: () => handleSaveAltText(),
            },
          ]}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--shell-muted)' }}>
              El texto alternativo describe la imagen para lectores de pantalla y ayuda a
              posicionar tu producto en Google Imágenes.
            </p>

            <TextBox
              id="alt-text-staged-input"
              label="Texto Alternativo (Alt Text)"
              labelPosition="outlined"
              variant="outline"
              value={altTextValue}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAltTextValue(e.target.value)}
              placeholder="Ej. Zapato deportivo de cuero negro talla 42"
              fullWidth
            />
          </div>
        </Popup>
      ) : null}

      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={(file) => handleAddFiles([file])}
        onFallbackNative={() => cameraInputRef.current?.click()}
      />
    </div>
  )
}
