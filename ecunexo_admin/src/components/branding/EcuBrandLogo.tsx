export type EcuBrandLogoPlacement = 'onPrimary' | 'onSurface'
export type EcuBrandLogoSurfaceStyle = 'auto' | 'light' | 'dark'

export interface EcuBrandLogoProps {
  readonly placement: EcuBrandLogoPlacement
  readonly className?: string
  readonly alt?: string
  readonly surfaceStyle?: EcuBrandLogoSurfaceStyle
}

export function EcuBrandLogo({
  className,
  alt = 'EcuNexo',
}: EcuBrandLogoProps) {
  return (
    <span
      className={['ecu-wordmark', className].filter(Boolean).join(' ')}
      aria-label={alt || 'EcuNexo'}
    >
      <span className="ecu-wordmark__name" aria-hidden>
        Ecu<strong>Ne<span className="ecu-wordmark__x">x</span>o</strong>
      </span>
    </span>
  )
}
