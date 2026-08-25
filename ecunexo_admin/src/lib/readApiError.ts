import axios from 'axios'
import { logger } from './logger'

type ProblemBody = {
  detail?: string
  title?: string
  error?: string
}

export function readApiError(error: unknown, fallback = 'Ocurrió un error inesperado.'): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const url = error.config?.url ?? '(sin url)'
    const method = error.config?.method?.toUpperCase() ?? '?'
    logger.warn('readApiError', { method, url, status, message: error.message })

    const data = error.response?.data as ProblemBody | string | undefined
    if (typeof data === 'string' && data.trim()) {
      return data
    }
    if (data && typeof data === 'object') {
      if (data.detail?.trim()) return data.detail
      if (data.error?.trim()) return data.error
      if (data.title?.trim()) return data.title
    }
    if (error.message) {
      return error.message
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}
