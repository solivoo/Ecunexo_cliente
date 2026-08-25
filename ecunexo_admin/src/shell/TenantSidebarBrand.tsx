import type { SidebarBrandProps } from 'glubox'
import { resolveTenantMark } from '@/features/organization/resolveTenantMark'
import { useGluComponentTheme } from '@/hooks/useGluComponentTheme'
import { selectTenantBranding } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'

export function TenantSidebarBrand({ collapsed }: SidebarBrandProps) {
  const branding = useAppSelector(selectTenantBranding)
  const theme = useGluComponentTheme()
  const title = branding.name
  const accentStyle = branding.primaryColorHex
    ? ({ color: branding.primaryColorHex } as const)
    : undefined
  const mark = resolveTenantMark({
    name: title,
    preferWordmark: branding.preferWordmark,
    logoLightUrl: branding.logoLightUrl,
    logoDarkUrl: branding.logoDarkUrl,
    logoUrl: branding.logoUrl,
    theme,
  })

  if (mark.kind === 'image') {
    return (
      <img
        src={mark.src}
        alt={title}
        className={
          collapsed
            ? 'sidebar-brand__logo sidebar-brand__logo--collapsed'
            : 'sidebar-brand__logo'
        }
        decoding="async"
      />
    )
  }

  if (collapsed) {
    return (
      <span className="sidebar-brand__monogram" style={accentStyle} title={title}>
        {mark.text.charAt(0)}
      </span>
    )
  }

  return (
    <div className="sidebar-brand" style={accentStyle} title={title}>
      <span className="sidebar-brand__wordmark">{mark.text}</span>
    </div>
  )
}
