import { api } from '@/lib/apiClient';

export interface ActivateLicensePayload {
  activationCode: string;
  licenseArtifact: string;
}

export interface ActivateLicenseResult {
  accessToken: string;
  expiresAt: string;
  tenantId: string | null;
  userId: string;
  isSubscriptionHolder: boolean;
}

export async function activateLicense(
  body: ActivateLicensePayload
): Promise<ActivateLicenseResult> {
  const { data } = await api.post<ActivateLicenseResult>(
    '/api/v1/onboarding/activate-license',
    body
  );
  return data;
}

export type OnboardingStatusDto = {
  hasOrganization: boolean
}

export type ApplyLicenseUpgradeBody = {
  activationCode: string
  licenseArtifact: string
}

export type ApplyLicenseUpgradeResult = {
  subscriptionAccountId: string
  servicePlanName: string
  maxUsers: number
  maxWarehouses: number
  subscriptionMaxTenants: number
  enabledModules: string[] | null
}

export async function getOnboardingStatus(): Promise<OnboardingStatusDto> {
  const { data } = await api.get<OnboardingStatusDto>('/api/v1/onboarding/status')
  return data
}

export async function applyLicenseUpgrade(
  body: ApplyLicenseUpgradeBody
): Promise<ApplyLicenseUpgradeResult> {
  const { data } = await api.post<ApplyLicenseUpgradeResult>('/api/v1/subscription/license', body)
  return data
}
