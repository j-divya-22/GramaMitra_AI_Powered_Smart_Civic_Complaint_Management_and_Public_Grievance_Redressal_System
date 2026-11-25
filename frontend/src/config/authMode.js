const configuredMode = import.meta.env.VITE_AUTH_MODE;
const authMode = configuredMode || (import.meta.env.DEV ? 'local' : 'api');

if (authMode !== 'local' && authMode !== 'api') {
  throw new Error('VITE_AUTH_MODE must be either "local" or "api".');
}

if (authMode === 'local' && !import.meta.env.DEV) {
  throw new Error('Local demo authentication is only available in development.');
}

export const isLocalDemoMode = authMode === 'local';
