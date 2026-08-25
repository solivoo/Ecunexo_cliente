import type { ReactNode } from 'react'
import { ToastProvider } from 'glubox'
import { AppPreferencesProvider } from '@/features/settings/AppPreferencesProvider'

export function AppProviders({ children }: { readonly children: ReactNode }) {
  return (
    <AppPreferencesProvider>
      <ToastProvider position="top-right">{children}</ToastProvider>
    </AppPreferencesProvider>
  )
}
