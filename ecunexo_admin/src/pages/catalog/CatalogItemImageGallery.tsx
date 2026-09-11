import { useState, useRef, type ChangeEvent } from 'react'
import { Button, useToast } from 'glubox'
import { Star, Trash2, Upload, Image as ImageIcon, ExternalLink } from 'lucide-react'
import {
  deleteCatalogItemImage,
  setCatalogItemMainImage,
  uploadCatalogItemImage,
} from '@/services/catalogApi'
import { readApiError } from '@/lib/readApiError'
import type { CatalogItemImageDto } from '@/types/catalogApi'

export type CatalogItemImageGalleryProps = {
  readonly tenantId: string
  readonly itemId: string
  readonly images: CatalogItemImageDto[]
  readonly canEdit: boolean
  readonly onImagesChanged: () => Promise<void>
}

export function CatalogItemImageGallery({
  tenantId,
  itemId,
  images,
  canEdit,
  onImagesChanged,
}: CatalogItemImageGalleryProps) {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedPreview, setSelectedPreview] = useState<CatalogItemImageDto | null>(null)

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Limpiar input para permitir re-selección del mismo archivo
    e.target.value = ''

    // Validación preliminar en cliente
    if (file.size > 8 * 1024 * 1024) {
      toast.show({
        variant: 'error',
        message: 'El archivo supera el límite máximo de 8 MB.',
      })
      return
    }

    setUploading(true)
    try {
      await uploadCatalogItemImage(tenantId, itemId, file)
      toast.show({
        variant: 'success',
        message: 'Imagen procesada y optimizada en WebP correctamente.',
      })
      await onImagesChanged()
    } catch (err) {
      toast.show({
        variant: 'error',
        message: readApiError(err, 'No fue posible subir la imagen.'),
      })
    } finally {
      setUploading(false)
    }
  }

  const handleSetMain = async (img: CatalogItemImageDto) => {
    if (img.isMain || busyId || !canEdit) return
    setBusyId(img.id)
    try {
      await setCatalogItemMainImage(tenantId, itemId, img.id)
      toast.show({
        variant: 'success',
        message: 'Imagen establecida como principal del producto.',
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

  const sortedImages = [...images].sort((a, b) => a.displayOrder - b.displayOrder)

  return (
    <div className="space-y-4">
      {/* Encabezado con métricas y botón de subida */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[var(--glb-surface-muted)] rounded-lg border border-[var(--shell-border)]">
        <div className="text-sm">
          <p className="font-medium text-[var(--glb-text)]">
            Galería E-commerce ({sortedImages.length} de 8 imágenes permitidas)
          </p>
          <p className="text-xs text-[var(--glb-muted)] mt-0.5">
            Optimización automática a WebP (82% calidad) en 3 tamaños (200px, 800px, 1600px).
          </p>
        </div>

        {canEdit && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading || sortedImages.length >= 8}
            />
            <Button
              variant="primary"
              size="sm"
              disabled={uploading || sortedImages.length >= 8}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={15} className="mr-1.5 inline" />
              {uploading ? 'Procesando WebP...' : 'Subir imagen'}
            </Button>
          </div>
        )}
      </div>

      {/* Grid de imágenes */}
      {sortedImages.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-[var(--shell-border)] rounded-xl">
          <div className="w-12 h-12 rounded-full bg-[var(--glb-surface-muted)] flex items-center justify-center mb-3 text-[var(--glb-muted)]">
            <ImageIcon size={24} />
          </div>
          <p className="text-sm font-medium text-[var(--glb-text)]">Sin imágenes de producto</p>
          <p className="text-xs text-[var(--glb-muted)] mt-1 max-w-sm">
            Sube fotos en alta resolución (mín. 400x400 px, máx. 8 MB). Serán comprimidas y adaptadas para catálogo y tienda online.
          </p>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} className="mr-1.5 inline" />
              Seleccionar archivo
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {sortedImages.map((img) => {
            const isBusy = busyId === img.id
            return (
              <div
                key={img.id}
                className={`group relative flex flex-col rounded-xl overflow-hidden border bg-[var(--glb-surface)] transition-all ${
                  img.isMain
                    ? 'border-amber-500 shadow-sm ring-2 ring-amber-500/20'
                    : 'border-[var(--shell-border)] hover:border-[var(--glb-primary)]'
                }`}
              >
                {/* Contenedor de la imagen cuadrada */}
                <div className="relative aspect-square w-full bg-[var(--glb-surface-muted)] overflow-hidden">
                  <img
                    src={img.mediumUrl}
                    alt={img.altText || img.originalFileName}
                    className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Badge de imagen principal */}
                  {img.isMain && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow">
                      <Star size={10} className="fill-white" />
                      <span>Principal</span>
                    </div>
                  )}

                  {/* Overlay de acciones hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      title="Ver variantes"
                      onClick={() => setSelectedPreview(img)}
                      className="p-2 rounded-full bg-white/90 text-slate-800 hover:bg-white transition-colors"
                    >
                      <ExternalLink size={14} />
                    </button>

                    {canEdit && !img.isMain && (
                      <button
                        type="button"
                        title="Marcar como Principal"
                        disabled={isBusy}
                        onClick={() => handleSetMain(img)}
                        className="p-2 rounded-full bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                      >
                        <Star size={14} />
                      </button>
                    )}

                    {canEdit && (
                      <button
                        type="button"
                        title="Eliminar imagen"
                        disabled={isBusy}
                        onClick={() => handleDelete(img)}
                        className="p-2 rounded-full bg-rose-600 text-white hover:bg-rose-700 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Info inferior de la tarjeta */}
                <div className="p-2.5 text-xs flex flex-col gap-0.5 border-t border-[var(--shell-border)]">
                  <p className="font-medium text-[var(--glb-text)] truncate" title={img.originalFileName}>
                    {img.originalFileName}
                  </p>
                  <p className="text-[11px] text-[var(--glb-muted)] flex items-center justify-between">
                    <span>{img.originalWidth}×{img.originalHeight} px</span>
                    <span>{Math.round(img.fileSizeBytes / 1024)} KB</span>
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de previsualización técnica de variantes */}
      {selectedPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedPreview(null)}
        >
          <div
            className="bg-[var(--glb-surface)] rounded-2xl max-w-2xl w-full p-5 border border-[var(--shell-border)] shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--glb-text)]">
                  Variantes Optimizadas — {selectedPreview.originalFileName}
                </h3>
                <p className="text-xs text-[var(--glb-muted)]">
                  Resolución original: {selectedPreview.originalWidth}×{selectedPreview.originalHeight} px
                </p>
              </div>
              <button
                type="button"
                className="text-sm font-medium text-[var(--glb-muted)] hover:text-[var(--glb-text)]"
                onClick={() => setSelectedPreview(null)}
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-[var(--glb-surface-muted)] rounded-xl border border-[var(--shell-border)] text-center space-y-2">
                <p className="text-xs font-semibold text-[var(--glb-text)]">Thumb (200px)</p>
                <div className="h-32 flex items-center justify-center">
                  <img
                    src={selectedPreview.thumbUrl}
                    alt="Thumb"
                    className="max-h-full max-w-full object-contain rounded"
                  />
                </div>
                <a
                  href={selectedPreview.thumbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[var(--glb-primary)] hover:underline block truncate"
                >
                  Abrir WebP
                </a>
              </div>

              <div className="p-3 bg-[var(--glb-surface-muted)] rounded-xl border border-[var(--shell-border)] text-center space-y-2">
                <p className="text-xs font-semibold text-[var(--glb-text)]">Medium (800px)</p>
                <div className="h-32 flex items-center justify-center">
                  <img
                    src={selectedPreview.mediumUrl}
                    alt="Medium"
                    className="max-h-full max-w-full object-contain rounded"
                  />
                </div>
                <a
                  href={selectedPreview.mediumUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[var(--glb-primary)] hover:underline block truncate"
                >
                  Abrir WebP
                </a>
              </div>

              <div className="p-3 bg-[var(--glb-surface-muted)] rounded-xl border border-[var(--shell-border)] text-center space-y-2">
                <p className="text-xs font-semibold text-[var(--glb-text)]">Large (1600px)</p>
                <div className="h-32 flex items-center justify-center">
                  <img
                    src={selectedPreview.largeUrl}
                    alt="Large"
                    className="max-h-full max-w-full object-contain rounded"
                  />
                </div>
                <a
                  href={selectedPreview.largeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[var(--glb-primary)] hover:underline block truncate"
                >
                  Abrir WebP
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
