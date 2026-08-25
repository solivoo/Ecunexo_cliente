import { createAsyncThunk } from '@reduxjs/toolkit'
import { readApiError } from '@/lib/readApiError'
import {
  fetchSession,
  fetchSubscriptionSession,
  loginWithPassword,
  type SessionPayload,
} from '@/services/authApi'
import type { RootState } from '@/store'
import {
  clearHolderResume,
  setCredentials,
  setSessionPayload,
  type HolderResume,
} from '@/store/authSlice'

export type LoginFormInput = {
  email: string
  password: string
}

export type LoginSuccess = {
  accessToken: string
  tenantId: string | null
  userId: string
  session: SessionPayload
}

export const loginThunk = createAsyncThunk<LoginSuccess, LoginFormInput, { rejectValue: string }>(
  'auth/login',
  async (input, { rejectWithValue }) => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
    if (!baseUrl) {
      return rejectWithValue('Define VITE_API_BASE_URL en .env (p. ej. http://localhost:5088).')
    }

    if (!input.email.trim() || !input.password) {
      return rejectWithValue('Completa correo y contraseña.')
    }

    try {
      const auth = await loginWithPassword({
        email: input.email.trim(),
        password: input.password,
      })

      const sessionAuth = {
        accessToken: auth.accessToken,
        tenantId: auth.tenantId,
        userId: auth.userId,
        isSubscriptionHolder: auth.isSubscriptionHolder,
      }
      const session =
        auth.tenantId && !auth.isSubscriptionHolder
          ? await fetchSession(auth.tenantId, sessionAuth)
          : await fetchSubscriptionSession(sessionAuth)

      return {
        accessToken: auth.accessToken,
        tenantId: session.tenant?.id ?? null,
        userId: session.user.id,
        session,
      }
    } catch (err) {
      return rejectWithValue(readApiError(err, 'No se pudo iniciar sesión. Comprueba credenciales y la Api.'))
    }
  }
)

/** Vuelve al plano titular (listado de empresas) usando el token guardado. */
export const restoreHolderSessionThunk = createAsyncThunk<
  void,
  void,
  { state: RootState; rejectValue: string }
>('auth/restoreHolderSession', async (_arg, { getState, dispatch, rejectWithValue }) => {
  const resume = getState().auth.holderResume as HolderResume | null
  if (!resume?.accessToken || !resume.userId) {
    return rejectWithValue('No hay sesión de titular guardada. Vuelve a iniciar sesión.')
  }

  try {
    const sessionAuth = {
      accessToken: resume.accessToken,
      tenantId: null as string | null,
      userId: resume.userId,
      isSubscriptionHolder: true,
    }
    const session = await fetchSubscriptionSession(sessionAuth)
    dispatch(
      setCredentials({
        accessToken: resume.accessToken,
        tenantId: null,
        userId: resume.userId,
      })
    )
    dispatch(setSessionPayload(session))
    dispatch(clearHolderResume())
  } catch (err) {
    return rejectWithValue(
      readApiError(err, 'No se pudo volver a la gestión de empresas. Vuelve a iniciar sesión.')
    )
  }
})
