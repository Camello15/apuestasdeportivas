'use client';

import { FormEvent, useCallback, useState } from 'react';
import Link from 'next/link';
import { CaptchaWidget } from '../../../src/components/auth/captcha-widget';

export default function RegisterPage() {
  const [captchaToken, setCaptchaToken] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const updateCaptcha = useCallback((token: string) => setCaptchaToken(token), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/backend/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
          ageDeclared: form.get('ageDeclared') === 'on',
          captchaToken,
        }),
      });
      const result = await response.json() as { message?: string };
      setMessage(response.ok
        ? result.message ?? 'Si los datos son válidos, recibirás instrucciones para verificar el correo.'
        : 'No se pudo completar el registro. Revisa los datos y vuelve a intentarlo.');
    } catch {
      setMessage('El servicio no está disponible. Vuelve a intentarlo más tarde.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>Crear cuenta de apostador</h1>
      <p>Proyecto académico de simulación. No se realizan apuestas con dinero real.</p>
      <form onSubmit={submit}>
        <div style={{ marginBlock: '1rem' }}>
          <label htmlFor="email">Correo electrónico</label>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={320} style={{ display: 'block', width: '100%', minHeight: 44 }} />
        </div>
        <div style={{ marginBlock: '1rem' }}>
          <label htmlFor="password">Contraseña (15 a 128 caracteres)</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={15} maxLength={256} style={{ display: 'block', width: '100%', minHeight: 44 }} />
          <small>Se aceptan espacios y caracteres Unicode. No uses una contraseña común o comprometida.</small>
        </div>
        <div style={{ marginBlock: '1rem' }}>
          <input id="ageDeclared" name="ageDeclared" type="checkbox" required />{' '}
          <label htmlFor="ageDeclared">Declaro que soy mayor de edad.</label>
        </div>
        <CaptchaWidget onToken={updateCaptcha} />
        <button type="submit" disabled={busy || !captchaToken} style={{ minHeight: 44, marginTop: '1rem' }}>
          {busy ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
      <p aria-live="polite" role="status">{message}</p>
      <p><Link href="/">Volver al inicio</Link></p>
    </main>
  );
}
