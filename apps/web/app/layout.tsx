import type { ReactNode } from 'react';

export const metadata = {
  title: 'Apuestas Deportivas',
  description: 'Sistema web de apuestas deportivas (proyecto académico UTPL)',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>{children}</body>
    </html>
  );
}
