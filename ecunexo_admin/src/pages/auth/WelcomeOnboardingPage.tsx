import { Link, Navigate } from 'react-router-dom'
import { useOnboardingStatus } from '@/features/auth/useOnboardingStatus'
import { ActivateLicenseForm } from '@/features/onboarding/ActivateLicenseForm'
import { ThemeToggleButton } from '@/components/ui/ThemeToggleButton'
import Branding from './components/Branding'
import './loginPage.css'
import './welcomeOnboarding.css'

const WelcomeOnboardingPage = () => {
  const { hasOrganization } = useOnboardingStatus()

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
          <a href="#privacidad">Política de Privacidad</a>
          <a href="#terminos">Términos del Servicio</a>
        </div>
        <span className="login-page__footer-brand">
          © {new Date().getFullYear()} EcuNexo — SaaS Multi-Tenant Platform
        </span>
      </footer>
    </div>
  )
}

export default WelcomeOnboardingPage
