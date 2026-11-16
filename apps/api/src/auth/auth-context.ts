import { Request } from 'express';

export type AuthenticatedPrincipal = {
  userId: string;
  sessionId: string;
  roles: string[];
  totpSatisfied: boolean;
};

export type AuthenticatedRequest = Request & { auth?: AuthenticatedPrincipal };
