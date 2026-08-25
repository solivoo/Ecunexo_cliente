import logoDarkMode from '@/assets/solo_logo_ecunexo_dark.svg'
import logoLightMode from '@/assets/solo_logo_ecunexo_light.svg'
import { useGluComponentTheme } from '@/hooks/useGluComponentTheme'

export type EcuBrandLogoPlacement = 'onPrimary' | 'onSurface'
export type EcuBrandLogoSurfaceStyle = 'auto' | 'light' | 'dark'

export interface EcuBrandLogoProps {
  readonly placement: EcuBrandLogoPlacement
  readonly className?: string
  readonly alt?: string
  readonly surfaceStyle?: EcuBrandLogoSurfaceStyle
}

function resolveLogoForDarkBackground(
  placement: EcuBrandLogoPlacement,
  surfaceStyle: EcuBrandLogoSurfaceStyle,
  themeMode: 'dark' | 'light'
): boolean {
  if (placement === 'onPrimary') {
    return true
  }
  if (surfaceStyle === 'dark') {
    return true
  }
  if (surfaceStyle === 'light') {
    return false
  }
  return themeMode === 'dark'
}

export function EcuBrandLogo({
  placement,
  className,
  alt = '',
  surfaceStyle = 'auto',
}: EcuBrandLogoProps) {
  const themeMode = useGluComponentTheme()
  const src = resolveLogoForDarkBackground(placement, surfaceStyle, themeMode)
    ? logoDarkMode
    : logoLightMode

  return (
    <img
      key={src}
      src={src}
      alt={alt}
      className={className}
      width={156}
      height={40}
      decoding="async"
    />
  )
}
