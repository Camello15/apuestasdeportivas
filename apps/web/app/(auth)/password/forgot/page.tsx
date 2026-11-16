'use client';
import { FormEvent, useState } from 'react';
export default function ForgotPasswordPage() {
  const [done, setDone] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(''); const email = new FormData(e.currentTarget).get('email');
    try {
      const csrf = await fetch('/api/backend/auth/csrf', { cache: 'no-store' }).then(r => r.json());
      const response = await fetch('/api/backend/auth/password/forgot', { method: 'POST', headers: { 'content-type': 'application/json', origin: window.location.origin, 'x-csrf-token': csrf.token }, body: JSON.stringify({ email }) });
      if (response.ok) setDone(true); else setError('No se pudo procesar la solicitud. Vuelve a intentarlo más tarde.');
    } catch { setError('No se pudo procesar la solicitud. Vuelve a intentarlo más tarde.'); }
    finally { setBusy(false); }
  }
  return <main><h1>Recuperar contraseña</h1>{done ? <p role="status">Si el correo corresponde a una cuenta verificada, recibirás instrucciones.</p> : <form onSubmit={submit}><label htmlFor="email">Correo electrónico</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={320}/>{error && <p role="alert">{error}</p>}<button disabled={busy}>{busy ? 'Enviando…' : 'Enviar instrucciones'}</button></form>}</main>;
}
