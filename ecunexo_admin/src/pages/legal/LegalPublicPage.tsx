import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from 'glubox'
import { ArrowLeft, Printer, Scale, ShieldCheck } from 'lucide-react'
import { StatusBadge } from '@/components/ui'
import { ThemeToggleButton } from '@/components/ui/ThemeToggleButton'
import {
  LEGAL_LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS,
  TERMS_AND_CONDITIONS_SECTIONS,
} from './legalTermsContent'

export function LegalPublicPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const defaultTab = location.pathname.includes('privacidad') ? 'privacy' : 'terms'
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(defaultTab)

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--glb-background, #f8fafc)',
        color: 'var(--glb-text, #0f172a)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header Público */}
      <header
        style={{
          borderBottom: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
          backgroundColor: 'var(--glb-surface, #ffffff)',
          padding: '0.85rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft size={14} /> Volver al Inicio
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src="/favicon.svg" alt="EcuNexo" width={24} height={24} />
            <strong style={{ fontSize: '0.95rem' }}>EcuNexo</strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--glb-muted, #64748b)' }}>· Marco Legal Ecuador</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <Printer size={14} /> Imprimir / PDF
          </Button>
          <ThemeToggleButton variant="icon" />
        </div>
      </header>

      {/* Contenido Principal */}
      <main style={{ maxWidth: '900px', width: '100%', margin: '2rem auto', padding: '0 1.5rem', flex: 1 }}>
        <div
          style={{
            backgroundColor: 'var(--glb-surface, #ffffff)',
            borderRadius: '0.75rem',
            border: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
            padding: '2rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
                Marco Legal y Blindaje Jurídico
              </h1>
              <StatusBadge tone="success" withDot>Vigente</StatusBadge>
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--glb-muted, #64748b)' }}>
              República del Ecuador · Última actualización: {LEGAL_LAST_UPDATED}
            </p>
          </div>

          {/* Selector de Pestañas */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              borderBottom: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
              marginBottom: '1.5rem',
              paddingBottom: '0.5rem',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('terms')}
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: activeTab === 'terms' ? 'var(--shell-primary, #4f46e5)' : 'transparent',
                color: activeTab === 'terms' ? '#ffffff' : 'inherit',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Scale size={16} />
              Términos del Servicio (SaaS / SRI)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: activeTab === 'privacy' ? 'var(--shell-primary, #4f46e5)' : 'transparent',
                color: activeTab === 'privacy' ? '#ffffff' : 'inherit',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <ShieldCheck size={16} />
              Política de Privacidad (LOPDP Ecuador)
            </button>
          </div>

          {/* Cuerpo Legal */}
          <div style={{ lineHeight: 1.7, fontSize: '0.9rem' }}>
            {activeTab === 'terms' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div
                  style={{
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'rgba(234, 179, 8, 0.08)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    fontSize: '0.85rem',
                  }}
                >
                  <strong>Aviso Importante:</strong> EcuNexo es una herramienta tecnológica. El contribuyente emisor es el único sujeto pasivo tributario ante el SRI y custodio de su firma electrónica .p12.
                </div>

                {TERMS_AND_CONDITIONS_SECTIONS.map((sec) => (
                  <section key={sec.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                      {sec.title}
                    </h2>
                    {sec.content.map((p, idx) => (
                      <p key={idx} style={{ margin: 0, color: 'var(--glb-muted, #475569)', textAlign: 'justify' }}>
                        {p}
                      </p>
                    ))}
                  </section>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div
                  style={{
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    fontSize: '0.85rem',
                  }}
                >
                  <strong>Protección de Datos:</strong> Tratamiento ajustado a la Ley Orgánica de Protección de Datos Personales (LOPDP). Cifrado AES-256-GCM para firmas y claves privadas.
                </div>

                {PRIVACY_POLICY_SECTIONS.map((sec) => (
                  <section key={sec.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                      {sec.title}
                    </h2>
                    {sec.content.map((p, idx) => (
                      <p key={idx} style={{ margin: 0, color: 'var(--glb-muted, #475569)', textAlign: 'justify' }}>
                        {p}
                      </p>
                    ))}
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer
        style={{
          borderTop: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
          padding: '1rem',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: 'var(--glb-muted, #64748b)',
        }}
      >
        © {new Date().getFullYear()} EcuNexo — Plataforma SaaS Multi-Tenant. República del Ecuador.
      </footer>
    </div>
  )
}
export default LegalPublicPage
