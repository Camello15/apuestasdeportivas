import Link from 'next/link';
import { LogoutButton } from '../src/components/auth/logout-button';

const features = [
  { title: 'Cuenta segura', text: 'Registro con CAPTCHA, verificación de correo y autenticación en dos pasos (TOTP).', ready: true },
  { title: 'Roles y permisos', text: 'Apostador, operador y administrador con control de acceso por rol.', ready: true },
  { title: 'Partidos y cuotas', text: 'Consulta de eventos deportivos y cuotas disponibles.', ready: false },
  { title: 'Mis apuestas', text: 'Historial y estado de tus apuestas simuladas.', ready: false },
];

export default function Home() {
  return (
    <main className="home">
      <header className="site-header">
        <div className="site-header__inner">
          <Link href="/" className="brand">Apuestas<span>Deportivas</span></Link>
          <nav className="site-nav" aria-label="Principal">
            <Link href="/login" className="btn btn--ghost">Iniciar sesión</Link>
            <Link href="/register" className="btn btn--primary">Crear cuenta</Link>
            <LogoutButton />
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="hero__inner">
          <h1>Tu plataforma de apuestas deportivas, simulada y segura</h1>
          <p>Proyecto académico de simulación; no se realizan apuestas con dinero real.</p>
          <div className="hero__actions">
            <Link href="/register" className="btn btn--primary">Crear cuenta de apostador</Link>
            <Link href="/login" className="btn btn--ghost">Ya tengo cuenta</Link>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="funciones">
        <h2 id="funciones">Funcionalidades</h2>
        <div className="cards">
          {features.map((f) => (
            <article className="card" key={f.title}>
              <span className={f.ready ? 'card__tag' : 'card__tag card__tag--soon'}>{f.ready ? 'Disponible' : 'Próximamente'}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="site-footer">Taller #4 · Arquitectura de Software · UTPL</footer>
    </main>
  );
}
