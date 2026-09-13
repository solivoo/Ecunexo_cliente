import { useState } from 'react'
import Branding from './components/Branding'
import CardLogin from './components/CardLogin'
import { LoginActivateLicenseSection } from './components/LoginActivateLicenseSection'
import { ThemeToggleButton } from '@/components/ui/ThemeToggleButton'
import { LegalModal, type LegalModalTab } from '@/pages/legal/LegalModal'
import './login-textbox-tweaks.css'
import './welcomeOnboarding.css'

export function LoginPage() {
  const [legalOpen, setLegalOpen] = useState(false)
  const [legalTab, setLegalTab] = useState<LegalModalTab>('terms')

  const openLegal = (tab: LegalModalTab) => {
    setLegalTab(tab)
    setLegalOpen(true)
  }

  return (
    <div className="login-page__wrapper">
      <ThemeToggleButton variant="icon" className="login-page__theme-btn-round" />
      <Branding />
      <div className="login-page__card">
        <CardLogin onOpenLegal={openLegal} />
      </div>
      <LoginActivateLicenseSection />
      <footer className="login-page__footer login-page__footer--brand">
        <div className="login-page__footer-links">
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
        <span>© {new Date().getFullYear()} EcuNexo — SaaS Multi-Tenant Platform</span>
      </footer>

      <LegalModal
        open={legalOpen}
        onClose={() => setLegalOpen(false)}
        initialTab={legalTab}
      />
    </div>
  )
}

export default LoginPage
