import { useCallback, useState } from 'react'
import { useToast } from 'glubox'
import { readApiError } from '@/lib/readApiError'
import { sendTenantUserPasswordResetEmail, setTenantUserPassword } from '@/services/identityApi'
import type { GetTenantUserDto } from '@/types/identityApi'

type UseEditUserPasswordArgs = {
  readonly tenantId: string | null
  readonly userId: string
  readonly user: GetTenantUserDto | null
  readonly onError: (message: string | null) => void
}

export function useEditUserPassword({ tenantId, userId, user, onError }: UseEditUserPasswordArgs) {
  const toast = useToast()
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  const onSavePassword = useCallback(async () => {
    if (!tenantId || !user) return
    setPasswordBusy(true)
    onError(null)
    try {
      if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.')
      if (password !== passwordConfirm) throw new Error('Las contraseñas no coinciden.')
      await setTenantUserPassword(tenantId, userId, { password })
      setPassword('')
      setPasswordConfirm('')
      toast.show({
        title: 'Contraseña actualizada',
        message: `«${user.name}» ya puede iniciar sesión con la nueva contraseña.`,
        variant: 'success',
      })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : readApiError(err, 'No se pudo cambiar la contraseña.')
      onError(message)
      toast.show({ title: 'Error', message, variant: 'error' })
    } finally {
      setPasswordBusy(false)
    }
  }, [onError, password, passwordConfirm, tenantId, toast, user, userId])

  const onSendResetEmail = useCallback(async () => {
    if (!tenantId || !user) return
    setPasswordBusy(true)
    onError(null)
    try {
      const res = await sendTenantUserPasswordResetEmail(tenantId, userId)
      toast.show({
        title: 'Restablecimiento enviado',
        message: `Se envió una contraseña temporal a ${res.email}. En desarrollo revisa el log de la API.`,
        variant: 'success',
      })
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudo enviar el restablecimiento.')
      onError(message)
      toast.show({ title: 'Error', message, variant: 'error' })
    } finally {
      setPasswordBusy(false)
    }
  }, [onError, tenantId, toast, user, userId])

  return {
    onSavePassword,
    onSendResetEmail,
    password,
    passwordBusy,
    passwordConfirm,
    setPassword,
    setPasswordConfirm,
  }
}
