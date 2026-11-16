'use client';
import { FormEvent, useEffect, useState } from 'react';
export default function ResetPasswordPage() {
  const [token, setToken] = useState(''); const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { const value = window.location.hash.slice(1); setToken(value); if (value) history.replaceState(null, '', window.location.pathname); }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(''); const password = new FormData(e.currentTarget).get('password');
    try {
      const csrf = await fetch('/api/backend/auth/csrf', { cache: 'no-store' }).then(r => r.json());
      const response = await fetch('/api/backend/auth/password/reset', { method: 'POST', headers: { 'content-type': 'application/json', origin: window.location.origin, 'x-csrf-token': csrf.token }, body: JSON.stringify({ token, password }) });
      if (response.ok) setMessage('Contraseña restablecida. Ya puedes iniciar sesión.');
      else setError('No se pudo restablecer la contraseña. Revisa el enlace y la contraseña e inténtalo de nuevo.');
    } catch { setError('No se pudo restablecer la contraseña. Vuelve a intentarlo más tarde.'); }
    finally { setBusy(false); }
  }
  return <main><h1>Elegir nueva contraseña</h1>{message ? <p role="status">{message}</p> : <form onSubmit={submit}><label htmlFor="password">Nueva contraseña</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={15} maxLength={128} required/><p>Usa entre 15 y 128 caracteres.</p>{error && <p role="alert">{error}</p>}<button disabled={!token || busy}>{busy ? 'Restableciendo…' : 'Restablecer contraseña'}</button></form>}</main>;
}
