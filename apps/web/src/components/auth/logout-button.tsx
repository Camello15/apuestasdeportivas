'use client';
import { useState } from 'react';
import { logout } from '../../lib/auth/session';

export function LogoutButton() {
  const [message, setMessage] = useState('');
  async function signOut() {
    setMessage('');
    try { await logout(); window.location.assign('/login'); }
    catch { setMessage('No se pudo cerrar la sesión. Vuelve a intentarlo.'); }
  }
  return <div><button type="button" onClick={signOut}>Cerrar sesión</button>{message && <p role="alert">{message}</p>}</div>;
}
