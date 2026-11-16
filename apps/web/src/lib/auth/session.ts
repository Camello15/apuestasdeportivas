export async function refreshSession(): Promise<boolean> {
  const csrfResponse = await fetch('/api/backend/auth/csrf', { cache: 'no-store' });
  if (!csrfResponse.ok) return false;
  const { token } = await csrfResponse.json() as { token: string };
  const response = await fetch('/api/backend/auth/session/refresh', {
    method: 'POST', headers: { origin: window.location.origin, 'x-csrf-token': token },
  });
  return response.ok;
}

export async function logout(): Promise<void> {
  const csrfResponse = await fetch('/api/backend/auth/csrf', { cache: 'no-store' });
  if (!csrfResponse.ok) throw new Error('No se pudo cerrar la sesión.');
  const { token } = await csrfResponse.json() as { token: string };
  const response = await fetch('/api/backend/auth/session/logout', {
    method: 'POST', headers: { origin: window.location.origin, 'x-csrf-token': token },
  });
  if (!response.ok) throw new Error('No se pudo cerrar la sesión.');
}
