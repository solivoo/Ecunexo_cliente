import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useOnboardingStatus } from '@/features/auth/useOnboardingStatus'
import { ActivateLicenseForm } from '@/features/onboarding/ActivateLicenseForm'
import { ThemeToggleButton } from '@/components/ui/ThemeToggleButton'
import { LegalModal, type LegalModalTab } from '@/pages/legal/LegalModal'
import Branding from './components/Branding'
import './loginPage.css'
import './welcomeOnboarding.css'

const WelcomeOnboardingPage = () => {
  const { hasOrganization } = useOnboardingStatus()
  const [legalOpen, setLegalOpen] = useState(false)
  const [legalTab, setLegalTab] = useState<LegalModalTab>('terms')

  const openLegal = (tab: LegalModalTab) => {
    setLegalTab(tab)
    setLegalOpen(true)
  }

  if (hasOrganization === null) {
    return null
  }

  if (hasOrganization) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="login-page__wrapper">
      <ThemeToggleButton variant="icon" className="login-page__theme-btn-round" />
      <Branding />
      <div className="login-page__card">
        <ActivateLicenseForm idPrefix="welcome" />
      </div>
      <footer className="login-page__footer login-page__footer--welcome">
        <Link to="/" className="welcome-onboarding__link welcome-onboarding__link--footer">
          <span className="welcome-onboarding__footer-muted">¿Ya eres titular?</span>
          <span className="welcome-onboarding__footer-action">Iniciar sesión</span>
        </Link>
        <div className="login-page__footer-links login-page__footer-links--compact">
          <button
            type="button"
            className="login-page__footer-btn-link"
            onClick={() => openLegal('privacy')}
          >
            Política de Privacidad (LOPDP)
          </button>
          <button
            type="button"
            className="login-page__footer-btn-link"
            onClick={() => openLegal('terms')}
          >
            Términos del Servicio (SRI / SaaS)
          </button>
        </div>
        <span className="login-page__footer-brand">
          © {new Date().getFullYear()} EcuNexo — SaaS Multi-Tenant Platform
        </span>
      </footer>

      <LegalModal
        open={legalOpen}
        onClose={() => setLegalOpen(false)}
        initialTab={legalTab}
      />
    </div>
  )
}

export default WelcomeOnboardingPage
