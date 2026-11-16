'use client';

import { FormEvent, useCallback, useState } from 'react';
import { CaptchaWidget } from '../../../src/components/auth/captcha-widget';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const updateCaptcha = useCallback((token: string) => setCaptchaToken(token), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const csrf = await fetch('/api/backend/auth/csrf', { cache: 'no-store' }).then(r => r.json());
      const response = await fetch('/api/backend/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: window.location.origin, 'x-csrf-token': csrf.token }, body: JSON.stringify({ email: form.get('email'), password: form.get('password'), captchaToken }) });
      if (!response.ok) throw new Error('No se pudo iniciar sesión. Revisa tus datos e inténtalo de nuevo.');
      const result = await response.json() as { requiresTotp?: boolean; challengeToken?: string };
      if (result.requiresTotp && result.challengeToken) { setChallengeToken(result.challengeToken); return; }
      window.location.assign('/');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.'); }
    finally { setBusy(false); }
  }
  async function verifyTotp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const csrf = await fetch('/api/backend/auth/csrf', { cache: 'no-store' }).then(r => r.json());
      const response = await fetch('/api/backend/auth/totp/verify-login', { method: 'POST', headers: { 'content-type': 'application/json', origin: window.location.origin, 'x-csrf-token': csrf.token }, body: JSON.stringify({ challengeToken, code: form.get('code') }) });
      if (!response.ok) throw new Error('No se pudo verificar el código. Vuelve a iniciar sesión e inténtalo de nuevo.');
      window.location.assign('/');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo verificar el código.'); }
    finally { setBusy(false); }
  }
  if (challengeToken) return <main><h1>Verificación en dos pasos</h1><form onSubmit={verifyTotp}><label htmlFor="code">Código de tu autenticador</label><input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required/>{error && <p role="alert">{error}</p>}<button disabled={busy}>{busy ? 'Verificando…' : 'Verificar e iniciar sesión'}</button></form><p><a href="/totp/recovery">Perdí acceso a mi autenticador</a></p></main>;
  return <main><h1>Iniciar sesión</h1><form onSubmit={submit}>
    <label htmlFor="email">Correo electrónico</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={320} />
    <label htmlFor="password">Contraseña</label><input id="password" name="password" type="password" autoComplete="current-password" required maxLength={256} />
    <CaptchaWidget action="login" onToken={updateCaptcha} />
    {error && <p role="alert">{error}</p>}<button disabled={busy}>{busy ? 'Ingresando…' : 'Iniciar sesión'}</button>
    <a href="/password/forgot">¿Olvidaste tu contraseña?</a>
  </form></main>;
}
