import { useEffect, useState } from 'react'
import { getOnboardingStatus } from '@/services/onboardingApi'

export function useOnboardingStatus() {
  const [hasOrganization, setHasOrganization] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void getOnboardingStatus()
      .then((status) => {
        if (!cancelled) setHasOrganization(status.hasOrganization)
      })
      .catch(() => {
        if (!cancelled) setHasOrganization(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return {
    hasOrganization,
    showActivateLicense: hasOrganization === false,
  }
}
