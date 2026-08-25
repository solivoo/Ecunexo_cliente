const TOKEN_KEY = 'ecunexo.accessToken';
const TENANT_KEY = 'ecunexo.tenantId';
const USER_KEY = 'ecunexo.userId';

export interface StoredSession {
  accessToken: string;
  tenantId: string;
  userId: string;
}

export function saveSession(session: StoredSession): void {
  localStorage.setItem(TOKEN_KEY, session.accessToken);
  localStorage.setItem(TENANT_KEY, session.tenantId);
  localStorage.setItem(USER_KEY, session.userId);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TENANT_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getTenantId(): string | null {
  return localStorage.getItem(TENANT_KEY);
}

export function getUserId(): string | null {
  return localStorage.getItem(USER_KEY);
}

export function readSession(): StoredSession | null {
  const accessToken = getAccessToken();
  const tenantId = getTenantId();
  const userId = getUserId();
  if (!accessToken || !tenantId || !userId) {
    return null;
  }
  return { accessToken, tenantId, userId };
}
