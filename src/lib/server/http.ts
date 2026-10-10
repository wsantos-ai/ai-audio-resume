import 'server-only';
import { NextResponse } from 'next/server';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Proteção CSRF simples: requisições que alteram dados precisam do header enviado por lib/client/api.ts */
export function assertFetchRequest(request: Request) {
  if (request.headers.get('x-requested-with') !== 'fetch') {
    throw new HttpError(400, 'Requisição inválida.');
  }
}

/** Envolve um route handler convertendo HttpError/exceções em respostas JSON. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message, ...err.data }, err.status);
      console.error(err);
      return json({ error: 'Erro interno.' }, 500);
    }
  };
}
