'use client';
import { useCallback, useEffect, useState } from 'react';
import { refreshSession } from '../../../../src/lib/auth/session';

type UserRow = { id: string; email: string; emailVerifiedAt: string | null; status: string; userRoles: { role: { name: string } }[] };
async function adminPost(path: string, body: unknown = {}) {
  const csrf = await fetch('/api/backend/auth/csrf', { cache: 'no-store' }).then(r => r.json()) as { token: string };
  const init: RequestInit = { method: 'POST', headers: { 'content-type': 'application/json', origin: window.location.origin, 'x-csrf-token': csrf.token }, body: JSON.stringify(body) };
  let response = await fetch(`/api/backend/${path}`, init);
  if (response.status === 401 && await refreshSession()) {
    const renewedCsrf = await fetch('/api/backend/auth/csrf', { cache: 'no-store' }).then(r => r.json()) as { token: string };
    response = await fetch(`/api/backend/${path}`, { ...init, headers: { ...(init.headers as Record<string, string>), 'x-csrf-token': renewedCsrf.token } });
  }
  return response;
}
export default function UserRolesPage() {
  const [users, setUsers] = useState<UserRow[]>([]); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const loadUsers = useCallback(async () => {
    setError(''); const response = await adminPost('authorization/users/list', { take: 50 });
    if (!response.ok) { setError('No se pudo cargar la lista. Se requiere permiso administrativo.'); return; }
    setUsers(await response.json() as UserRow[]);
  }, []);
  useEffect(() => { void loadUsers(); }, [loadUsers]);
  async function changeRole(user: UserRow, assign: boolean) {
    setBusy(true); setError(''); setMessage('');
    try {
      const path = `authorization/users/${user.id}/operator/${assign ? 'assign' : 'remove'}`;
      const response = await adminPost(path);
      if (!response.ok) throw new Error('No se pudo cambiar el rol.');
      setMessage(`Rol de operador ${assign ? 'asignado a' : 'retirado de'} ${user.email}.`);
      await loadUsers();
    } catch { setError('No se pudo cambiar el rol. Verifica tus permisos e inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }
  return <main className="auth-shell"><h1>Gestión de roles</h1><p>Asigna o retira únicamente el rol de operador. Los cambios revocan las sesiones activas de la cuenta.</p>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    <div className="table-scroll" role="region" aria-label="Usuarios y roles" tabIndex={0}><table><caption>Primeros 50 usuarios registrados</caption><thead><tr><th scope="col">Correo</th><th scope="col">Estado</th><th scope="col">Roles</th><th scope="col">Acciones</th></tr></thead>
      <tbody>{users.map(user => { const isOperator = user.userRoles.some(x => x.role.name === 'operador'); return <tr key={user.id}><td>{user.email}</td><td>{user.status}</td><td>{user.userRoles.map(x => x.role.name).join(', ')}</td><td><button type="button" disabled={busy} onClick={() => void changeRole(user, !isOperator)}>{isOperator ? 'Retirar operador' : 'Asignar operador'}</button></td></tr>; })}</tbody>
    </table></div>
    {!users.length && !error && <p>No hay usuarios para mostrar.</p>}
  </main>;
}
