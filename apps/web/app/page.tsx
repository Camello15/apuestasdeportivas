import Link from 'next/link';
import { LogoutButton } from '../src/components/auth/logout-button';

export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>Apuestas Deportivas</h1>
      <p>Proyecto académico de simulación; no se realizan apuestas con dinero real.</p>
      <p><Link href="/register">Crear cuenta de apostador</Link></p>
      <p><Link href="/login">Iniciar sesión</Link></p>
      <LogoutButton />
    </main>
  );
}
