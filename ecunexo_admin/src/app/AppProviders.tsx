import type { ReactNode } from 'react'
import { AppPreferencesProvider } from '@/features/settings/AppPreferencesProvider'
import { AppToastProvider } from '@/components/toast'

export function AppProviders({ children }: { readonly children: ReactNode }) {
  return (
    <AppPreferencesProvider>
      <AppToastProvider>{children}</AppToastProvider>
    </AppPreferencesProvider>
  )
}
