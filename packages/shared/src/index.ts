/** Tipos compartidos entre apps/web y apps/api. */
export type HealthStatus = {
  status: 'ok';
  service: 'web' | 'api' | 'reports';
  timestamp: string;
};

export const ROLES = ['apostador', 'operador', 'administrador'] as const;
export type Role = (typeof ROLES)[number];
