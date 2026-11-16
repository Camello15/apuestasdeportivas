'use client';
import { FormEvent, useEffect, useState } from 'react';

async function post(path: string, body: unknown) {
  const csrf = await fetch('/api/backend/auth/csrf', { cache: 'no-store' }).then(r => r.json()) as { token: string };
  return fetch(`/api/backend/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: window.location.origin, 'x-csrf-token': csrf.token }, body: JSON.stringify(body) });
}
type Enrollment = { reenrollmentToken: string; secret?: string; provisioningUri?: string };
export default function TotpRecoveryPage() {
  const [emailToken, setEmailToken] = useState(''); const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [codes, setCodes] = useState<string[]>([]); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  useEffect(() => { const value = window.location.hash.slice(1); setEmailToken(value); if (value) history.replaceState(null, '', window.location.pathname); }, []);
  async function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); const form = new FormData(event.currentTarget);
    try {
      const response = await post('auth/totp/recovery/request', { email: form.get('email'), recoveryCode: form.get('recoveryCode') });
      setMessage(response.ok ? 'Si los datos corresponden a una cuenta, recibirás instrucciones en el correo registrado.' : 'No se pudo completar la solicitud. Revisa los datos e inténtalo de nuevo.');
    } catch { setMessage('Si los datos corresponden a una cuenta, recibirás instrucciones en el correo registrado.'); }
  }
  async function completeRecovery() {
    setError('');
    try {
      const response = await post('auth/totp/recovery/complete', { token: emailToken }); if (!response.ok) throw new Error();
      const result = await response.json() as { reenrollmentToken: string };
      const setupResponse = await post('auth/totp/recovery/setup', { reenrollmentToken: result.reenrollmentToken }); if (!setupResponse.ok) throw new Error();
      setEnrollment({ reenrollmentToken: result.reenrollmentToken, ...await setupResponse.json() });
    } catch { setError('No se pudo completar la recuperación. El enlace puede haber vencido.'); }
  }
  async function confirmNewFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!enrollment) return; const code = new FormData(event.currentTarget).get('code');
    try {
      const response = await post('auth/totp/recovery/confirm', { reenrollmentToken: enrollment.reenrollmentToken, code }); if (!response.ok) throw new Error();
      const result = await response.json() as { recoveryCodes: string[] }; setCodes(result.recoveryCodes); setEnrollment(null);
    } catch { setError('El código no es válido o la configuración venció.'); }
  }
  return <main><h1>Recuperar autenticador</h1>
    {codes.length > 0 ? <section><h2>Guarda los nuevos códigos</h2><p>Los anteriores quedaron invalidados. Estos códigos se muestran una sola vez.</p><ul>{codes.map(code => <li key={code}><code>{code}</code></li>)}</ul><a href="/login">Ir a iniciar sesión</a></section>
      : enrollment ? <section><h2>Configura un nuevo autenticador</h2><p>Clave: <code>{enrollment.secret}</code></p><p className="setup-uri"><code>{enrollment.provisioningUri}</code></p><form onSubmit={confirmNewFactor}><label htmlFor="new-code">Código de seis dígitos</label><input id="new-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required/><button>Confirmar autenticador</button></form></section>
      : emailToken ? <><p>El enlace verifica el acceso al correo registrado. Al continuar se invalidará el autenticador anterior y todas las sesiones.</p><button onClick={completeRecovery}>Verificar correo y continuar</button></>
      : <form onSubmit={requestRecovery}><p>Si aún tienes tu autenticador perdido, ingresa un código de recuperación. Si ya verificaste el correo y necesitas reiniciar el enrolamiento, basta con tu correo.</p><label htmlFor="email">Correo electrónico</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={320}/><label htmlFor="recoveryCode">Código de recuperación (si lo tienes)</label><input id="recoveryCode" name="recoveryCode" autoComplete="off" minLength={20} maxLength={20}/><button>Enviar verificación al correo</button></form>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </main>;
}
