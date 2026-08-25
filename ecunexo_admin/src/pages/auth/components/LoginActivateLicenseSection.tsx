import { useEffect, useState, type ToggleEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { ActivateLicenseForm } from '@/features/onboarding/ActivateLicenseForm'
import { useOnboardingStatus } from '@/features/auth/useOnboardingStatus'

export function LoginActivateLicenseSection() {
  const { hasOrganization } = useOnboardingStatus()
  const { hash } = useLocation()
  const [open, setOpen] = useState(() => hash === '#activar')

  useEffect(() => {
    if (hash === '#activar' || hasOrganization === false) {
      setOpen(true)
    }
  }, [hash, hasOrganization])

  return (
    <section className="login-page__activate" aria-label="Activar licencia">
      <details
        className="login-page__activate-details"
        open={open}
        onToggle={(e: ToggleEvent<HTMLDetailsElement>) => {
          setOpen(e.currentTarget.open)
        }}
      >
        <summary>Nueva organización: activa tu licencia</summary>
        <div className="login-page__activate-body">
          <ActivateLicenseForm idPrefix="login-activate" />
        </div>
      </details>
    </section>
  )
}
