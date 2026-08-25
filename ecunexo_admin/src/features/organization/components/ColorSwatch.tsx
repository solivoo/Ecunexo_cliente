export interface ColorSwatchProps {
  readonly hex: string | null
}

export function ColorSwatch({ hex }: ColorSwatchProps) {
  if (!hex) {
    return <>—</>
  }

  return (
    <span className="ecu-color-swatch">
      <span className="ecu-color-swatch__chip" style={{ backgroundColor: hex }} aria-hidden />
      <code>{hex}</code>
    </span>
  )
}
