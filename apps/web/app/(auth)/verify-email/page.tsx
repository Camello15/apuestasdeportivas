import Link from 'next/link';
import { VerifyEmailForm } from './verify-email-form';

export default function VerifyEmailPage() {
  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>Verificar correo electrónico</h1>
      <p>La verificación habilita el acceso a tu cuenta de simulación académica.</p>
      <VerifyEmailForm token="" />
      <p><Link href="/">Volver al inicio</Link></p>
    </main>
  );
}
