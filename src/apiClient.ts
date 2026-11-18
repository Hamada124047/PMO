let activeAuthToken: string | null = null;
let onUnauthorizedCallback: (() => void) | null = null;
let isBootstrappingAuth = false;

export const setActiveAuthToken = (token: string | null) => {
  activeAuthToken = token;
};

export const getActiveAuthToken = (): string | null => {
  if (activeAuthToken) return activeAuthToken;
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('pmo_session_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.token === 'string' && parsed.token.includes('.')) {
          activeAuthToken = parsed.token;
          return activeAuthToken;
        }
      }
    } catch {
      // ignore invalid storage
    }
  }
  return null;
};

export const setUnauthorizedHandler = (cb: (() => void) | null) => {
  onUnauthorizedCallback = cb;
};

export const setBootstrappingAuth = (bootstrapping: boolean) => {
  isBootstrappingAuth = bootstrapping;
};

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const urlStr =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.pathname + input.search
      : input.url;

  const isApiCall = urlStr.startsWith('/api') || urlStr.includes('/api/');
  let nextInit = init;

  if (isApiCall) {
    const headers = new Headers(
      init?.headers || (input instanceof Request ? input.headers : undefined)
    );
    const token = getActiveAuthToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    nextInit = { ...init, headers };
  }

  const response = await window.fetch(input, nextInit);

  if (
    isApiCall &&
    response.status === 401 &&
    !isBootstrappingAuth &&
    !urlStr.includes('/api/auth/login') &&
    !urlStr.includes('/api/auth/quick-login') &&
    !urlStr.includes('/api/auth/register') &&
    !urlStr.includes('/api/auth/forgot-password') &&
    !urlStr.includes('/api/auth/reset-password') &&
    !urlStr.includes('/api/auth/logout')
  ) {
    onUnauthorizedCallback?.();
  }

  return response;
}
