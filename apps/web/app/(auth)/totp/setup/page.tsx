'use client';
import { FormEvent, useState } from 'react';

async function post(path: string, body?: unknown) {
  const csrf = await fetch('/api/backend/auth/csrf', { cache: 'no-store' }).then(r => r.json()) as { token: string };
  return fetch(`/api/backend/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: window.location.origin, 'x-csrf-token': csrf.token }, body: JSON.stringify(body ?? {}) });
}
export default function TotpSetupPage() {
  const [setup, setSetup] = useState<{ secret: string; provisioningUri: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]); const [error, setError] = useState('');
  async function start() {
    setError('');
    try { const response = await post('auth/totp/setup'); if (!response.ok) throw new Error(); setSetup(await response.json()); }
    catch { setError('No se pudo iniciar la configuración. Inicia sesión e inténtalo de nuevo.'); }
  }
  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); const code = new FormData(event.currentTarget).get('code');
    try {
      const response = await post('auth/totp/confirm', { code }); if (!response.ok) throw new Error();
      const result = await response.json() as { recoveryCodes: string[] }; setCodes(result.recoveryCodes); setSetup(null);
    } catch { setError('El código no es válido o la configuración venció.'); }
  }
  return <main><h1>Configurar autenticación en dos pasos</h1>
    {codes.length > 0 ? <section aria-labelledby="recovery-codes"><h2 id="recovery-codes">Guarda tus códigos de recuperación</h2><p>Se muestran una sola vez. Cada código se puede usar una vez.</p><ul>{codes.map(code => <li key={code}><code>{code}</code></li>)}</ul><a href="/">Terminar</a></section> : setup ? <section><h2>Vincula tu autenticador</h2><p>Agrega manualmente esta clave en tu aplicación de autenticación.</p><p><strong>Clave:</strong> <code>{setup.secret}</code></p><p className="setup-uri"><strong>URI de configuración:</strong> <code>{setup.provisioningUri}</code></p><form onSubmit={confirm}><label htmlFor="code">Código de seis dígitos</label><input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required/><button>Confirmar autenticador</button></form></section> : <><p>Usa una aplicación compatible con TOTP.</p><button onClick={start}>Iniciar configuración</button></>}
    {error && <p role="alert">{error}</p>}
  </main>;
}
