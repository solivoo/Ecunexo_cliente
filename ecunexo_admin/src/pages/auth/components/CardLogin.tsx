import { type FormEvent, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, TextBox } from 'glubox'
import { Mail } from 'lucide-react'
import { resolvePostAuthPath } from '@/features/auth/resolvePostAuthPath'
import { api } from '@/lib/apiClient'
import { readApiError } from '@/lib/readApiError'
import {
  fetchSession,
  fetchSubscriptionSession,
  loginWithPassword,
  type SessionAuth,
  type SessionPayload,
} from '@/services/authApi'
import { setCredentials, setHolderResume, setSessionPayload } from '@/store/authSlice'
import { useAppDispatch } from '@/store/hooks'
import type {
  ListSubscriptionCompaniesDto,
  SubscriptionCompanyListItemDto,
} from '@/types/companiesApi'

type LoginStep = 'credentials' | 'pick-company'

function companyLabel(c: SubscriptionCompanyListItemDto): string {
  return c.name
}

export function CardLogin() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [step, setStep] = useState<LoginStep>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [holderAuth, setHolderAuth] = useState<SessionAuth | null>(null)
  const [companies, setCompanies] = useState<SubscriptionCompanyListItemDto[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')

  const companyOptions = useMemo(
    () =>
      companies.map((c) => ({
        value: c.id,
        label: companyLabel(c),
      })),
    [companies]
  )

  const finishLogin = (auth: SessionAuth, session: SessionPayload) => {
    dispatch(
      setCredentials({
        accessToken: auth.accessToken,
        tenantId: auth.tenantId,
        userId: auth.userId,
      })
    )
    dispatch(setSessionPayload(session))
    void navigate(
      resolvePostAuthPath({
        isSubscriptionHolder: Boolean(session.isSubscriptionHolder ?? session.subscription),
        tenantId: auth.tenantId,
      }),
      { replace: true }
    )
  }

  const handleCredentialsSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const auth = await loginWithPassword({
        email: email.trim(),
        password,
      })

      const sessionAuth: SessionAuth = {
        accessToken: auth.accessToken,
        tenantId: auth.tenantId,
        userId: auth.userId,
        isSubscriptionHolder: auth.isSubscriptionHolder,
      }

      if (!auth.isSubscriptionHolder && auth.tenantId) {
        const session = await fetchSession(auth.tenantId, sessionAuth)
        finishLogin(sessionAuth, session)
        return
      }

      if (!auth.isSubscriptionHolder) {
        throw new Error('No se pudo determinar el tipo de sesión.')
      }

      const { data: summary } = await api.get<ListSubscriptionCompaniesDto>(
        '/api/v1/subscription/companies',
        { ecuAuth: sessionAuth }
      )

      if (summary.companies.length === 0) {
        const session = await fetchSubscriptionSession(sessionAuth)
        finishLogin({ ...sessionAuth, tenantId: null }, session)
        return
      }

      setHolderAuth({ ...sessionAuth, tenantId: null, isSubscriptionHolder: true })
      setCompanies(summary.companies)
      setSelectedCompanyId(summary.companies[0]?.id ?? '')
      setStep('pick-company')
    } catch (err: unknown) {
      setError(readApiError(err, 'No se pudo iniciar sesión. Comprueba credenciales y la Api.'))
    } finally {
      setBusy(false)
    }
  }

  const handleEnterCompany = async (e: FormEvent) => {
    e.preventDefault()
    if (!holderAuth || !selectedCompanyId) {
      setError('Selecciona una empresa para continuar.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const { data: enter } = await api.post<{
        accessToken: string
        userId: string
        tenantId: string
      }>(`/api/v1/subscription/companies/${selectedCompanyId}/session`, undefined, {
        ecuAuth: holderAuth,
      })

      const tenantAuth: SessionAuth = {
        accessToken: enter.accessToken,
        tenantId: enter.tenantId,
        userId: enter.userId,
        isSubscriptionHolder: false,
      }
      const session = await fetchSession(enter.tenantId, tenantAuth)
      dispatch(
        setHolderResume({
          accessToken: holderAuth.accessToken,
          userId: holderAuth.userId,
        })
      )
      finishLogin(tenantAuth, session)
    } catch (err: unknown) {
      setError(readApiError(err, 'No se pudo entrar a la empresa seleccionada.'))
    } finally {
      setBusy(false)
    }
  }

  const backToCredentials = () => {
    setStep('credentials')
    setHolderAuth(null)
    setCompanies([])
    setSelectedCompanyId('')
    setError(null)
    setPassword('')
  }

  if (step === 'pick-company') {
    return (
      <form
        className="login-page__form login-page__form--glu"
        onSubmit={(ev) => {
          void handleEnterCompany(ev)
        }}
        noValidate
      >
        {error ? (
          <p className="welcome-onboarding__error" role="alert">
            {error}
          </p>
        ) : null}

        <Select
          id="login-company"
          label="Empresa"
          labelPosition="outlined"
          variant="outline"
          options={companyOptions}
          value={selectedCompanyId}
          onChange={setSelectedCompanyId}
          disabled={busy}
          fullWidth
        />

        <div className="login-page__form-actions">
          <Button type="submit" variant="primary" size="md" fullWidth loading={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="md"
            fullWidth
            disabled={busy}
            onClick={backToCredentials}
          >
            Atrás
          </Button>
        </div>
      </form>
    )
  }

  return (
    <form
      className="login-page__form login-page__form--glu"
      onSubmit={(ev) => {
        void handleCredentialsSubmit(ev)
      }}
      noValidate
    >
      {error ? (
        <p className="welcome-onboarding__error" role="alert">
          {error}
        </p>
      ) : null}

      <TextBox
        id="login-email"
        label="Correo electrónico"
        labelPosition="outlined"
        variant="outline"
        type="email"
        name="email"
        autoComplete="email"
        value={email}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
        placeholder="nombre@correo.com"
        iconLeft={<Mail size={18} strokeWidth={1.75} aria-hidden />}
        fullWidth
        size="md"
        required
        disabled={busy}
      />

      <div className="login-page__aux-link-row">
        <a className="login-page__link-muted" href="#recuperar">
          ¿Olvidó su contraseña?
        </a>
      </div>

      <TextBox
        id="login-password"
        label="Contraseña"
        labelPosition="outlined"
        variant="outline"
        type="password"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
        placeholder="••••••••"
        fullWidth
        size="md"
        required
        disabled={busy}
      />

      <div className="login-page__form-actions">
        <Button type="submit" variant="primary" size="md" fullWidth loading={busy}>
          {busy ? 'Conectando…' : 'Iniciar sesión'}
        </Button>
      </div>
    </form>
  )
}

export default CardLogin
