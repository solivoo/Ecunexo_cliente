import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { resolvePostAuthPath } from '@/features/auth/resolvePostAuthPath'
import { readApiError } from '@/lib/readApiError'
import { fetchSession, fetchSubscriptionSession } from '@/services/authApi'
import { activateLicense } from '@/services/onboardingApi'
import { setCredentials, setSessionPayload } from '@/store/authSlice'
import { useAppDispatch } from '@/store/hooks'

export function useActivateLicenseForm() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [activationCode, setActivationCode] = useState('')
  const [licenseArtifact, setLicenseArtifact] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLicenseLoaded = useCallback((parsed: { artifactJson: string }) => {
    setLicenseArtifact(parsed.artifactJson)
  }, [])

  const handleLicenseClear = useCallback(() => {
    setLicenseArtifact('')
  }, [])

  const submit = useCallback(async () => {
    setError(null)

    const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
    if (!baseUrl) {
      setError('Define VITE_API_BASE_URL en .env (p. ej. http://localhost:5088).')
      return
    }

    if (!activationCode.trim() || !licenseArtifact.trim()) {
      setError(
        'Ingresa el código de activación y adjunta el archivo .ecunexo-license que te envió Ecunexo.'
      )
      return
    }

    setBusy(true)
    try {
      const result = await activateLicense({
        activationCode: activationCode.trim(),
        licenseArtifact: licenseArtifact.trim(),
      })
      const sessionAuth = {
        accessToken: result.accessToken,
        tenantId: result.tenantId,
        userId: result.userId,
        isSubscriptionHolder: result.isSubscriptionHolder,
      }
      const session =
        result.tenantId && !result.isSubscriptionHolder
          ? await fetchSession(result.tenantId, sessionAuth)
          : await fetchSubscriptionSession(sessionAuth)
      dispatch(
        setCredentials({
          accessToken: result.accessToken,
          tenantId: result.tenantId,
          userId: result.userId,
        })
      )
      dispatch(setSessionPayload(session))
      void navigate(
        resolvePostAuthPath({
          isSubscriptionHolder: Boolean(
            result.isSubscriptionHolder || session.isSubscriptionHolder || session.subscription
          ),
          tenantId: session.tenant?.id ?? result.tenantId,
          preferCreateCompany: true,
        }),
        { replace: true }
      )
    } catch (err: unknown) {
      setError(readApiError(err, 'No se pudo activar la licencia. Revisa el código y el archivo.'))
    } finally {
      setBusy(false)
    }
  }, [activationCode, dispatch, licenseArtifact, navigate])

  return {
    activationCode,
    setActivationCode,
    busy,
    error,
    handleLicenseClear,
    handleLicenseLoaded,
    submit,
  }
}
