'use client';

import { FormEvent, useEffect, useState } from 'react';

export function VerifyEmailForm({ token }: { token: string }) {
  const [verificationToken, setVerificationToken] = useState(token);
  const [message, setMessage] = useState('Confirma para verificar tu correo.');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (token) return;
    const fragmentToken = window.location.hash.slice(1);
    if (fragmentToken) {
      setVerificationToken(fragmentToken);
      window.history.replaceState(null, '', window.location.pathname);
      setMessage('Enlace listo. Confirma para verificar tu correo.');
    } else {
      setMessage('No se encontró un enlace de verificación. Solicita uno nuevo.');
    }
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch('/api/backend/auth/email/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: verificationToken }),
      });
      setMessage(response.ok ? 'Correo verificado. Ya puedes iniciar sesión.' : 'El enlace no es válido o ha vencido. Solicita uno nuevo.');
    } catch {
      setMessage('El servicio no está disponible. Vuelve a intentarlo más tarde.');
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit}>
      <button type="submit" disabled={busy || !verificationToken} style={{ minHeight: 44 }}>
      {busy ? 'Verificando…' : 'Verificar correo'}
    </button>
    <p role="status" aria-live="polite">{message}</p>
  </form>;
}
