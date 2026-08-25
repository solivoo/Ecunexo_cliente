import { resolveAssetUrl } from '@/features/organization/resolveTenantMark'
import type { BrandLogoListItem } from '@/services/brandLogoApi'

export function CompanyLogoPreview({
  companyName,
  preferWordmark,
  light,
  dark,
}: {
  readonly companyName: string
  readonly preferWordmark: boolean
  readonly light: BrandLogoListItem | null
  readonly dark: BrandLogoListItem | null
}) {
  const wordmark = companyName.trim().toUpperCase() || 'EMPRESA'
  return (
    <div className="company-logo-preview">
      <PreviewCard
        title="Claro"
        tone="light"
        preferWordmark={preferWordmark}
        item={light ?? dark}
        wordmark={wordmark}
      />
      <PreviewCard
        title="Oscuro"
        tone="dark"
        preferWordmark={preferWordmark}
        item={dark ?? light}
        wordmark={wordmark}
      />
    </div>
  )
}

function PreviewCard({
  title,
  tone,
  preferWordmark,
  item,
  wordmark,
}: {
  readonly title: string
  readonly tone: 'light' | 'dark'
  readonly preferWordmark: boolean
  readonly item: BrandLogoListItem | null
  readonly wordmark: string
}) {
  const src = item ? resolveAssetUrl(item.fileUrl) : null
  const showImage = !preferWordmark && Boolean(src)
  return (
    <article className={`company-logo-preview__card company-logo-preview__card--${tone}`}>
      <p className="company-logo-preview__label">{title}</p>
      <div className="company-logo-preview__stage">
        {showImage && src ? (
          <img src={src} alt={`Logo ${title}`} className="company-logo-preview__img" />
        ) : (
          <span className="company-logo-preview__wordmark">{wordmark}</span>
        )}
      </div>
      <p className="company-logo-preview__meta">
        {showImage && item
          ? `${item.originalFileName} · ${item.extension.toUpperCase()}`
          : 'Nombre de la empresa'}
      </p>
    </article>
  )
}
