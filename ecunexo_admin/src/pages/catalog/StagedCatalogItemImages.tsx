import { useState, useRef, type ChangeEvent, type DragEvent } from 'react'
import { Button, Popup, TextBox, useToast } from 'glubox'
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  ExternalLink,
  Image as ImageIcon,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Upload,
} from 'lucide-react'
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
}

const MAX_IMAGES = 8
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024 // 8 MB

export function StagedCatalogItemImages({
  stagedImages,
  onStagedImagesChange,
  disabled = false,
  uploading = false,
  uploadStatus = null,
}: StagedCatalogItemImagesProps) {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Modales
  const [selectedPreview, setSelectedPreview] = useState<StagedItemImage | null>(null)
  const [editingAltImg, setEditingAltImg] = useState<StagedItemImage | null>(null)
  const [altTextValue, setAltTextValue] = useState('')

  const remainingQuota = MAX_IMAGES - stagedImages.length

  const handleAddFiles = (filesList: File[]) => {
    if (!filesList.length || disabled || uploading) return

    if (remainingQuota <= 0) {
      toast.show({
        variant: 'warning',
        message: `Has alcanzado el límite máximo de ${MAX_IMAGES} fotografías.`,
      })
      return
    }

    const filesToProcess = filesList.slice(0, remainingQuota)
    if (filesList.length > remainingQuota) {
      toast.show({
        variant: 'info',
        message: `Solo se agregarán ${remainingQuota} fotos para no superar el límite de ${MAX_IMAGES}.`,
      })
    }

    const newStaged: StagedItemImage[] = []
    let hasMain = stagedImages.some((img) => img.isMain)

    for (const file of filesToProcess) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.show({
          variant: 'error',
          message: `El archivo ${file.name} supera 8 MB y fue descartado.`,
        })
        continue
      }

      if (!file.type.startsWith('image/')) {
        toast.show({
          variant: 'error',
          message: `El archivo ${file.name} no es una imagen válida.`,
        })
        continue
      }

      const previewUrl = URL.createObjectURL(file)
      const isMain = !hasMain
      if (isMain) hasMain = true

      newStaged.push({
        id: `staged-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl,
        altText: '',
        isMain,
      })
    }

    if (newStaged.length > 0) {
      onStagedImagesChange([...stagedImages, newStaged[0], ...newStaged.slice(1)])
      toast.show({
        variant: 'success',
        message: `${newStaged.length} ${newStaged.length === 1 ? 'fotografía anexada' : 'fotografías anexadas'}. Se guardarán con el ítem.`,
      })
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length > 0) {
      handleAddFiles(files)
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && !uploading) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (disabled || uploading) return

    const droppedFiles = Array.from(e.dataTransfer.files ?? []).filter((f) =>
      f.type.startsWith('image/')
    )

    if (droppedFiles.length === 0) {
      toast.show({
        variant: 'error',
        message: 'Por favor arrastra archivos de imagen válidos (JPG, PNG, WebP).',
      })
      return
    }

    handleAddFiles(droppedFiles)
  }

  const handleSetMain = (targetId: string) => {
    if (disabled || uploading) return
    const updated = stagedImages.map((img) => ({
      ...img,
      isMain: img.id === targetId,
    }))
    onStagedImagesChange(updated)
    toast.show({
      variant: 'success',
      message: 'Foto seleccionada como portada principal.',
    })
  }

  const handleMove = (currentIndex: number, direction: -1 | 1) => {
    const targetIndex = currentIndex + direction
    if (targetIndex < 0 || targetIndex >= stagedImages.length || disabled || uploading) return

    const reordered = [...stagedImages]
    const [moved] = reordered.splice(currentIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    onStagedImagesChange(reordered)
  }

  const handleDelete = (targetImg: StagedItemImage) => {
    if (disabled || uploading) return
    URL.revokeObjectURL(targetImg.previewUrl)
    const remaining = stagedImages.filter((img) => img.id !== targetImg.id)

    // Si borró la principal y quedan fotos, marcar la primera como principal
    if (targetImg.isMain && remaining.length > 0) {
      remaining[0] = { ...remaining[0], isMain: true }
    }

    onStagedImagesChange(remaining)
    if (selectedPreview?.id === targetImg.id) {
      setSelectedPreview(null)
    }
    toast.show({
      variant: 'info',
      message: `Fotografía «${targetImg.file.name}» removida.`,
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
    if (disabled || uploading || stagedImages.length >= MAX_IMAGES) return

    const isTouchOrMobile =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

    // En dispositivos táctiles/móviles o si no hay WebRTC seguro (ej. HTTP en red local), abrir cámara nativa
    if (isTouchOrMobile || !navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click()
    } else {
      setIsCameraModalOpen(true)
    }
  }

  return (
    <div className="ecu-product-gallery">
      {/* Banner Informativo con cuota de fotografías */}
      <div className="ecu-product-gallery__banner">
        <div>
          <h4 className="ecu-product-gallery__title">
            Fotografías del Ítem para Catálogo y E-commerce
          </h4>
          <p className="ecu-product-gallery__subtitle">
            Anexa hasta 8 fotografías. Al guardar el ítem se optimizarán automáticamente en formato WebP responsive.
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
            disabled={disabled || uploading || stagedImages.length >= MAX_IMAGES}
            onClick={handleTriggerCamera}
            title="Abrir cámara del dispositivo para capturar foto"
          >
            <Camera size={14} className="mr-1.5" aria-hidden />
            Tomar Foto
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={disabled || uploading || stagedImages.length >= MAX_IMAGES}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} className="mr-1.5" aria-hidden />
            {uploading ? uploadStatus || 'Subiendo...' : 'Añadir Fotos'}
          </Button>
        </div>
      </div>

      {/* Input de archivo invisible nativo (selección múltiple) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={disabled || uploading || stagedImages.length >= MAX_IMAGES}
      />

      {/* Input nativo directo para captura con cámara */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={disabled || uploading || stagedImages.length >= MAX_IMAGES}
      />

      {/* Zona Drag & Drop interactiva */}
      {!disabled && stagedImages.length < MAX_IMAGES && (
        <div
          className={`ecu-product-gallery__dropzone ${
            isDragging ? 'ecu-product-gallery__dropzone--active' : ''
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              fileInputRef.current?.click()
            }
          }}
        >
          <div className="ecu-product-gallery__dropzone-icon">
            <Upload size={22} strokeWidth={2.2} aria-hidden />
          </div>
          <p className="ecu-product-gallery__dropzone-title">
            {isDragging
              ? '¡Suelta las imágenes aquí para anexarlas al nuevo ítem!'
              : 'Arrastra tus fotografías aquí o haz clic para seleccionar'}
          </p>
          <p className="ecu-product-gallery__dropzone-hint">
            Recomendado: imágenes cuadradas 1:1 (mín. 800×800 px) · Formatos WebP, JPG o PNG hasta 8 MB por archivo.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.5rem' }}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || uploading}
              onClick={(e) => {
                e.stopPropagation()
                handleTriggerCamera()
              }}
            >
              <Camera size={14} className="mr-1.5" aria-hidden />
              Tomar Foto
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={disabled || uploading}
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
            >
              <Upload size={14} className="mr-1.5" aria-hidden />
              Seleccionar archivos
            </Button>
          </div>
        </div>
      )}

      {/* Grid de imágenes anexadas */}
      {stagedImages.length === 0 ? (
        <div
          style={{
            padding: '2rem 1rem',
            textAlign: 'center',
            borderRadius: '0.75rem',
            background: 'var(--glb-surface-muted)',
            border: '1px solid var(--shell-border)',
          }}
        >
          <div
            style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '50%',
              background: 'var(--glb-surface)',
              border: '1px solid var(--shell-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem auto',
              color: 'var(--shell-muted)',
            }}
          >
            <ImageIcon size={24} aria-hidden />
          </div>
          <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--shell-text)' }}>
            Sin fotografías anexadas todavía
          </h4>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.75rem', color: 'var(--shell-muted)' }}>
            Puedes guardar el ítem sin imágenes o añadir hasta 8 fotos para la vitrina virtual.
          </p>
          <div style={{ marginTop: '0.85rem' }}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || uploading || stagedImages.length >= MAX_IMAGES}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} className="mr-1.5" aria-hidden />
              Seleccionar fotos
            </Button>
          </div>
        </div>
      ) : (
        <div className="ecu-product-gallery__grid">
          {stagedImages.map((img, index) => {
            const isFirst = index === 0
            const isLast = index === stagedImages.length - 1

            return (
              <div
                key={img.id}
                className={`ecu-product-gallery__card ${
                  img.isMain ? 'ecu-product-gallery__card--main' : ''
                }`}
              >
                {/* Ratio 1:1 Cuadrado */}
                <div className="ecu-product-gallery__thumb-wrap">
                  <img
                    src={img.previewUrl}
                    alt={img.altText || img.file.name}
                    className="ecu-product-gallery__thumb-img"
                  />

                  {/* Badge de Portada */}
                  {img.isMain && (
                    <div className="ecu-product-gallery__main-badge">
                      <Star size={11} className="fill-white" aria-hidden />
                      <span>Portada</span>
                    </div>
                  )}

                  {/* Indicador de posición en carrusel */}
                  <div className="ecu-product-gallery__order-pill" title="Posición en el carrusel">
                    #{index + 1}
                  </div>

                  {/* Overlay de acciones */}
                  <div className="ecu-product-gallery__actions-overlay">
                    <button
                      type="button"
                      title="Ver vista previa"
                      onClick={() => setSelectedPreview(img)}
                      className="ecu-product-gallery__icon-btn"
                    >
                      <ExternalLink size={14} aria-hidden />
                    </button>

                    <button
                      type="button"
                      title="Editar Alt Text (SEO)"
                      onClick={() => {
                        setEditingAltImg(img)
                        setAltTextValue(img.altText || '')
                      }}
                      className="ecu-product-gallery__icon-btn"
                    >
                      <Tag size={14} aria-hidden />
                    </button>

                    {!img.isMain && (
                      <button
                        type="button"
                        title="Hacer Portada Principal"
                        disabled={disabled || uploading}
                        onClick={() => handleSetMain(img.id)}
                        className="ecu-product-gallery__icon-btn ecu-product-gallery__icon-btn--primary"
                      >
                        <Star size={14} aria-hidden />
                      </button>
                    )}

                    <button
                      type="button"
                      title="Quitar fotografía"
                      disabled={disabled || uploading}
                      onClick={() => handleDelete(img)}
                      className="ecu-product-gallery__icon-btn ecu-product-gallery__icon-btn--danger"
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </div>
                </div>

                {/* Metadatos inferiores */}
                <div className="ecu-product-gallery__card-meta">
                  <span className="ecu-product-gallery__card-filename" title={img.file.name}>
                    {img.file.name}
                  </span>
                  <div className="ecu-product-gallery__card-details">
                    <span>{Math.round(img.file.size / 1024)} KB</span>
                    <span>{img.isMain ? 'Portada' : `Foto #${index + 1}`}</span>
                  </div>

                  {/* Botón rápido de Alt Text SEO */}
                  <button
                    type="button"
                    className="ecu-product-gallery__card-alt"
                    onClick={() => {
                      setEditingAltImg(img)
                      setAltTextValue(img.altText || '')
                    }}
                    title="Editar texto alternativo para SEO en Google"
                  >
                    <Tag size={11} aria-hidden />
                    <span>{img.altText ? `Alt: "${img.altText}"` : '+ Añadir Alt Text SEO'}</span>
                  </button>
                </div>

                {/* Controles de reordenamiento */}
                {stagedImages.length > 1 && (
                  <div className="ecu-product-gallery__card-reorder">
                    <span className="ecu-product-gallery__reorder-label">Mover orden</span>
                    <div className="ecu-product-gallery__reorder-actions">
                      <button
                        type="button"
                        className="ecu-product-gallery__reorder-btn"
                        disabled={isFirst || disabled || uploading}
                        onClick={() => handleMove(index, -1)}
                        title="Mover hacia la izquierda"
                      >
                        <ArrowLeft size={13} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ecu-product-gallery__reorder-btn"
                        disabled={isLast || disabled || uploading}
                        onClick={() => handleMove(index, 1)}
                        title="Mover hacia la derecha"
                      >
                        <ArrowRight size={13} aria-hidden />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Popup: Vista Previa Glubox */}
      {selectedPreview && (
        <Popup
          open={true}
          title={`Vista Previa — ${selectedPreview.file.name}`}
          onClose={() => setSelectedPreview(null)}
          width="min(95vw, 36rem)"
          actions={[
            {
              id: 'close',
              label: 'Cerrar',
              variant: 'secondary',
              onClick: () => setSelectedPreview(null),
            },
          ]}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <img
              src={selectedPreview.previewUrl}
              alt={selectedPreview.altText || selectedPreview.file.name}
              style={{
                maxWidth: '100%',
                maxHeight: '60vh',
                objectFit: 'contain',
                borderRadius: '0.5rem',
                border: '1px solid var(--shell-border)',
              }}
            />
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--shell-muted)', textAlign: 'center' }}>
              Archivo original: <strong>{selectedPreview.file.name}</strong> ({Math.round(selectedPreview.file.size / 1024)} KB).
              Se procesará y optimizará automáticamente en WebP al guardar el ítem.
            </p>
          </div>
        </Popup>
      )}

      {/* Modal Popup: Edición de Alt Text (SEO Google) */}
      {editingAltImg && (
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
              El texto alternativo describe la imagen para lectores de pantalla y ayuda a posicionar tu producto en Google Imágenes.
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
      )}

      {/* Modal de Captura de Fotografía con Cámara */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={(file) => handleAddFiles([file])}
        onFallbackNative={() => cameraInputRef.current?.click()}
      />
    </div>
  )
}
