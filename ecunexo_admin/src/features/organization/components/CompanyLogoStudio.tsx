import { useEffect, useState } from 'react'
import { CheckButton, FileBox, useToast } from 'glubox'
import { ImageIcon } from 'lucide-react'
import { CompanyLogoPreview } from '@/features/organization/components/CompanyLogoPreview'
import { CompanyLogosGrid } from '@/features/organization/components/CompanyLogosGrid'
import { useCompanyLogos } from '@/features/organization/useCompanyLogos'
import { readApiError } from '@/lib/readApiError'
import { patchTenantBranding, selectTenantId } from '@/store/authSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import type { BrandLogoCatalog } from '@/services/brandLogoApi'
import './companyLogoStudio.css'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg'

export function CompanyLogoStudio({
  tenantId,
  companyName,
  disabled = false,
}: {
  readonly tenantId: string
  readonly companyName: string
  readonly disabled?: boolean
}) {
  const toast = useToast()
  const dispatch = useAppDispatch()
  const sessionTenantId = useAppSelector(selectTenantId)
  const logos = useCompanyLogos(tenantId)
  const [files, setFiles] = useState<File[]>([])
  const locked = disabled || logos.busy || logos.loading

  useEffect(() => {
    const catalog = logos.catalog
    if (!catalog || sessionTenantId !== tenantId) {
      return
    }
    dispatch(patchTenantBranding(sessionBrandingFromCatalog(catalog)))
  }, [dispatch, logos.catalog, sessionTenantId, tenantId])

  const onPick = async (next: File[]) => {
    setFiles(next)
    if (next.length === 0) {
      return
    }
    try {
      await logos.upload(next)
      setFiles([])
      toast.show({
        title: 'Logo guardado',
        message: 'Se comprimió y quedó en la galería. Elígelo para claro u oscuro.',
        variant: 'success',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'No se pudo subir',
        message: readApiError(err, 'Revisa el formato y el peso del archivo.'),
        variant: 'error',
      })
    }
  }

  const run = async (action: () => Promise<void>, ok: string) => {
    try {
      await action()
      toast.show({ title: 'Marca actualizada', message: ok, variant: 'success' })
    } catch (err: unknown) {
      toast.show({
        title: 'No se pudo guardar',
        message: readApiError(err, 'Inténtalo de nuevo.'),
        variant: 'error',
      })
    }
  }

  const catalog = logos.catalog
  const light = logos.itemById(catalog?.lightLogoId ?? null)
  const dark = logos.itemById(catalog?.darkLogoId ?? null)

  return (
    <section className="app-shell__card ecu-companies-form__card company-logo-studio">
      <h2 className="app-shell__section-title">
        <ImageIcon size={18} strokeWidth={1.75} aria-hidden /> Logo de la empresa
      </h2>
      <p className="ecu-companies-form__hint">
        Sube varios archivos y elige cuál se usa en tema claro y oscuro. Si solo hay uno, se usa
        en ambos. Si no hay ninguno, se muestra el nombre en mayúsculas.
      </p>
      {logos.error ? (
        <p className="ecu-companies-form__hint" role="status">
          {logos.error}
        </p>
      ) : null}

      <CompanyLogoPreview
        companyName={companyName}
        preferWordmark={catalog?.preferWordmark ?? false}
        light={light}
        dark={dark}
      />

      <div className="company-logo-studio__upload">
        <FileBox
          id="company-logo-files"
          label="Subir logos"
          labelPosition="outlined"
          variant="outline"
          displayMode="dropzone"
          accept={ACCEPT}
          multiple
          value={files}
          onChange={(next: File[]) => void onPick(next)}
          placeholder="Arrastra PNG, JPG, WebP o SVG"
          buttonLabel="Examinar"
          helperText="Se comprime a WebP (máx. 512 px / 256 KB). El SVG se guarda tal cual."
          disabled={locked}
          fullWidth
        />
        <CheckButton
          variant="ghost"
          checked={catalog?.preferWordmark ?? false}
          disabled={locked || !catalog}
          onChange={(checked: boolean) =>
            void run(
              () => logos.select({ preferWordmark: checked }),
              checked ? 'Se mostrará el nombre de la empresa.' : 'Se usarán los logos elegidos.'
            )
          }
        >
          Usar el nombre de la empresa en vez del logo
        </CheckButton>
      </div>

      <CompanyLogosGrid
        rows={catalog?.items ?? []}
        lightLogoId={catalog?.lightLogoId ?? null}
        darkLogoId={catalog?.darkLogoId ?? null}
        disabled={locked}
        loading={logos.loading}
        onUseLight={(id) =>
          void run(() => logos.select({ lightLogoId: id, preferWordmark: false }), 'Logo claro asignado.')
        }
        onUseDark={(id) =>
          void run(() => logos.select({ darkLogoId: id, preferWordmark: false }), 'Logo oscuro asignado.')
        }
        onDelete={(id) => void run(() => logos.remove(id), 'Logo eliminado.')}
      />
    </section>
  )
}

function sessionBrandingFromCatalog(catalog: BrandLogoCatalog) {
  const light = catalog.items.find((row) => row.id === catalog.lightLogoId)
  const dark = catalog.items.find((row) => row.id === catalog.darkLogoId)
  const fallback = light ?? dark
  return {
    preferWordmark: catalog.preferWordmark,
    logoLightUrl: light?.fileUrl ?? dark?.fileUrl ?? null,
    logoDarkUrl: dark?.fileUrl ?? light?.fileUrl ?? null,
    logoUrl: catalog.preferWordmark ? null : fallback?.fileUrl ?? null,
  }
}
