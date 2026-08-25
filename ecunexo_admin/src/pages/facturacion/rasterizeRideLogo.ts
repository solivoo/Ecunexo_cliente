const MAX_EDGE = 256

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer el logo.'))
    }
    img.src = url
  })
}

function canvasToPng(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void): string | null {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return null
  }
  paint(ctx)
  return canvas.toDataURL('image/png')
}

/** Convierte el logo a PNG para el RIDE: el SVG con fuentes (p. ej. Roboto) rompe @react-pdf. */
export async function rasterizeRideLogo(src: string): Promise<string | null> {
  try {
    const response = await fetch(src)
    if (!response.ok) {
      return null
    }
    const blob = await response.blob()
    try {
      const bitmap = await createImageBitmap(blob)
      const png = canvasToPng(bitmap.width, bitmap.height, (ctx) => {
        ctx.drawImage(bitmap, 0, 0, ctx.canvas.width, ctx.canvas.height)
      })
      bitmap.close()
      return png
    } catch {
      const img = await blobToImage(blob)
      return canvasToPng(img.naturalWidth || img.width, img.naturalHeight || img.height, (ctx) => {
        ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height)
      })
    }
  } catch {
    return null
  }
}
