import type { Storage } from 'redux-persist'

/**
 * Adaptador localStorage compatible con Vite ESM.
 * Evita `import storage from 'redux-persist/lib/storage'` (interop roto → getItem no es función).
 */
export const persistStorage: Storage = {
  getItem(key: string): Promise<string | null> {
    if (typeof window === 'undefined') {
      return Promise.resolve(null)
    }
    return Promise.resolve(window.localStorage.getItem(key))
  },
  setItem(key: string, value: string): Promise<void> {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value)
    }
    return Promise.resolve()
  },
  removeItem(key: string): Promise<void> {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key)
    }
    return Promise.resolve()
  },
}
