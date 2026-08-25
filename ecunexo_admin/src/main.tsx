import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import 'glubox/style.css'
import 'glubox/themes/index.css'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/router/index'
import { AppProviders } from '@/app/AppProviders'
import { GlobalStatus } from '@/app/GlobalStatus'
import { configureApiClient } from '@/lib/apiClient'
import { applyDocumentPreferences, readAppPreferences } from '@/lib/appPreferences'
import { hydrateFromLegacyStorage } from '@/store/authSlice'
import { persistor, store } from '@/store'

applyDocumentPreferences(readAppPreferences())

configureApiClient(store)

function onBeforeLift(): void {
  store.dispatch(hydrateFromLegacyStorage())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <PersistGate persistor={persistor} loading={null} onBeforeLift={onBeforeLift}>
        <AppProviders>
          <RouterProvider router={router} />
          <GlobalStatus />
        </AppProviders>
      </PersistGate>
    </Provider>
  </StrictMode>
)
