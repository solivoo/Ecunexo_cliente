import { createContext, useContext } from 'react'
import type { RidePalette } from '@/pages/facturacion/rideFacturaPalette'
import type { RideStyles } from '@/pages/facturacion/rideFacturaStyles'

export type RideTheme = {
  readonly palette: RidePalette
  readonly styles: RideStyles
}

export const RideThemeContext = createContext<RideTheme | null>(null)

export function useRideTheme(): RideTheme {
  const value = useContext(RideThemeContext)
  if (!value) {
    throw new Error('RideThemeContext es obligatorio para el RIDE.')
  }
  return value
}
