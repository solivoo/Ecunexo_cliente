import { useState, useRef, useMemo, type ChangeEvent, type DragEvent } from 'react'
import { Button, Popup, TextBox, useToast } from 'glubox'
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Image as ImageIcon,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  deleteCatalogItemImage,
  reorderCatalogItemImages,
  setCatalogItemMainImage,
  updateCatalogItemImageAltText,
  uploadCatalogItemImage,
} from '@/services/catalogApi'
import { readApiError } from '@/lib/readApiError'
import type { CatalogItemImageDto } from '@/types/catalogApi'
import './catalog-item-image-gallery.css'

export type CatalogItemImageGalleryProps = {
  readonly tenantId: string
  readonly itemId: string
  readonly images: CatalogItemImageDto[]
  readonly canEdit: boolean
  readonly onImagesChanged: () => Promise<void>
}

const MAX_IMAGES = 8

export function CatalogItemImageGallery({
  tenantId,
  itemId,
  images,
  canEdit,
  onImagesChanged,
}: CatalogItemImageGalleryProps) {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Estados de carga y progreso
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Modales
  const [selectedPreview, setSelectedPreview] = useState<CatalogItemImageDto | null>(null)
  const [editingAltImg, setEditingAltImg] = useState<CatalogItemImageDto | null>(null)
  const [altTextValue, setAltTextValue] = useState('')
  const [savingAlt, setSavingAlt] = useState(false)

  const sortedImages = useMemo(() => {
    return [...images].sort((a, b) => a.displayOrder - b.displayOrder)
  }, [images])

  // Subida múltiple (bulk upload)
  const uploadFiles = async (filesList: File[]) => {
    if (!filesList.length || !canEdit) return

    const remainingQuota = MAX_IMAGES - sortedImages.length
    if (remainingQuota <= 0) {
      toast.show({
        variant: 'warning',
        message: `Has alcanzado el límite máximo de ${MAX_IMAGES} imágenes para este producto.`,
      })
      return
    }

    const filesToUpload = filesList.slice(0, remainingQuota)
    if (filesList.length > remainingQuota) {
      toast.show({
        variant: 'info',
        message: `Solo se procesarán ${remainingQuota} imágenes para no superar el límite de ${MAX_IMAGES}.`,
      })
    }

    // Filtrar archivos > 8 MB
    const validFiles = filesToUpload.filter((f) => {
      if (f.size > 8 * 1024 * 1024) {
        toast.show({
          variant: 'error',
          message: `El archivo ${f.name} supera el límite de 8 MB y fue descartado.`,
        })
        return false
      }
      return true
    })

    if (!validFiles.length) return

    setUploading(true)
    let countSuccess = 0

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]
      setUploadStatus(`Optimizando WebP ${i + 1} de ${validFiles.length}...`)
      try {
        await uploadCatalogItemImage(tenantId, itemId, file)
        countSuccess++
      } catch (err) {
        toast.show({
          variant: 'error',
          message: readApiError(err, `Error al subir ${file.name}`),
        })
      }
    }

    setUploading(false)
    setUploadStatus(null)

    if (countSuccess > 0) {
      toast.show({
        variant: 'success',
        message: `${countSuccess} ${countSuccess === 1 ? 'imagen optimizada' : 'imágenes optimizadas'} en WebP correctamente.`,
      })
      await onImagesChanged()
    }
  }

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length > 0) {
      await uploadFiles(files)
    }
  }

  // Manejadores de Drag & Drop
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (canEdit && !uploading) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (!canEdit || uploading) return

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

    await uploadFiles(droppedFiles)
  }

  // Establecer como imagen principal
  const handleSetMain = async (img: CatalogItemImageDto) => {
    if (img.isMain || busyId || !canEdit) return
    setBusyId(img.id)
    try {
      await setCatalogItemMainImage(tenantId, itemId, img.id)
      toast.show({
        variant: 'success',
        message: 'Imagen seleccionada como portada principal de la tienda.',
      })
      await onImagesChanged()
    } catch (err) {
      toast.show({
        variant: 'error',
        message: readApiError(err, 'No fue posible cambiar la imagen principal.'),
      })
    } finally {
      setBusyId(null)
    }
  }

  // Reordenar imagen (Mover izquierda / derecha)
  const handleMove = async (currentIndex: number, direction: -1 | 1) => {
    const targetIndex = currentIndex + direction
    if (targetIndex < 0 || targetIndex >= sortedImages.length || busyId || !canEdit) return

    const currentImg = sortedImages[currentIndex]
    setBusyId(currentImg.id)

    const reordered = [...sortedImages]
    const [moved] = reordered.splice(currentIndex, 1)
    reordered.splice(targetIndex, 0, moved)

    const imageIds = reordered.map((img) => img.id)

    try {
      await reorderCatalogItemImages(tenantId, itemId, imageIds)
      toast.show({
        variant: 'success',
        message: 'Orden del carrusel e-commerce actualizado.',
      })
      await onImagesChanged()
    } catch (err) {
      toast.show({
        variant: 'error',
        message: readApiError(err, 'No fue posible reordenar las imágenes.'),
      })
    } finally {
      setBusyId(null)
    }
  }

  // Eliminar imagen
  const handleDelete = async (img: CatalogItemImageDto) => {
    if (busyId || !canEdit) return
    setBusyId(img.id)
    try {
      await deleteCatalogItemImage(tenantId, itemId, img.id)
      toast.show({
        variant: 'success',
        message: 'Imagen eliminada correctamente.',
      })
      if (selectedPreview?.id === img.id) {
        setSelectedPreview(null)
      }
      await onImagesChanged()
    } catch (err) {
      toast.show({
        variant: 'error',
        message: readApiError(err, 'No fue posible eliminar la imagen.'),
      })
    } finally {
      setBusyId(null)
    }
  }

  // Guardar Alt Text (SEO)
  const handleSaveAltText = async () => {
    if (!editingAltImg || !tenantId) return
    setSavingAlt(true)
    try {
      await updateCatalogItemImageAltText(tenantId, itemId, editingAltImg.id, altTextValue.trim())
      toast.show({
        variant: 'success',
        message: 'Texto alternativo SEO actualizado.',
      })
      setEditingAltImg(null)
      await onImagesChanged()
    } catch (err) {
      toast.show({
        variant: 'error',
        message: readApiError(err, 'No fue posible actualizar el texto alternativo.'),
      })
    } finally {
      setSavingAlt(false)
    }
  }

  return (
    <div className="ecu-product-gallery">
      {/* Banner Informativo con cuota e-commerce */}
      <div className="ecu-product-gallery__banner">
        <div>
          <h4 className="ecu-product-gallery__title">
            Galería E-commerce & Catálogo Digital
          </h4>
          <p className="ecu-product-gallery__subtitle">
            Compresión automática a WebP Full HD en 3 variantes responsive (Thumb 200px, Medium 800px, Large 1600px).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span className="ecu-product-gallery__count-badge">
            <Sparkles size={13} style={{ color: 'var(--shell-primary)' }} aria-hidden />
            {sortedImages.length} de {MAX_IMAGES} fotos
          </span>

          {canEdit && (
            <Button
              variant="primary"
              size="sm"
              disabled={uploading || sortedImages.length >= MAX_IMAGES}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} className="mr-1.5" aria-hidden />
              {uploading ? uploadStatus || 'Subiendo...' : 'Añadir Fotos'}
            </Button>
          )}
        </div>
      </div>

      {/* Input invisible nativo con soporte multi-archivo */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={uploading || sortedImages.length >= MAX_IMAGES}
      />

      {/* Zona Drag & Drop interactiva */}
      {canEdit && sortedImages.length < MAX_IMAGES && (
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
              ? '¡Suelta las imágenes aquí para subirlas en bloque!'
              : 'Arrastra tus fotografías aquí o haz clic para seleccionar varias'}
          </p>
          <p className="ecu-product-gallery__dropzone-hint">
            Recomendado: relación 1:1 cuadrada (mín. 800×800 px) · Formatos WebP, JPG o PNG hasta 8 MB por archivo.
          </p>
        </div>
      )}

      {/* Grid de imágenes de producto */}
      {sortedImages.length === 0 ? (
        <div
          style={{
            padding: '2.5rem 1rem',
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
            Sin imágenes de producto aún
          </h4>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.75rem', color: 'var(--shell-muted)' }}>
            Las fotos que subas aquí definirán la portada y el carrusel interactivo en tu tienda online.
          </p>
        </div>
      ) : (
        <div className="ecu-product-gallery__grid">
          {sortedImages.map((img, index) => {
            const isBusy = busyId === img.id
            const isFirst = index === 0
            const isLast = index === sortedImages.length - 1

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
                    src={img.mediumUrl}
                    alt={img.altText || img.originalFileName}
                    className="ecu-product-gallery__thumb-img"
                    loading="lazy"
                  />

                  {/* Badge de Portada */}
                  {img.isMain && (
                    <div className="ecu-product-gallery__main-badge">
                      <Star size={11} className="fill-white" aria-hidden />
                      <span>Portada</span>
                    </div>
                  )}

                  {/* Píldora con orden en el carrusel */}
                  <div className="ecu-product-gallery__order-pill" title="Posición en el carrusel de la tienda">
                    #{index + 1}
                  </div>

                  {/* Overlay de acciones */}
                  <div className="ecu-product-gallery__actions-overlay">
                    <button
                      type="button"
                      title="Ver variantes y zoom"
                      onClick={() => setSelectedPreview(img)}
                      className="ecu-product-gallery__icon-btn"
                    >
                      <ExternalLink size={14} aria-hidden />
                    </button>

                    {canEdit && (
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
                    )}

                    {canEdit && !img.isMain && (
                      <button
                        type="button"
                        title="Hacer Portada Principal"
                        disabled={isBusy}
                        onClick={() => handleSetMain(img)}
                        className="ecu-product-gallery__icon-btn ecu-product-gallery__icon-btn--primary"
                      >
                        <Star size={14} aria-hidden />
                      </button>
                    )}

                    {canEdit && (
                      <button
                        type="button"
                        title="Eliminar fotografía"
                        disabled={isBusy}
                        onClick={() => handleDelete(img)}
                        className="ecu-product-gallery__icon-btn ecu-product-gallery__icon-btn--danger"
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    )}
                  </div>
                </div>

                {/* Metadatos inferiores */}
                <div className="ecu-product-gallery__card-meta">
                  <span className="ecu-product-gallery__card-filename" title={img.originalFileName}>
                    {img.originalFileName}
                  </span>
                  <div className="ecu-product-gallery__card-details">
                    <span>{img.originalWidth}×{img.originalHeight} px</span>
                    <span>{Math.round(img.fileSizeBytes / 1024)} KB</span>
                  </div>

                  {/* Botón rápido de Alt Text SEO */}
                  <button
                    type="button"
                    className="ecu-product-gallery__card-alt"
                    onClick={() => {
                      if (!canEdit) return
                      setEditingAltImg(img)
                      setAltTextValue(img.altText || '')
                    }}
                    title="Editar texto alternativo para SEO en Google"
                  >
                    <Tag size={11} aria-hidden />
                    <span>{img.altText ? `Alt: "${img.altText}"` : '+ Añadir Alt Text SEO'}</span>
                  </button>
                </div>

                {/* Controles de reordenamiento para carrusel */}
                {canEdit && sortedImages.length > 1 && (
                  <div className="ecu-product-gallery__card-reorder">
                    <span className="ecu-product-gallery__reorder-label">
                      Mover posición
                    </span>
                    <div className="ecu-product-gallery__reorder-actions">
                      <button
                        type="button"
                        className="ecu-product-gallery__reorder-btn"
                        disabled={isFirst || isBusy}
                        onClick={() => handleMove(index, -1)}
                        title="Mover hacia la izquierda"
                      >
                        <ArrowLeft size={13} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ecu-product-gallery__reorder-btn"
                        disabled={isLast || isBusy}
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

      {/* Modal Popup: Variantes Optimizadas Responsive (Glubox) */}
      {selectedPreview && (
        <Popup
          open={true}
          title={`Variantes WebP — ${selectedPreview.originalFileName}`}
          onClose={() => setSelectedPreview(null)}
          width="min(95vw, 44rem)"
          actions={[
            {
              id: 'close',
              label: 'Cerrar',
              variant: 'secondary',
              onClick: () => setSelectedPreview(null),
            },
          ]}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--shell-muted)' }}>
              Resolución original: <strong>{selectedPreview.originalWidth}×{selectedPreview.originalHeight} px</strong> · {Math.round(selectedPreview.fileSizeBytes / 1024)} KB.
              El backend genera 3 cortes WebP optimizados para desktop, mobile y zoom.
            </p>

            <div className="ecu-variant-preview-grid">
              <div className="ecu-variant-preview-card">
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--shell-text)' }}>
                  Thumbnail (200px)
                </span>
                <div className="ecu-variant-preview-card__img-wrap">
                  <img
                    src={selectedPreview.thumbUrl}
                    alt="Thumb"
                    className="ecu-variant-preview-card__img"
                  />
                </div>
                <a
                  href={selectedPreview.thumbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glb-btn glb-btn--outline glb-btn--sm"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <ExternalLink size={12} />
                  Abrir WebP
                </a>
              </div>

              <div className="ecu-variant-preview-card">
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--shell-text)' }}>
                  Catálogo (800px)
                </span>
                <div className="ecu-variant-preview-card__img-wrap">
                  <img
                    src={selectedPreview.mediumUrl}
                    alt="Medium"
                    className="ecu-variant-preview-card__img"
                  />
                </div>
                <a
                  href={selectedPreview.mediumUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glb-btn glb-btn--outline glb-btn--sm"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <ExternalLink size={12} />
                  Abrir WebP
                </a>
              </div>

              <div className="ecu-variant-preview-card">
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--shell-text)' }}>
                  Zoom HD (1600px)
                </span>
                <div className="ecu-variant-preview-card__img-wrap">
                  <img
                    src={selectedPreview.largeUrl}
                    alt="Large"
                    className="ecu-variant-preview-card__img"
                  />
                </div>
                <a
                  href={selectedPreview.largeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glb-btn glb-btn--outline glb-btn--sm"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <ExternalLink size={12} />
                  Abrir WebP
                </a>
              </div>
            </div>
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
              disabled: savingAlt,
            },
            {
              id: 'save-alt',
              label: savingAlt ? 'Guardando...' : 'Guardar Alt Text',
              variant: 'primary',
              onClick: () => void handleSaveAltText(),
              disabled: savingAlt,
              loading: savingAlt,
            },
          ]}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--shell-muted)' }}>
              El texto alternativo describe la imagen para lectores de pantalla y ayuda a que tu producto aparezca en los resultados de Google Imágenes.
            </p>

            <TextBox
              id="alt-text-input"
              label="Texto Alternativo (Alt Text)"
              labelPosition="outlined"
              variant="outline"
              value={altTextValue}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAltTextValue(e.target.value)}
              placeholder="Ej. Lavadora Whirlpool 19kg frontal vista abierta con tambor inox"
              fullWidth
            />
          </div>
        </Popup>
      )}
    </div>
  )
}
