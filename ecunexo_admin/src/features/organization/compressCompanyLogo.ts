const MAX_EDGE = 512
const QUALITY = 0.82
const MAX_BYTES = 256_000

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('No se pudo comprimir la imagen.'))
      },
      type,
      quality
    )
  })
}

/** Reduce raster a WebP ≤ 512 px. SVG se deja igual si cabe en 256 KB. */
export async function compressCompanyLogo(file: File): Promise<File> {
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    if (file.size > MAX_BYTES) {
      throw new Error('El SVG supera 256 KB. Simplifícalo o usa PNG/WebP.')
    }
    return file
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('No se pudo preparar el lienzo para comprimir el logo.')
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await canvasToBlob(canvas, 'image/webp', QUALITY)
  const type = blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
  const ext = type === 'image/webp' ? 'webp' : 'jpg'
  const output = type === blob.type ? blob : await canvasToBlob(canvas, type, QUALITY)
  const base = file.name.replace(/\.[^.]+$/, '') || 'logo'
  const compressed = new File([output], `${base}.${ext}`, { type })
  if (compressed.size > MAX_BYTES) {
    throw new Error('El logo sigue pesando más de 256 KB. Usa un archivo más simple.')
  }
  return compressed
}
