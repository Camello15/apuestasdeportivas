import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Apuestas Deportivas',
  description: 'Sistema web de apuestas deportivas (proyecto académico UTPL)',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
