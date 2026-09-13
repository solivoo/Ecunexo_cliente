import { useState } from 'react'
import { Popup } from 'glubox'
import { Scale, ShieldCheck } from 'lucide-react'
import { StatusBadge } from '@/components/ui'
import {
  LEGAL_LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS,
  TERMS_AND_CONDITIONS_SECTIONS,
} from './legalTermsContent'

export type LegalModalTab = 'terms' | 'privacy'

export interface LegalModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly initialTab?: LegalModalTab
}

export function LegalModal({
  open,
  onClose,
  initialTab = 'terms',
}: LegalModalProps) {
  const [activeTab, setActiveTab] = useState<LegalModalTab>(initialTab)

  const handlePrint = () => {
    window.print()
  }

  return (
    <Popup
      open={open}
      title="Marco Jurídico y Protección Normativa (Ecuador)"
      onClose={onClose}
      width="min(94vw, 54rem)"
      actions={[
        {
          id: 'print',
          label: 'Imprimir / PDF',
          variant: 'outline',
          onClick: handlePrint,
        },
        {
          id: 'close',
          label: 'He leído y acepto',
          variant: 'primary',
          onClick: onClose,
        },
      ]}
    >
      <div
        className="ecu-legal-modal"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          maxHeight: '75vh',
        }}
      >
        {/* Encabezado Normativo y Badges de Cumplimiento */}
        <div
          style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            backgroundColor: 'var(--glb-surface, rgba(0,0,0,0.02))',
            border: '1px solid var(--shell-border, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--glb-text, inherit)' }}>
              Blindaje Legal Integral bajo la Legislación de la República del Ecuador
            </span>
            <StatusBadge tone="success" withDot>
              Vigente
            </StatusBadge>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', fontWeight: 600 }}>
              LOPDP R.O. 459
            </span>
            <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 600 }}>
              Ficha Técnica SRI v2.32
            </span>
            <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', fontWeight: 600 }}>
              LCEFMD Ley 2002-67
            </span>
            <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', fontWeight: 600 }}>
              Cifrado AES-256-GCM
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--glb-muted, #64748b)' }}>
            Última actualización: {LEGAL_LAST_UPDATED}. Aplica a todos los tenants, usuarios, administradores y operaciones electrónicas en la plataforma.
          </p>
        </div>

        {/* Selector de Pestañas */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            borderBottom: '1px solid var(--shell-border, rgba(255, 255, 255, 0.1))',
            paddingBottom: '0.5rem',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              backgroundColor: activeTab === 'terms' ? 'var(--shell-primary, #4f46e5)' : 'transparent',
              color: activeTab === 'terms' ? '#ffffff' : 'var(--glb-text, inherit)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'background-color 0.2s',
            }}
          >
            <Scale size={15} />
            Términos y Condiciones (SaaS / SRI)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              backgroundColor: activeTab === 'privacy' ? 'var(--shell-primary, #4f46e5)' : 'transparent',
              color: activeTab === 'privacy' ? '#ffffff' : 'var(--glb-text, inherit)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'background-color 0.2s',
            }}
          >
            <ShieldCheck size={15} />
            Política de Privacidad (LOPDP Ecuador)
          </button>
        </div>

        {/* Contenedor con Scroll del Contenido Legal */}
        <div
          style={{
            overflowY: 'auto',
            paddingRight: '0.5rem',
            lineHeight: 1.6,
            fontSize: '0.835rem',
            color: 'var(--glb-text, inherit)',
          }}
        >
          {activeTab === 'terms' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(234, 179, 8, 0.08)',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  fontSize: '0.8rem',
                }}
              >
                <strong>Aviso de Delimitación Tributaria y Responsabilidad:</strong> EcuNexo es una plataforma de software como servicio. El Usuario/Empresa es el único sujeto pasivo tributario ante el SRI y custodio exclusivo de su firma electrónica .p12. EcuNexo no asume responsabilidad por multas del SRI, glosas ni por intermitencias de los servidores del Estado.
              </div>

              {TERMS_AND_CONDITIONS_SECTIONS.map((sec) => (
                <div key={sec.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.925rem', fontWeight: 600, color: 'var(--glb-text, inherit)' }}>
                    {sec.title}
                  </h4>
                  {sec.content.map((p, idx) => (
                    <p key={idx} style={{ margin: 0, color: 'var(--glb-muted, #475569)', textAlign: 'justify' }}>
                      {p}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  fontSize: '0.8rem',
                }}
              >
                <strong>Cumplimiento de la LOPDP (Ley de Protección de Datos):</strong> EcuNexo actúa como Encargado del Tratamiento respecto a la base de clientes y proveedores del Tenant, y aplica medidas de seguridad de vanguardia como cifrado AES-256-GCM para firmas y claves privadas.
              </div>

              {PRIVACY_POLICY_SECTIONS.map((sec) => (
                <div key={sec.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.925rem', fontWeight: 600, color: 'var(--glb-text, inherit)' }}>
                    {sec.title}
                  </h4>
                  {sec.content.map((p, idx) => (
                    <p key={idx} style={{ margin: 0, color: 'var(--glb-muted, #475569)', textAlign: 'justify' }}>
                      {p}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Popup>
  )
}
