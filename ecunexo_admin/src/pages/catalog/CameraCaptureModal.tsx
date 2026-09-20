import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Popup } from 'glubox'
import { AlertCircle, Camera, Check, RefreshCw, SwitchCamera } from 'lucide-react'

export interface CameraCaptureModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onCapture: (file: File) => void
  readonly onFallbackNative?: () => void
}

export function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  onFallbackNative,
}: CameraCaptureModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)
  const [starting, setStarting] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Detener pistas del stream activo
  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {
          // ignore
        }
      })
      setStream(null)
    }
  }, [stream])

  // Iniciar cámara con facingMode
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    setStarting(true)
    setCameraError(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Tu navegador o conexión actual no soporta captura de video en vivo (WebRTC). Puedes usar la cámara nativa del sistema.')
      setStarting(false)
      return
    }

    try {
      // Enumerar cámaras disponibles
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter((d) => d.kind === 'videoinput')
        setHasMultipleCameras(videoDevices.length > 1)
      } catch {
        // ignore
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })

      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play().catch(() => {
          // autoPlay policy
        })
      }
    } catch (err: unknown) {
      console.warn('Error accediendo a cámara:', err)
      const errorMsg =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Puedes habilitarlo en los permisos del navegador o usar la cámara nativa.'
          : 'No se pudo iniciar el visor de cámara en vivo. Puedes usar la cámara nativa de tu dispositivo.'
      setCameraError(errorMsg)
    } finally {
      setStarting(false)
    }
  }, [])

  // Inicializar o apagar cámara al abrir/cerrar modal
  useEffect(() => {
    if (isOpen) {
      setCapturedBlob(null)
      if (capturedPreview) {
        URL.revokeObjectURL(capturedPreview)
        setCapturedPreview(null)
      }
      void startCamera(facingMode)
    } else {
      stopStream()
      if (capturedPreview) {
        URL.revokeObjectURL(capturedPreview)
        setCapturedPreview(null)
      }
      setCapturedBlob(null)
      setCameraError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Limpiar stream al desmontar
  useEffect(() => {
    return () => {
      stopStream()
      if (capturedPreview) {
        URL.revokeObjectURL(capturedPreview)
      }
    }
  }, [capturedPreview, stopStream])

  // Conectar videoRef si el stream cambia
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }
  }, [stream])

  const handleCapture = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    const width = video.videoWidth || 1280
    const height = video.videoHeight || 720
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Si la cámara frontal está activada, espejar horizontalmente para naturalidad
    if (facingMode === 'user') {
      ctx.translate(width, 0)
      ctx.scale(-1, 1)
    }

    ctx.drawImage(video, 0, 0, width, height)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        setCapturedBlob(blob)
        setCapturedPreview(URL.createObjectURL(blob))
        // Detener stream mientras revisa la foto capturada
        stopStream()
      },
      'image/jpeg',
      0.92
    )
  }

  const handleRetake = () => {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview)
      setCapturedPreview(null)
    }
    setCapturedBlob(null)
    void startCamera(facingMode)
  }

  const handleConfirm = () => {
    if (!capturedBlob) return
    const filename = `captura-${Date.now()}.jpg`
    const file = new File([capturedBlob], filename, { type: 'image/jpeg' })
    onCapture(file)
    handleClose()
  }

  const handleClose = () => {
    stopStream()
    onClose()
  }

  const handleToggleFacing = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(nextMode)
    void startCamera(nextMode)
  }

  return (
    <Popup
      open={isOpen}
      onClose={handleClose}
      title="Cámara — Capturar Foto de Producto"
      width="min(95vw, 36rem)"
    >
      <div className="ecu-camera-modal-body">
        {cameraError ? (
          <div className="ecu-camera-error-container">
            <div className="ecu-camera-error-icon">
              <AlertCircle size={36} style={{ color: '#ef4444' }} />
            </div>
            <p className="ecu-camera-error-text">{cameraError}</p>
            {onFallbackNative && (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => {
                  handleClose()
                  onFallbackNative()
                }}
              >
                <Camera size={16} className="mr-1.5" />
                Abrir cámara nativa del sistema
              </Button>
            )}
          </div>
        ) : capturedPreview ? (
          <div className="ecu-camera-preview-container">
            <div className="ecu-camera-preview-box">
              <img
                src={capturedPreview}
                alt="Vista previa de la captura"
                className="ecu-camera-preview-img"
              />
            </div>
            <div className="ecu-camera-controls">
              <Button type="button" variant="outline" size="sm" onClick={handleRetake}>
                <RefreshCw size={14} className="mr-1.5" />
                Tomar otra foto
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={handleConfirm}>
                <Check size={14} className="mr-1.5" />
                Usar esta foto
              </Button>
            </div>
          </div>
        ) : (
          <div className="ecu-camera-viewfinder-container">
            <div className="ecu-camera-viewfinder">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`ecu-camera-video ${facingMode === 'user' ? 'ecu-camera-video--mirrored' : ''}`}
              />
              {starting && (
                <div className="ecu-camera-loading-overlay">
                  <span>Iniciando visor de cámara...</span>
                </div>
              )}
            </div>

            <div className="ecu-camera-controls">
              {hasMultipleCameras && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleToggleFacing}
                  title="Cambiar entre cámara frontal y trasera"
                >
                  <SwitchCamera size={15} className="mr-1.5" />
                  Girar cámara
                </Button>
              )}

              <Button
                type="button"
                variant="primary"
                size="md"
                className="ecu-camera-shutter-btn"
                disabled={starting || !stream}
                onClick={handleCapture}
              >
                <Camera size={18} className="mr-1.5" />
                Capturar Foto
              </Button>

              {onFallbackNative && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    handleClose()
                    onFallbackNative()
                  }}
                  title="Usar la aplicación de cámara de tu dispositivo"
                >
                  Cámara nativa
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Popup>
  )
}
